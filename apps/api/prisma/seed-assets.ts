import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ScrapedAsset {
  code: string;
  nameKo: string;
  market: "KOSPI" | "KOSDAQ";
  symbol: string;
  marketCap: number;
}

const MARKET_CONFIG = [
  { market: "KOSPI" as const, sosok: 0, suffix: "KS" },
  { market: "KOSDAQ" as const, sosok: 1, suffix: "KQ" }
];

async function main() {
  const assets: ScrapedAsset[] = [];

  for (const config of MARKET_CONFIG) {
    for (let page = 1; page <= 4; page += 1) {
      assets.push(...(await fetchMarketPage(config, page)));
    }
  }

  const topAssets = assets
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 100);

  await prisma.asset.updateMany({
    data: {
      isActive: false
    }
  });

  for (const [index, asset] of topAssets.entries()) {
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
        market: asset.market,
        marketCap: asset.marketCap,
        rank: index + 1,
        isActive: true
      }
    });
  }

  console.log(`Seeded ${topAssets.length} Korean assets by market cap.`);
}

async function fetchMarketPage(
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

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
