import { Injectable } from "@nestjs/common";
import YahooFinance from "yahoo-finance2";
import type {
  AssetSearchResult,
  MarketCandle,
  MarketQuote
} from "@githubwatch/shared";
import type { GetCandlesParams, MarketDataProvider } from "./market-data.types.js";

@Injectable()
export class YahooFinanceProvider implements MarketDataProvider {
  private readonly client = new YahooFinance();

  async searchSymbols(query: string): Promise<AssetSearchResult[]> {
    const result = await this.client.search(query);
    const quotes = result.quotes as unknown[];

    return quotes
      .filter(isSymbolSearchResult)
      .slice(0, 10)
      .map((item) => ({
        symbol: item.symbol,
        name: item.shortname ?? item.longname ?? item.symbol,
        exchange: item.exchange,
        type: item.quoteType
      }));
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    const quote = await this.client.quote(symbol);
    const price = quote.regularMarketPrice ?? quote.postMarketPrice ?? quote.preMarketPrice;

    if (!price) {
      throw new Error(`No market price available for ${symbol}`);
    }

    return {
      symbol,
      name: quote.shortName ?? quote.longName ?? quote.displayName,
      exchange: quote.fullExchangeName ?? quote.exchange,
      type: quote.quoteType,
      price,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      previousClose: quote.regularMarketPreviousClose,
      open: quote.regularMarketOpen,
      dayHigh: quote.regularMarketDayHigh,
      dayLow: quote.regularMarketDayLow,
      volume: quote.regularMarketVolume,
      marketState: quote.marketState,
      currency: quote.currency,
      marketTime: this.toIsoMarketTime(quote.regularMarketTime),
      source: "YAHOO_FINANCE"
    };
  }

  async getCandles(params: GetCandlesParams): Promise<MarketCandle[]> {
    const result = await this.client.chart(params.symbol, {
      period1: params.from,
      period2: params.to,
      interval: params.interval
    });

    return result.quotes
      .filter((quote) => quote.open && quote.high && quote.low && quote.close)
      .map((quote) => ({
        symbol: params.symbol,
        interval: params.interval,
        timestamp: quote.date.toISOString(),
        open: quote.open!,
        high: quote.high!,
        low: quote.low!,
        close: quote.close!,
        volume: quote.volume ?? 0,
        source: "YAHOO_FINANCE"
      }));
  }

  private toIsoMarketTime(value: Date | number | undefined): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === "number") {
      return new Date(value * 1000).toISOString();
    }

    return new Date().toISOString();
  }
}

interface YahooSymbolSearchResult {
  symbol: string;
  exchange?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
}

function isSymbolSearchResult(value: unknown): value is YahooSymbolSearchResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "symbol" in value &&
    typeof value.symbol === "string"
  );
}
