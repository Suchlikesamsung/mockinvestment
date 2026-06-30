import { Body, Controller, Get, Post } from "@nestjs/common";
import type { PlaceOrderRequest } from "@githubwatch/shared";
import { TradingService } from "./trading.service.js";

@Controller("trading")
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Get("portfolio")
  portfolio() {
    return this.tradingService.getPortfolio();
  }

  @Post("orders")
  placeOrder(@Body() request: PlaceOrderRequest) {
    return this.tradingService.placeOrder(request);
  }
}
