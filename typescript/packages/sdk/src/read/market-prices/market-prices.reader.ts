import { getMarketAddr } from "../../utils";
import { BaseReader, BaseRequestArgs } from "../base-reader";
import {
  MarketPricesByNameRequestArgs,
  MarketPricesSchema,
  MarketPriceWsMessage,
  MarketPriceWsMessageSchema,
} from "./market-prices.types";

export class MarketPricesReader extends BaseReader {
  async getAll({ fetchOptions }: BaseRequestArgs = {}) {
    const response = await this.getRequest({
      schema: MarketPricesSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/prices`,
      options: fetchOptions,
    });
    return response.data;
  }

  /**
   * Get the price data for a given market
   * @param marketName The name of the market to get prices for
   * @returns The price data for the given market
   */
  async getByName({ marketName, fetchOptions }: MarketPricesByNameRequestArgs) {
    const marketAddr = getMarketAddr(marketName, this.deps.config.deployment.perpEngineGlobal);

    const response = await this.getRequest({
      schema: MarketPricesSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/prices`,
      queryParams: { market: marketAddr.toString() },
      options: fetchOptions,
    });
    return response.data;
  }

  /**
   * Subscribe to price updates for a market
   * @param marketName The name of the market to subscribe to
   * @param onData Callback function for received price data
   * @returns A function to unsubscribe from the oracle price updates
   */
  subscribeByName(marketName: string, onData: (data: MarketPriceWsMessage) => void) {
    const marketAddr = getMarketAddr(marketName, this.deps.config.deployment.perpEngineGlobal);
    const topic = `market_price:${marketAddr}`;

    return this.deps.ws.subscribe(topic, MarketPriceWsMessageSchema, onData);
  }

  /**
   * Subscribe to price updates for a market
   * @param marketAddr The address of the market to subscribe to
   * @param onData Callback function for received price data
   * @returns A function to unsubscribe from the oracle price updates
   */
  subscribeByAddress(marketAddr: string, onData: (data: MarketPriceWsMessage) => void) {
    const topic = `market_price:${marketAddr}`;

    return this.deps.ws.subscribe(topic, MarketPriceWsMessageSchema, onData);
  }
}
