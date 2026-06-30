import type {
  AssetSearchResult,
  MarketCandle,
  MarketQuote,
  SupportedInterval
} from "@githubwatch/shared";

export interface GetCandlesParams {
  symbol: string;
  interval: SupportedInterval;
  from: Date;
  to: Date;
}

export interface MarketDataProvider {
  searchSymbols(query: string): Promise<AssetSearchResult[]>;
  getQuote(symbol: string): Promise<MarketQuote>;
  getCandles(params: GetCandlesParams): Promise<MarketCandle[]>;
}

export const MARKET_DATA_PROVIDER = Symbol("MARKET_DATA_PROVIDER");
