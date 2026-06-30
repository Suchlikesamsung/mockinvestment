import { Module } from "@nestjs/common";
import { MarketDataModule } from "../market-data/market-data.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { TradingController } from "./trading.controller.js";
import { TradingService } from "./trading.service.js";

@Module({
  imports: [MarketDataModule, PrismaModule],
  controllers: [TradingController],
  providers: [TradingService]
})
export class TradingModule {}
