import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module.js";
import { MarketDataController } from "./market-data.controller.js";
import { MarketDataService } from "./market-data.service.js";
import { MARKET_DATA_PROVIDER } from "./market-data.types.js";
import { YahooFinanceProvider } from "./yahoo-finance.provider.js";

@Module({
  imports: [PrismaModule],
  controllers: [MarketDataController],
  providers: [
    MarketDataService,
    YahooFinanceProvider,
    {
      provide: MARKET_DATA_PROVIDER,
      useExisting: YahooFinanceProvider
    }
  ],
  exports: [MarketDataService]
})
export class MarketDataModule {}
