export type MarketDataSource = "YAHOO_FINANCE" | "MOCK";

export type SupportedInterval = "1m" | "2m" | "5m" | "15m" | "30m" | "60m" | "1d";

export const SUPPORTED_INTERVALS: SupportedInterval[] = [
  "1m",
  "2m",
  "5m",
  "15m",
  "30m",
  "60m",
  "1d"
];

export interface AssetSearchResult {
  symbol: string;
  name: string;
  code?: string;
  market?: string;
  rank?: number;
  marketCap?: number;
  exchange?: string;
  type?: string;
}

export interface MarketQuote {
  symbol: string;
  name?: string;
  exchange?: string;
  type?: string;
  price: number;
  change?: number;
  changePercent?: number;
  previousClose?: number;
  open?: number;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  marketState?: string;
  currency?: string;
  marketTime: string;
  source: MarketDataSource;
}

export interface MarketCandle {
  symbol: string;
  interval: SupportedInterval;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: MarketDataSource;
}

export type OrderSide = "BUY" | "SELL";
export type OrderStatus = "PENDING" | "FILLED" | "REJECTED";

export interface PlaceOrderRequest {
  portfolioId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
}

export interface Trade {
  id: string;
  orderId: string;
  portfolioId: string;
  symbol: string;
  side: OrderSide;
  price: number;
  quantity: number;
  fee: number;
  priceSource: MarketDataSource;
  marketTime?: string;
  executedAt: string;
}

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlRate: number;
}

export interface Portfolio {
  id: string;
  name: string;
  cash: number;
  initialCash: number;
  positions: Position[];
  trades: Trade[];
  totalValue: number;
  totalPnl: number;
  totalPnlRate: number;
}
