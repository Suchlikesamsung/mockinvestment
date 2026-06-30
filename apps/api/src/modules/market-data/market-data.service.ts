import { Inject, Injectable } from "@nestjs/common";
import type { AssetSearchResult, SupportedInterval } from "@githubwatch/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { MARKET_DATA_PROVIDER, type MarketDataProvider } from "./market-data.types.js";

@Injectable()
export class MarketDataService {
  constructor(
    @Inject(MARKET_DATA_PROVIDER)
    private readonly provider: MarketDataProvider,
    private readonly prisma: PrismaService
  ) {}

  async searchSymbols(query: string): Promise<AssetSearchResult[]> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return [];
    }

    const assets = await this.prisma.asset.findMany({
      where: {
        isActive: true,
        OR: [
          { code: { contains: normalizedQuery } },
          { symbol: { contains: normalizedQuery.toUpperCase() } },
          { nameKo: { contains: normalizedQuery } },
          { nameEn: { contains: normalizedQuery } }
        ]
      },
      orderBy: {
        rank: "asc"
      },
      take: 12
    });

    return assets.map((asset) => ({
      symbol: asset.symbol,
      name: asset.nameKo,
      code: asset.code,
      market: asset.market,
      rank: asset.rank,
      marketCap: Number(asset.marketCap),
      exchange: asset.market,
      type: "EQUITY"
    }));
  }

  getQuote(symbol: string) {
    return this.provider.getQuote(symbol.toUpperCase());
  }

  getCandles(symbol: string, interval: SupportedInterval, range: string) {
    const to = new Date();
    const from = this.resolveRangeStart(range, to);

    return this.provider.getCandles({
      symbol: symbol.toUpperCase(),
      interval,
      from,
      to
    });
  }

  private resolveRangeStart(range: string, to: Date): Date {
    const date = new Date(to);

    if (range === "5d") {
      date.setDate(date.getDate() - 5);
      return date;
    }

    if (range === "1m") {
      date.setMonth(date.getMonth() - 1);
      return date;
    }

    if (range === "1y") {
      date.setFullYear(date.getFullYear() - 1);
      return date;
    }

    date.setDate(date.getDate() - 1);
    return date;
  }
}
