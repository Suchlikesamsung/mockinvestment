import { Controller, Get, Param, Query } from "@nestjs/common";
import { SUPPORTED_INTERVALS, type SupportedInterval } from "@githubwatch/shared";
import { MarketDataService } from "./market-data.service.js";

@Controller("market-data")
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get("search")
  search(@Query("q") query = "") {
    return this.marketDataService.searchSymbols(query);
  }

  @Get("quotes/:symbol")
  quote(@Param("symbol") symbol: string) {
    return this.marketDataService.getQuote(symbol);
  }

  @Get("candles/:symbol")
  candles(
    @Param("symbol") symbol: string,
    @Query("interval") interval: SupportedInterval = "1m",
    @Query("range") range = "1d"
  ) {
    const safeInterval = SUPPORTED_INTERVALS.includes(interval) ? interval : "1m";
    return this.marketDataService.getCandles(symbol, safeInterval, range);
  }
}
