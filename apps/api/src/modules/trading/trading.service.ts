import { Injectable } from "@nestjs/common";
import type { OrderSide, PlaceOrderRequest, Portfolio, Position, Trade } from "@githubwatch/shared";
import { MarketDataService } from "../market-data/market-data.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

const INITIAL_CASH = 10_000_000;
const FEE_RATE = 0.0005;

@Injectable()
export class TradingService {
  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly prisma: PrismaService
  ) {}

  async getPortfolio(): Promise<Portfolio> {
    const portfolio = await this.ensurePortfolio("demo");
    return this.toPortfolioResponse(portfolio.id);
  }

  async placeOrder(request: PlaceOrderRequest): Promise<Trade> {
    const portfolio = await this.ensurePortfolio(request.portfolioId);
    const symbol = request.symbol.toUpperCase();
    const quote = await this.marketDataService.getQuote(symbol);
    const grossAmount = quote.price * request.quantity;
    const fee = grossAmount * FEE_RATE;

    if (request.side === "BUY" && portfolio.cash.toNumber() < grossAmount + fee) {
      throw new Error("Insufficient cash");
    }

    if (request.side === "SELL") {
      const position = await this.prisma.position.findUnique({
        where: {
          portfolioId_symbol: {
            portfolioId: portfolio.id,
            symbol
          }
        }
      });

      if (!position || position.quantity.toNumber() < request.quantity) {
        throw new Error("Insufficient position quantity");
      }
    }

    const trade = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          portfolioId: portfolio.id,
          symbol,
          side: request.side,
          quantity: request.quantity,
          status: "FILLED"
        }
      });

      const createdTrade = await tx.trade.create({
        data: {
          orderId: order.id,
          portfolioId: portfolio.id,
          symbol,
          side: request.side,
          price: quote.price,
          quantity: request.quantity,
          fee,
          priceSource: quote.source,
          marketTime: quote.marketTime ? new Date(quote.marketTime) : null
        }
      });

      await this.applyTrade(tx, {
        portfolioId: portfolio.id,
        symbol,
        side: request.side,
        price: quote.price,
        quantity: request.quantity,
        fee
      });

      return createdTrade;
    });

    return toTradeResponse(trade);
  }

  private async applyTrade(tx: PrismaTransaction, trade: ApplyTradeInput) {
    const amount = trade.price * trade.quantity;
    const position = await tx.position.findUnique({
      where: {
        portfolioId_symbol: {
          portfolioId: trade.portfolioId,
          symbol: trade.symbol
        }
      }
    });

    if (trade.side === "BUY") {
      const previousQuantity = position?.quantity.toNumber() ?? 0;
      const previousAveragePrice = position?.averagePrice.toNumber() ?? trade.price;
      const nextQuantity = previousQuantity + trade.quantity;
      const nextAveragePrice =
        (previousAveragePrice * previousQuantity + amount) / nextQuantity;

      await tx.position.upsert({
        where: {
          portfolioId_symbol: {
            portfolioId: trade.portfolioId,
            symbol: trade.symbol
          }
        },
        create: {
          portfolioId: trade.portfolioId,
          symbol: trade.symbol,
          quantity: nextQuantity,
          averagePrice: nextAveragePrice,
          marketPrice: trade.price
        },
        update: {
          quantity: nextQuantity,
          averagePrice: nextAveragePrice,
          marketPrice: trade.price
        }
      });

      await tx.portfolio.update({
        where: {
          id: trade.portfolioId
        },
        data: {
          cash: {
            decrement: amount + trade.fee
          }
        }
      });
      return;
    }

    const nextQuantity = (position?.quantity.toNumber() ?? 0) - trade.quantity;

    if (nextQuantity <= 0) {
      await tx.position.deleteMany({
        where: {
          portfolioId: trade.portfolioId,
          symbol: trade.symbol
        }
      });
    } else {
      await tx.position.update({
        where: {
          portfolioId_symbol: {
            portfolioId: trade.portfolioId,
            symbol: trade.symbol
          }
        },
        data: {
          quantity: nextQuantity,
          marketPrice: trade.price
        }
      });
    }

    await tx.portfolio.update({
      where: {
        id: trade.portfolioId
      },
      data: {
        cash: {
          increment: amount - trade.fee
        }
      }
    });
  }

  private ensurePortfolio(id: string) {
    return this.prisma.portfolio.upsert({
      where: {
        id
      },
      create: {
        id,
        name: "Demo Portfolio",
        cash: INITIAL_CASH,
        initialCash: INITIAL_CASH
      },
      update: {}
    });
  }

  private async toPortfolioResponse(portfolioId: string): Promise<Portfolio> {
    const portfolio = await this.prisma.portfolio.findUniqueOrThrow({
      where: {
        id: portfolioId
      },
      include: {
        positions: {
          orderBy: {
            symbol: "asc"
          }
        },
        trades: {
          orderBy: {
            executedAt: "desc"
          },
          take: 50
        }
      }
    });

    const positions = await Promise.all(
      portfolio.positions.map(async (position): Promise<Position> => {
        const quote = await this.marketDataService.getQuote(position.symbol).catch(() => null);
        const marketPrice = quote?.price ?? position.marketPrice.toNumber();
        const quantity = position.quantity.toNumber();
        const averagePrice = position.averagePrice.toNumber();
        const marketValue = marketPrice * quantity;
        const cost = averagePrice * quantity;
        const unrealizedPnl = marketValue - cost;

        return {
          symbol: position.symbol,
          quantity,
          averagePrice,
          marketPrice,
          marketValue,
          unrealizedPnl,
          unrealizedPnlRate: cost === 0 ? 0 : unrealizedPnl / cost
        };
      })
    );

    const cash = portfolio.cash.toNumber();
    const initialCash = portfolio.initialCash.toNumber();
    const positionValue = positions.reduce((sum, position) => sum + position.marketValue, 0);
    const totalValue = cash + positionValue;
    const totalPnl = totalValue - initialCash;

    return {
      id: portfolio.id,
      name: portfolio.name,
      cash,
      initialCash,
      positions,
      trades: portfolio.trades.map(toTradeResponse),
      totalValue,
      totalPnl,
      totalPnlRate: initialCash === 0 ? 0 : totalPnl / initialCash
    };
  }
}

interface ApplyTradeInput {
  portfolioId: string;
  symbol: string;
  side: OrderSide;
  price: number;
  quantity: number;
  fee: number;
}

function toTradeResponse(trade: PersistedTrade): Trade {
  return {
    id: trade.id,
    orderId: trade.orderId,
    portfolioId: trade.portfolioId,
    symbol: trade.symbol,
    side: trade.side,
    price: trade.price.toNumber(),
    quantity: trade.quantity.toNumber(),
    fee: trade.fee.toNumber(),
    priceSource: trade.priceSource as Trade["priceSource"],
    marketTime: trade.marketTime?.toISOString(),
    executedAt: trade.executedAt.toISOString()
  };
}

type PrismaTransaction = Parameters<Parameters<PrismaService["$transaction"]>[0]>[0];
type PersistedTrade = Awaited<ReturnType<PrismaService["trade"]["create"]>>;
