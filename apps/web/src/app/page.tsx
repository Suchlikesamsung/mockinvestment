"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  AssetSearchResult,
  MarketCandle,
  MarketQuote,
  Portfolio,
  SupportedInterval
} from "@githubwatch/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bell,
  Bot,
  CircleDollarSign,
  LayoutDashboard,
  ListChecks,
  PieChart,
  Search,
  Sparkles,
  Star,
  Trophy,
  Wallet
} from "lucide-react";
import { MarketChart } from "../components/MarketChart";
import { getCandles, getPortfolio, getQuote, placeOrder, searchSymbols } from "../lib/api";

type AppTab = "dashboard" | "trading" | "ai" | "ranking";

const CHART_INTERVALS: Array<{
  label: string;
  interval: SupportedInterval;
  range: string;
  refreshMs: number;
}> = [
  { label: "1D", interval: "1m", range: "1d", refreshMs: 60_000 },
  { label: "1W", interval: "5m", range: "5d", refreshMs: 5 * 60_000 },
  { label: "1M", interval: "60m", range: "1m", refreshMs: 60 * 60_000 },
  { label: "1Y", interval: "1d", range: "1y", refreshMs: 24 * 60 * 60_000 }
];

const DASHBOARD_HOLDINGS = [
  { symbol: "005930.KS", name: "삼성전자", averagePrice: "71,200", price: "74,800", pnl: 180000, rate: 5.1 },
  { symbol: "000660.KS", name: "SK하이닉스", averagePrice: "221,500", price: "241,500", pnl: 142000, rate: 7.6 },
  { symbol: "035720.KS", name: "카카오", averagePrice: "41,500", price: "43,100", pnl: 192000, rate: 3.9 },
  { symbol: "207940.KS", name: "삼성바이오로직스", averagePrice: "936,000", price: "912,000", pnl: -155000, rate: -3.2 }
];

const WATCHLIST = [
  { name: "SK하이닉스", price: "241,500", rate: 2.1 },
  { name: "삼성전자", price: "340,500", rate: 5.4 },
  { name: "카카오", price: "34,900", rate: -0.8 }
];

export default function Home() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AppTab>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AssetSearchResult | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [chartInterval, setChartInterval] = useState(CHART_INTERVALS[0]);
  const [message, setMessage] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery.trim(), 180);

  const portfolioQuery = useQuery({
    queryKey: ["portfolio"],
    queryFn: getPortfolio
  });

  const searchQueryResult = useQuery({
    queryKey: ["asset-search", debouncedSearchQuery],
    queryFn: () => searchSymbols(debouncedSearchQuery),
    enabled: debouncedSearchQuery.length > 0,
    staleTime: 5 * 60_000
  });

  const quoteQuery = useQuery({
    queryKey: ["quote", selectedSymbol],
    queryFn: () => getQuote(selectedSymbol),
    enabled: selectedSymbol.length > 0,
    refetchInterval: selectedSymbol ? chartInterval.refreshMs : false
  });

  const candlesQuery = useQuery({
    queryKey: ["candles", selectedSymbol, chartInterval.interval, chartInterval.range],
    queryFn: () => getCandles(selectedSymbol, chartInterval.interval, chartInterval.range),
    enabled: selectedSymbol.length > 0,
    refetchInterval: selectedSymbol ? chartInterval.refreshMs : false
  });

  const orderMutation = useMutation({
    mutationFn: (side: "BUY" | "SELL") =>
      placeOrder({
        portfolioId: "demo",
        symbol: selectedSymbol,
        side,
        quantity
      }),
    onMutate: () => {
      setMessage("");
    },
    onSuccess: async (_, side) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["portfolio"] }),
        queryClient.invalidateQueries({ queryKey: ["quote", selectedSymbol] }),
        queryClient.invalidateQueries({ queryKey: ["candles", selectedSymbol] })
      ]);
      setMessage(`${side === "BUY" ? "매수" : "매도"} 주문이 체결되었습니다.`);
    },
    onError: (error) => {
      setMessage(errorMessage(error, "주문에 실패했습니다."));
    }
  });

  const portfolio = portfolioQuery.data ?? null;
  const quote = quoteQuery.data ?? null;
  const candles = candlesQuery.data ?? [];
  const searchResults = selectedAsset ? [] : searchQueryResult.data ?? [];
  const viewMessage =
    message ||
    errorMessage(portfolioQuery.error, "") ||
    errorMessage(quoteQuery.error, "") ||
    errorMessage(candlesQuery.error, "");

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSelectedAsset(null);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (portfolioQuery.error) {
      setMessage("포트폴리오를 불러오지 못했습니다.");
    }
  }, [portfolioQuery.error]);

  const dashboardTotalValue = portfolio?.totalValue ?? 12_840_000;
  const dashboardTotalPnl = portfolio?.totalPnl || 355_000;
  const dashboardPnlRate = portfolio?.totalPnlRate || 0.0284;

  const holdings = useMemo(() => {
    if (!portfolio?.positions.length) {
      return DASHBOARD_HOLDINGS;
    }

    return portfolio.positions.map((position) => ({
      symbol: position.symbol,
      name: position.symbol,
      averagePrice: compactNumber(position.averagePrice),
      price: compactNumber(position.marketPrice),
      pnl: Math.round(position.unrealizedPnl),
      rate: position.unrealizedPnlRate * 100
    }));
  }, [portfolio]);

  async function handleSymbolSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const asset = selectedAsset ?? searchQueryResult.data?.[0];

    if (!asset) {
      setMessage("자산 마스터에 등록된 국내 종목을 검색해주세요.");
      return;
    }

    selectAsset(asset);
  }

  function handleSearchChange(query: string) {
    setSearchQuery(query);

    if (selectedAsset && query !== assetInputLabel(selectedAsset)) {
      setSelectedAsset(null);
    }
  }

  function selectAsset(asset: AssetSearchResult) {
    setSelectedAsset(asset);
    setSearchQuery(assetInputLabel(asset));
    setSelectedSymbol(asset.symbol);
    setActiveTab("trading");
    setMessage("");
  }

  function handleOrder(side: "BUY" | "SELL") {
    if (!selectedSymbol) {
      setMessage("먼저 종목을 선택해주세요.");
      return;
    }

    orderMutation.mutate(side);
  }

  return (
    <main className="app-page">
      <div className="app-shell">
        <header className="app-nav">
          <div className="brand">
            <span className="brand-mark">
              <Activity size={16} strokeWidth={2.2} />
            </span>
            <strong>Paper</strong>
          </div>
          <nav className="tabs" aria-label="Main navigation">
            <button className={activeTab === "dashboard" ? "active" : ""} onClick={() => setActiveTab("dashboard")}>
              대시보드
            </button>
            <button className={activeTab === "trading" ? "active" : ""} onClick={() => setActiveTab("trading")}>
              트레이딩
            </button>
            <button className="todo" onClick={() => setActiveTab("ai")}>
              AI 대결
            </button>
            <button className="todo" onClick={() => setActiveTab("ranking")}>
              랭킹
            </button>
          </nav>
          <div className="nav-actions">
            <button className="nav-icon-button" type="button" aria-label="알림">
              <Bell size={18} strokeWidth={2} />
            </button>
            <span className="avatar">JK</span>
          </div>
        </header>

        {activeTab === "dashboard" ? (
          <Dashboard
            totalValue={dashboardTotalValue}
            totalPnl={dashboardTotalPnl}
            pnlRate={dashboardPnlRate}
            holdings={holdings}
          />
        ) : null}

        {activeTab === "trading" ? (
          <TradingWorkspace
            candles={candles}
            chartInterval={chartInterval}
            isLoading={orderMutation.isPending}
            message={viewMessage}
            portfolio={portfolio}
            quantity={quantity}
            quote={quote}
            searchQuery={searchQuery}
            searchResults={searchResults}
            selectedAsset={selectedAsset}
            selectedSymbol={selectedSymbol}
            onIntervalChange={setChartInterval}
            onOrder={handleOrder}
            onQuantityChange={setQuantity}
            onSearchChange={handleSearchChange}
            onSearchSubmit={handleSymbolSubmit}
            onSelectAsset={selectAsset}
          />
        ) : null}

        {activeTab === "ai" || activeTab === "ranking" ? (
          <TodoScreen title={activeTab === "ai" ? "AI 대결" : "랭킹"} />
        ) : null}
      </div>
    </main>
  );
}

function Dashboard({
  totalValue,
  totalPnl,
  pnlRate,
  holdings
}: {
  totalValue: number;
  totalPnl: number;
  pnlRate: number;
  holdings: Array<{
    symbol: string;
    name: string;
    averagePrice: string;
    price: string;
    pnl: number;
    rate: number;
  }>;
}) {
  return (
    <section className="dashboard-grid">
      <KpiCard icon={<Wallet size={17} />} label="총 평가자산" value={won(totalValue)} detail="▲ 2.84% 오늘" tone="positive" />
      <KpiCard icon={<CircleDollarSign size={17} />} label="총 평가손익" value={signedWon(totalPnl)} detail={`수익률 ${signedPercent(pnlRate * 100)}`} tone={totalPnl >= 0 ? "positive" : "negative"} />
      <KpiCard icon={<ListChecks size={17} />} label="실현 손익" value="+120,000" detail="이번 달" tone="positive" />
      <KpiCard icon={<Trophy size={17} />} label="전체 랭킹" value="#142" detail="▲ 18 · 상위 8%" tone="positive" />

      <section className="dashboard-card asset-trend">
        <div className="card-heading">
          <h2>
            <LayoutDashboard size={17} />
            자산 추이
          </h2>
          <span>1M · 3M · 1Y · 전체</span>
        </div>
        <TrendLine />
      </section>

      <section className="dashboard-card allocation-card">
        <h2>
          <PieChart size={17} />
          자산 배분
        </h2>
        <div className="allocation-bar">
          <span style={{ width: "33%", background: "#2e90fa" }} />
          <span style={{ width: "18%", background: "#12b76a" }} />
          <span style={{ width: "16%", background: "#f04438" }} />
          <span style={{ width: "12%", background: "#7a5af8" }} />
          <span style={{ width: "21%", background: "#c7c7c7" }} />
        </div>
        <AllocationRow color="#2e90fa" label="삼성전자" value="33%" />
        <AllocationRow color="#12b76a" label="SK하이닉스" value="18%" />
        <AllocationRow color="#f04438" label="카카오" value="16%" />
        <AllocationRow color="#7a5af8" label="삼성바이오" value="12%" />
        <AllocationRow color="#c7c7c7" label="현금" value="21%" />
      </section>

      <section className="dashboard-card holdings-card">
        <div className="card-heading">
          <h2>
            <ListChecks size={17} />
            보유 종목
          </h2>
          <span>{holdings.length}개 종목</span>
        </div>
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>종목</th>
              <th>평단</th>
              <th>현재가</th>
              <th>평가손익</th>
              <th>수익률</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding) => (
              <tr key={holding.symbol}>
                <td>{holding.name}</td>
                <td>{holding.averagePrice}</td>
                <td>{holding.price}</td>
                <td className={holding.pnl >= 0 ? "positive" : "negative"}>{signedWon(holding.pnl)}</td>
                <td className={holding.rate >= 0 ? "positive" : "negative"}>{signedPercent(holding.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="dashboard-card watch-card">
        <h2>
          <Star size={17} />
          관심 종목
        </h2>
        {WATCHLIST.map((item) => (
          <div className="watch-row" key={item.name}>
            <span>{item.name}</span>
            <strong className={item.rate >= 0 ? "positive" : "negative"}>
              {item.price} {signedPercent(item.rate)}
            </strong>
          </div>
        ))}
      </section>

      <section className="dashboard-card ai-briefing-card">
        <div className="card-heading">
          <h2>
            <Bot size={17} />
            AI 시장 브리핑
          </h2>
          <span>08:30</span>
        </div>
        <div className="coming-soon-badge">
          <Sparkles size={14} />
          다음 버전에 제공 예정
        </div>
        <div className="blurred-briefing">
          반도체 강세로 코스피가 상승 출발했습니다. 보유 종목과 시장 흐름을 요약하고 다음 행동
          후보를 제안하는 브리핑은 다음 버전에 제공 예정입니다.
        </div>
        <div className="briefing-actions">
          <button disabled>전략 가이드</button>
          <button disabled>AI와 대결</button>
        </div>
      </section>
    </section>
  );
}

function TradingWorkspace(props: {
  candles: MarketCandle[];
  chartInterval: (typeof CHART_INTERVALS)[number];
  isLoading: boolean;
  message: string;
  portfolio: Portfolio | null;
  quantity: number;
  quote: MarketQuote | null;
  searchQuery: string;
  searchResults: AssetSearchResult[];
  selectedAsset: AssetSearchResult | null;
  selectedSymbol: string;
  onIntervalChange: (interval: (typeof CHART_INTERVALS)[number]) => void;
  onOrder: (side: "BUY" | "SELL") => void;
  onQuantityChange: (quantity: number) => void;
  onSearchChange: (query: string) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSelectAsset: (asset: AssetSearchResult) => void;
}) {
  const [orderSide, setOrderSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"LIMIT" | "MARKET" | "RESERVE">("LIMIT");
  const displayName = props.selectedAsset?.name ?? props.quote?.name ?? "종목을 검색해주세요";
  const displayCode = props.selectedAsset?.code ?? props.selectedSymbol.split(".")[0] ?? "";
  const displayMarket = props.selectedAsset?.market ?? props.quote?.exchange ?? "";
  const currentPrice = props.quote?.price ?? 74800;
  const change = props.quote?.change ?? 3600;
  const changePercent = props.quote?.changePercent ?? 5.06;
  const orderAmount = currentPrice * props.quantity;
  const availableCash = props.portfolio?.cash ?? 4_200_000;
  const fee = Math.floor(orderAmount * 0.00015);

  return (
    <section className="trading-layout">
      <div className="trading-top">
        <section className="trading-search-card">
          <form className="search-form" onSubmit={props.onSearchSubmit}>
            <div className="search-box">
              <Search className="search-icon" size={17} strokeWidth={2} aria-hidden="true" />
              <input
                className="field"
                value={props.searchQuery}
                onChange={(event) => props.onSearchChange(event.target.value)}
                placeholder="삼성전자 또는 005930"
                aria-label="Asset search"
                autoComplete="off"
              />
              {props.searchResults.length ? (
                <div className="autocomplete" role="listbox">
                  {props.searchResults.map((result) => (
                    <button
                      key={result.symbol}
                      onClick={() => props.onSelectAsset(result)}
                      role="option"
                      type="button"
                    >
                      <strong>{result.name}</strong>
                      <span>{result.code}</span>
                      <small>{[result.market, `#${result.rank}`, result.symbol].filter(Boolean).join(" · ")}</small>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button className="favorite-button" type="button">
              <Star size={17} />
              관심
            </button>
          </form>
        </section>

        <section className="trading-symbol-head">
          <div className="symbol-title">
            <h1>{displayName}</h1>
            {displayCode ? <span>{displayCode} · {displayMarket}</span> : null}
          </div>
          <div className={["symbol-price", change >= 0 ? "positive" : "negative"].join(" ")}>
            <strong>{compactNumber(currentPrice)}</strong>
            <span>
              {signedWon(change)} ({signedPercent(changePercent)})
            </span>
          </div>
        </section>

        <div className="symbol-meta-row">
          <QuotePill label="시가" value={compactNumber(props.quote?.open ?? 71400)} />
          <QuotePill label="고가" value={compactNumber(props.quote?.dayHigh ?? 75100)} tone="positive" />
          <QuotePill label="저가" value={compactNumber(props.quote?.dayLow ?? 71200)} tone="negative" />
          <QuotePill label="거래량" value={formatCompactVolume(props.quote?.volume ?? 18_200_000)} />
          <QuotePill label="시총" value="446조" />
        </div>
      </div>

      <section className="trading-chart-card">
        <div className="chart-toolbar">
          <div className="range-tabs">
            {CHART_INTERVALS.map((item) => (
              <button
                className={item.interval === props.chartInterval.interval ? "active" : ""}
                key={item.label}
                onClick={() => props.onIntervalChange(item)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="chart-legend">
            <span className="ma-line" />
            MA5
            <span>캔들</span>
          </div>
        </div>
        {props.selectedSymbol ? (
          <MarketChart candles={props.candles} />
        ) : (
          <div className="empty">국내 시총 상위 100개 종목을 한글명 또는 종목코드로 검색하세요.</div>
        )}
      </section>

      <section className="orderbook-card">
        <h2>호가</h2>
        <OrderBook price={currentPrice} changePercent={changePercent} />
      </section>

      <section className="order-ticket-card">
        <div className="side-tabs">
          <button className={orderSide === "BUY" ? "active buy" : ""} onClick={() => setOrderSide("BUY")} type="button">
            매수
          </button>
          <button className={orderSide === "SELL" ? "active sell" : ""} onClick={() => setOrderSide("SELL")} type="button">
            매도
          </button>
        </div>

        <div className="order-type-tabs">
          <button className={orderType === "LIMIT" ? "active" : ""} onClick={() => setOrderType("LIMIT")} type="button">
            지정가
          </button>
          <button className={orderType === "MARKET" ? "active" : ""} onClick={() => setOrderType("MARKET")} type="button">
            시장가
          </button>
          <button className={orderType === "RESERVE" ? "active" : ""} onClick={() => setOrderType("RESERVE")} type="button">
            예약
          </button>
        </div>

        <label className="order-field">
          <span>주문가격</span>
          <div className="stepper-field">
            <button type="button">−</button>
            <input value={compactNumber(currentPrice)} readOnly />
            <button type="button">+</button>
          </div>
        </label>

        <label className="order-field">
          <span>수량</span>
          <input
            className="ticket-input"
            type="number"
            min={1}
            value={props.quantity}
            onChange={(event) => props.onQuantityChange(Number(event.target.value))}
          />
        </label>

        <div className="quick-ratio">
          <button type="button">10%</button>
          <button type="button">25%</button>
          <button type="button">50%</button>
          <button type="button">최대</button>
        </div>

        <dl className="order-summary">
          <div>
            <dt>주문가능</dt>
            <dd>{money(availableCash)}</dd>
          </div>
          <div>
            <dt>예상 체결금액</dt>
            <dd>{money(orderAmount)}</dd>
          </div>
          <div>
            <dt>수수료 (0.015%)</dt>
            <dd>{money(fee)}</dd>
          </div>
        </dl>

        <button
          className={orderSide === "BUY" ? "submit-order buy" : "submit-order sell"}
          disabled={props.isLoading}
          onClick={() => props.onOrder(orderSide)}
          type="button"
        >
          {orderSide === "BUY" ? "매수 주문" : "매도 주문"}
        </button>
        {props.message ? <p className="ticket-message">{props.message}</p> : null}
      </section>

      <section className="pending-card">
        <div className="pending-tabs">
          <button className="active" type="button">미체결 2</button>
          <button type="button">체결 내역</button>
          <button type="button">이 종목 보유</button>
        </div>
        <table className="pending-table">
          <thead>
            <tr>
              <th>구분</th>
              <th>주문가</th>
              <th>수량</th>
              <th>미체결</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="positive">매수</td>
              <td>74,500</td>
              <td>15</td>
              <td>15</td>
              <td>대기</td>
            </tr>
            <tr>
              <td className="negative">매도</td>
              <td>76,000</td>
              <td>30</td>
              <td>18</td>
              <td className="status-partial">부분체결</td>
            </tr>
          </tbody>
        </table>
      </section>
    </section>
  );
}

function QuotePill({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <span className="quote-pill">
      {label} <strong className={tone}>{value}</strong>
    </span>
  );
}

function OrderBook({ price, changePercent }: { price: number; changePercent: number }) {
  const askRows = [500, 400, 300, 200, 100].map((offset, index) => ({
    price: price + offset,
    volume: [1420, 2180, 1240, 3050, 880][index]
  }));
  const bidRows = [100, 200, 300, 400, 500].map((offset, index) => ({
    price: price - offset,
    volume: [1930, 1510, 2640, 1120, 760][index]
  }));

  return (
    <div className="orderbook">
      {askRows.map((row) => (
        <OrderBookRow key={row.price} side="ask" price={row.price} volume={row.volume} />
      ))}
      <div className="orderbook-mid">
        <strong>{compactNumber(price)}</strong>
        <span>{signedPercent(changePercent)}</span>
      </div>
      {bidRows.map((row) => (
        <OrderBookRow key={row.price} side="bid" price={row.price} volume={row.volume} />
      ))}
    </div>
  );
}

function OrderBookRow({ side, price, volume }: { side: "ask" | "bid"; price: number; volume: number }) {
  const width = Math.max(16, Math.min(92, volume / 34));

  return (
    <div className={["orderbook-row", side].join(" ")}>
      <span>{compactNumber(price)}</span>
      <div>
        <i style={{ width: `${width}%` }} />
        <strong>{formatNumber(volume)}</strong>
      </div>
    </div>
  );
}

function TodoScreen({ title }: { title: string }) {
  return (
    <section className="todo-screen dashboard-card">
      <h1>{title}</h1>
      <p>이 탭은 TODO입니다. 화면 설계와 핵심 거래/포트폴리오 흐름을 먼저 안정화한 뒤 연결합니다.</p>
    </section>
  );
}

function KpiCard({
  icon,
  label,
  value,
  detail,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "positive" | "negative";
}) {
  return (
    <section className="kpi-card">
      <span className="kpi-label">
        <i aria-hidden="true">{icon}</i>
        {label}
      </span>
      <strong>{value}</strong>
      <small className={tone}>{detail}</small>
    </section>
  );
}

function TrendLine() {
  return (
    <svg className="trend-svg" viewBox="0 0 520 190" role="img" aria-label="Asset trend">
      <defs>
        <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#b42318" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#b42318" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 150 L52 140 L104 145 L156 124 L208 132 L260 102 L312 110 L364 78 L416 86 L468 58 L520 48 L520 190 L0 190 Z" fill="url(#trendFill)" />
      <path d="M0 150 L52 140 L104 145 L156 124 L208 132 L260 102 L312 110 L364 78 L416 86 L468 58 L520 48" fill="none" stroke="#a61e22" strokeWidth="2" />
      <text x="0" y="184">6/1</text>
      <text x="250" y="184">6/15</text>
      <text x="486" y="184">오늘</text>
    </svg>
  );
}

function AllocationRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="allocation-row">
      <span style={{ background: color }} />
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function money(value: number, currency = "KRW") {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2
  }).format(value);
}

function won(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(value);
}

function signedWon(value: number) {
  const formatted = new Intl.NumberFormat("ko-KR").format(Math.abs(value));
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatted}`;
}

function signedPercent(value: number) {
  const formatted = `${Math.abs(value).toFixed(1)}%`;
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatted}`;
}

function formatNumber(value: number | undefined) {
  if (value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatCompactVolume(value: number) {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}억`;
  }

  if (value >= 10_000) {
    return `${(value / 10_000).toFixed(1)}만`;
  }

  return formatNumber(value);
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 1
  }).format(value);
}

function assetInputLabel(asset: AssetSearchResult) {
  return `${asset.name} (${asset.code})`;
}

function errorMessage(error: unknown, fallback: string) {
  if (!error) {
    return "";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debouncedValue;
}
