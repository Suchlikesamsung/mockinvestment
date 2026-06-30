"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  AssetSearchResult,
  MarketCandle,
  MarketQuote,
  Portfolio,
  SupportedInterval
} from "@githubwatch/shared";
import { getCandles, getPortfolio, getQuote, placeOrder, searchSymbols } from "../lib/api";
import { MarketChart } from "../components/MarketChart";

const CHART_INTERVALS: Array<{
  label: string;
  interval: SupportedInterval;
  range: string;
  refreshMs: number;
}> = [
  { label: "1분", interval: "1m", range: "1d", refreshMs: 60_000 },
  { label: "1시간", interval: "60m", range: "1m", refreshMs: 60 * 60_000 },
  { label: "1일", interval: "1d", range: "1y", refreshMs: 24 * 60 * 60_000 }
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AssetSearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<AssetSearchResult[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [chartInterval, setChartInterval] = useState(CHART_INTERVALS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async (nextSymbol = selectedSymbol, showLoading = true) => {
    if (!nextSymbol) {
      return;
    }

    if (showLoading) {
      setIsLoading(true);
    }

    setMessage("");

    try {
      const [nextPortfolio, nextQuote, nextCandles] = await Promise.all([
        getPortfolio(),
        getQuote(nextSymbol),
        getCandles(nextSymbol, chartInterval.interval, chartInterval.range)
      ]);

      setPortfolio(nextPortfolio);
      setQuote(nextQuote);
      setCandles(nextCandles);
      setSelectedSymbol(nextSymbol);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "요청에 실패했습니다.");
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [chartInterval, selectedSymbol]);

  useEffect(() => {
    void getPortfolio().then(setPortfolio).catch(() => {
      setMessage("포트폴리오를 불러오지 못했습니다.");
    });
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();

    if (!query) {
      setSearchResults([]);
      setSelectedAsset(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void searchSymbols(query)
        .then((results) => {
          setSearchResults(results);

          if (selectedAsset && selectedAsset.name !== query && selectedAsset.code !== query) {
            setSelectedAsset(null);
          }
        })
        .catch(() => {
          setSearchResults([]);
        });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [searchQuery, selectedAsset]);

  useEffect(() => {
    if (!selectedSymbol) {
      return;
    }

    void refresh(selectedSymbol, false);

    const timer = window.setInterval(() => {
      void refresh(selectedSymbol, false);
    }, chartInterval.refreshMs);

    return () => window.clearInterval(timer);
  }, [chartInterval, refresh, selectedSymbol]);

  async function handleSymbolSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const asset = selectedAsset ?? searchResults[0];

    if (!asset) {
      setMessage("자산 마스터에 등록된 국내 종목을 검색해주세요.");
      return;
    }

    await selectAsset(asset);
  }

  async function selectAsset(asset: AssetSearchResult) {
    setSelectedAsset(asset);
    setSearchQuery(`${asset.name} (${asset.code})`);
    setSearchResults([]);
    await refresh(asset.symbol);
  }

  async function handleOrder(side: "BUY" | "SELL") {
    if (!selectedSymbol) {
      setMessage("먼저 종목을 선택해주세요.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      await placeOrder({
        portfolioId: "demo",
        symbol: selectedSymbol,
        side,
        quantity
      });

      await refresh(selectedSymbol);
      setMessage(`${side === "BUY" ? "매수" : "매도"} 주문이 체결되었습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "주문에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="shell">
        <header className="topbar">
          <div>
            <h1 className="title">GitHubWatch</h1>
            <p className="subtitle">Yahoo Finance 기반 교육용 모의투자 시뮬레이터</p>
          </div>
          <form className="controls" onSubmit={handleSymbolSubmit}>
            <div className="search-box">
              <input
                className="field"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="삼성전자 또는 005930"
                aria-label="Asset search"
                autoComplete="off"
              />
              {searchResults.length ? (
                <div className="autocomplete" role="listbox">
                  {searchResults.map((result) => (
                    <button
                      key={result.symbol}
                      onClick={() => selectAsset(result)}
                      role="option"
                      type="button"
                    >
                      <strong>{result.name}</strong>
                      <span>{result.code}</span>
                      <small>
                        {[result.market, `#${result.rank}`, result.symbol].filter(Boolean).join(" · ")}
                      </small>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button className="button secondary" disabled={isLoading}>
              검색
            </button>
          </form>
        </header>

        <section className="grid">
          <div className="panel">
            <div className="quote-panel">
              <div>
                <div className="label">{quote?.name ?? selectedAsset?.name ?? "현재가"}</div>
                <div className={["quote-price", quoteTone(quote)].filter(Boolean).join(" ")}>
                  {quote ? money(quote.price, quote.currency) : "-"}
                </div>
                {quote ? (
                  <div className={["quote-change", quoteTone(quote)].filter(Boolean).join(" ")}>
                    {signedMoney(quote.change, quote.currency)} {signedPercent(quote.changePercent)}
                  </div>
                ) : null}
              </div>
              <div className="quote-grid">
                <QuoteMetric label="시가" value={quote?.open ? money(quote.open, quote.currency) : "-"} />
                <QuoteMetric label="고가" value={quote?.dayHigh ? money(quote.dayHigh, quote.currency) : "-"} />
                <QuoteMetric label="저가" value={quote?.dayLow ? money(quote.dayLow, quote.currency) : "-"} />
                <QuoteMetric
                  label="전일종가"
                  value={quote?.previousClose ? money(quote.previousClose, quote.currency) : "-"}
                />
                <QuoteMetric label="거래량" value={formatNumber(quote?.volume)} />
                <QuoteMetric label="장상태" value={quote?.marketState ?? "-"} />
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="stats">
              <Stat
                label="평가 자산"
                value={portfolio ? money(portfolio.totalValue) : "-"}
              />
              <Stat
                label="총 손익"
                value={portfolio ? percent(portfolio.totalPnlRate) : "-"}
                tone={portfolio && portfolio.totalPnl >= 0 ? "positive" : "negative"}
              />
            </div>
          </div>

          <div className="panel">
            <div className="controls" style={{ justifyContent: "space-between" }}>
              <strong>
                {selectedSymbol ? `${selectedSymbol} ${chartInterval.label}봉` : "종목을 검색해주세요"}
              </strong>
              <div className="segmented" aria-label="Chart interval">
                {CHART_INTERVALS.map((item) => (
                  <button
                    className={item.interval === chartInterval.interval ? "active" : ""}
                    key={item.interval}
                    onClick={() => setChartInterval(item)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <span className="label">{quote?.marketTime ?? ""}</span>
            </div>
            {selectedSymbol ? (
              <MarketChart candles={candles} />
            ) : (
              <div className="empty">국내 시총 상위 100개 종목을 한글명 또는 종목코드로 검색하세요.</div>
            )}
          </div>
          <div className="panel">
            <h2>보유 포지션</h2>
            {portfolio?.positions.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>수량</th>
                    <th>평단</th>
                    <th>평가손익</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.positions.map((position) => (
                    <tr key={position.symbol}>
                      <td>{position.symbol}</td>
                      <td>{position.quantity}</td>
                      <td>{money(position.averagePrice)}</td>
                      <td className={position.unrealizedPnl >= 0 ? "positive" : "negative"}>
                        {money(position.unrealizedPnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">아직 보유 종목이 없습니다.</div>
            )}
          </div>
        </section>

        <aside className="grid">
          <div className="panel">
            <h2>시장가 주문</h2>
            <div className="grid">
              <label>
                <span className="label">수량</span>
                <input
                  className="field"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  style={{ width: "100%", marginTop: 8 }}
                />
              </label>
              <div className="controls">
                <button className="button" disabled={isLoading} onClick={() => handleOrder("BUY")}>
                  매수
                </button>
                <button
                  className="button danger"
                  disabled={isLoading}
                  onClick={() => handleOrder("SELL")}
                >
                  매도
                </button>
              </div>
              {message ? <p className="subtitle">{message}</p> : null}
            </div>
          </div>

          <div className="panel">
            <h2>거래 내역</h2>
            {portfolio?.trades.length ? (
              <table className="table">
                <tbody>
                  {portfolio.trades.slice(0, 8).map((trade) => (
                    <tr key={trade.id}>
                      <td>{trade.side}</td>
                      <td>{trade.symbol}</td>
                      <td>{trade.quantity}</td>
                      <td>{money(trade.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">체결된 주문이 없습니다.</div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={["value", tone].filter(Boolean).join(" ")}>{value}</div>
    </div>
  );
}

function QuoteMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="quote-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

function percent(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "percent",
    maximumFractionDigits: 2
  }).format(value);
}

function signedMoney(value: number | undefined, currency = "USD") {
  if (value === undefined) {
    return "-";
  }

  const formatted = money(Math.abs(value), currency);
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatted}`;
}

function signedPercent(value: number | undefined) {
  if (value === undefined) {
    return "";
  }

  const formatted = `${Math.abs(value).toFixed(2)}%`;
  return `(${value > 0 ? "+" : value < 0 ? "-" : ""}${formatted})`;
}

function quoteTone(quote: MarketQuote | null) {
  if (!quote?.change) {
    return undefined;
  }

  return quote.change > 0 ? "positive" : "negative";
}

function formatNumber(value: number | undefined) {
  if (value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("ko-KR").format(value);
}
