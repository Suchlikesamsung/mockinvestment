import type {
  AssetSearchResult,
  MarketCandle,
  MarketQuote,
  PlaceOrderRequest,
  Portfolio,
  Trade,
  SupportedInterval
} from "@githubwatch/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export async function getPortfolio(): Promise<Portfolio> {
  return fetchJson("/trading/portfolio");
}

export async function searchSymbols(query: string): Promise<AssetSearchResult[]> {
  return fetchJson(`/market-data/search?q=${encodeURIComponent(query)}`);
}

export async function getQuote(symbol: string): Promise<MarketQuote> {
  return fetchJson(`/market-data/quotes/${symbol}`);
}

export async function getCandles(
  symbol: string,
  interval: SupportedInterval,
  range: string
): Promise<MarketCandle[]> {
  const params = new URLSearchParams({
    interval,
    range
  });

  return fetchJson(`/market-data/candles/${symbol}?${params.toString()}`);
}

export async function placeOrder(request: PlaceOrderRequest): Promise<Trade> {
  return fetchJson("/trading/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}
