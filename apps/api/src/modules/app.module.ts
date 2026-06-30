import { Module } from "@nestjs/common";
import { MarketDataModule } from "./market-data/market-data.module.js";
import { TradingModule } from "./trading/trading.module.js";

@Module({
  imports: [MarketDataModule, TradingModule]
})
export class AppModule {}
