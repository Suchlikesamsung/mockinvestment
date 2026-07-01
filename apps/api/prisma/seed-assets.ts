import { PrismaClient } from "@prisma/client";
import YahooFinance from "yahoo-finance2";

const prisma = new PrismaClient();
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"]
});

interface ScrapedAsset {
  code: string;
  nameKo: string;
  nameEn?: string;
  market: "KOSPI" | "KOSDAQ" | "NASDAQ";
  symbol: string;
  marketCap: number;
}

const MARKET_CONFIG = [
  { market: "KOSPI" as const, sosok: 0, suffix: "KS" },
  { market: "KOSDAQ" as const, sosok: 1, suffix: "KQ" }
];

async function main() {
  const koreanAssets: ScrapedAsset[] = [];

  for (const config of MARKET_CONFIG) {
    for (let page = 1; page <= 4; page += 1) {
      koreanAssets.push(...(await fetchKoreanMarketPage(config, page)));
    }
  }

  const topKoreanAssets = koreanAssets
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 100);
  const topNasdaqAssets = await fetchTopNasdaqAssets(100);

  await prisma.asset.updateMany({
    data: {
      isActive: false
    }
  });

  await upsertAssets(topKoreanAssets);
  await upsertAssets(topNasdaqAssets);

  console.log(
    `Seeded ${topKoreanAssets.length} Korean assets and ${topNasdaqAssets.length} NASDAQ assets by market cap.`
  );
}

async function fetchKoreanMarketPage(
  config: (typeof MARKET_CONFIG)[number],
  page: number
): Promise<ScrapedAsset[]> {
  const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=${config.sosok}&page=${page}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = new TextDecoder("euc-kr").decode(await response.arrayBuffer());
  const rows = html.match(/<tr\s+onMouseOver="mouseOver\(this\)"[\s\S]*?<\/tr>/g) ?? [];

  return rows
    .map((row) => parseRow(row, config))
    .filter((asset): asset is ScrapedAsset => asset !== null);
}

async function fetchTopNasdaqAssets(limit: number): Promise<ScrapedAsset[]> {
  const url = `https://api.nasdaq.com/api/screener/stocks?tableonly=true&exchange=nasdaq&download=true&limit=${limit * 5}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      Origin: "https://www.nasdaq.com",
      Referer: "https://www.nasdaq.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch NASDAQ screener: ${response.status}`);
  }

  const payload = (await response.json()) as NasdaqScreenerResponse;
  const rows = payload.data?.rows ?? [];

  const candidates = rows
    .map(parseNasdaqRow)
    .filter((asset): asset is ScrapedAsset => asset !== null)
    .sort((a, b) => b.marketCap - a.marketCap)
    .map((asset) => ({
      ...asset,
      market: "NASDAQ" as const
    }));

  const tradableAssets: ScrapedAsset[] = [];

  for (const asset of candidates) {
    if (tradableAssets.length >= limit) {
      break;
    }

    if (await hasYahooQuote(asset.symbol)) {
      tradableAssets.push(asset);
    }
  }

  return tradableAssets;
}

async function upsertAssets(assets: ScrapedAsset[]) {
  for (const [index, asset] of assets.entries()) {
    await prisma.asset.upsert({
      where: {
        symbol: asset.symbol
      },
      create: {
        ...asset,
        rank: index + 1
      },
      update: {
        code: asset.code,
        nameKo: asset.nameKo,
        nameEn: asset.nameEn,
        market: asset.market,
        marketCap: asset.marketCap,
        rank: index + 1,
        isActive: true
      }
    });
  }
}

function parseRow(
  row: string,
  config: (typeof MARKET_CONFIG)[number]
): ScrapedAsset | null {
  const codeMatch = row.match(/\/item\/main\.naver\?code=(\d{6})" class="tltle">([^<]+)<\/a>/);
  const numberMatches = [...row.matchAll(/<td class="number">([^<]+)<\/td>/g)].map((match) =>
    match[1].replace(/,/g, "").trim()
  );

  if (!codeMatch || numberMatches.length < 5) {
    return null;
  }

  const marketCapHundredMillion = Number(numberMatches[2]);

  return {
    code: codeMatch[1],
    nameKo: decodeHtml(codeMatch[2]),
    market: config.market,
    symbol: `${codeMatch[1]}.${config.suffix}`,
    marketCap: marketCapHundredMillion
  };
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

interface NasdaqScreenerResponse {
  data?: {
    rows?: NasdaqScreenerRow[];
  };
}

interface NasdaqScreenerRow {
  symbol?: string;
  name?: string;
  marketCap?: string;
}

function parseNasdaqRow(row: NasdaqScreenerRow): ScrapedAsset | null {
  const symbol = row.symbol?.trim().replace(/\//g, "-");
  const name = row.name?.trim();
  const marketCap = parseMarketCap(row.marketCap);

  if (!symbol || !name || marketCap <= 0) {
    return null;
  }

  return {
    code: symbol,
    nameKo: name,
    nameEn: name,
    market: "NASDAQ",
    symbol,
    marketCap
  };
}

function parseMarketCap(value: string | undefined) {
  if (!value || value === "N/A") {
    return 0;
  }

  const normalized = value.replace(/[$,\s]/g, "").toUpperCase();
  const multiplier = normalized.endsWith("T")
    ? 1_000_000_000_000
    : normalized.endsWith("B")
      ? 1_000_000_000
      : normalized.endsWith("M")
        ? 1_000_000
        : 1;
  const numeric = Number(normalized.replace(/[TBM]$/, ""));

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.round(numeric * multiplier);
}

async function hasYahooQuote(symbol: string) {
  try {
    const quote = await yahooFinance.quote(symbol);

    return (
      quote.quoteType === "EQUITY" &&
      quote.exchange === "NMS" &&
      Boolean(quote.regularMarketPrice ?? quote.postMarketPrice ?? quote.preMarketPrice)
    );
  } catch {
    return false;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
