PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "Asset" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "symbol" TEXT NOT NULL UNIQUE,
  "code" TEXT NOT NULL,
  "nameKo" TEXT NOT NULL,
  "nameEn" TEXT,
  "market" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "marketCap" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Asset_code_idx" ON "Asset"("code");
CREATE INDEX IF NOT EXISTS "Asset_nameKo_idx" ON "Asset"("nameKo");
CREATE INDEX IF NOT EXISTS "Asset_market_idx" ON "Asset"("market");
CREATE INDEX IF NOT EXISTS "Asset_rank_idx" ON "Asset"("rank");

CREATE TABLE IF NOT EXISTS "Portfolio" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "cash" DECIMAL NOT NULL,
  "initialCash" DECIMAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Position" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "portfolioId" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "quantity" DECIMAL NOT NULL,
  "averagePrice" DECIMAL NOT NULL,
  "marketPrice" DECIMAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Position_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Position_portfolioId_symbol_key" ON "Position"("portfolioId", "symbol");
CREATE INDEX IF NOT EXISTS "Position_symbol_idx" ON "Position"("symbol");

CREATE TABLE IF NOT EXISTS "Order" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "portfolioId" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "side" TEXT NOT NULL,
  "quantity" DECIMAL NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Order_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Order_portfolioId_createdAt_idx" ON "Order"("portfolioId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_symbol_idx" ON "Order"("symbol");

CREATE TABLE IF NOT EXISTS "Trade" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "portfolioId" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "side" TEXT NOT NULL,
  "price" DECIMAL NOT NULL,
  "quantity" DECIMAL NOT NULL,
  "fee" DECIMAL NOT NULL,
  "priceSource" TEXT NOT NULL,
  "marketTime" DATETIME,
  "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Trade_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Trade_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Trade_portfolioId_executedAt_idx" ON "Trade"("portfolioId", "executedAt");
CREATE INDEX IF NOT EXISTS "Trade_symbol_idx" ON "Trade"("symbol");
