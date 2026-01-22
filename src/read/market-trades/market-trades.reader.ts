import { getMarketAddr } from "../../utils";
import { BaseReader } from "../base-reader";
import {
  MarketTradesHistorySchema,
  MarketTradesRequestArgs,
  MarketTradeWsMessage,
  MarketTradeWsMessageSchema,
} from "./market-trades.types";

export class MarketTradesReader extends BaseReader {
  /**
   * Get the latest market trades for a given market
   * @param marketName The name of the market to get market trades for
   * @param limit The number of market trades to get
   * @returns The market trades for the given market
   */
  async getByName({ marketName, limit, fetchOptions }: MarketTradesRequestArgs) {
    const marketAddr = getMarketAddr(marketName, this.deps.config.deployment.perpEngineGlobal);
    const queryParams = new URLSearchParams({ market: marketAddr.toString() });
    if (limit !== undefined) {
      queryParams.set("limit", limit.toString());
    }

    const response = await this.getRequest({
      schema: MarketTradesHistorySchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/trades`,
      queryParams,
      options: fetchOptions,
    });

    return response.data.items;
  }

  /**
   * Subscribe to the latest market trades for a given market
   * @param marketName The name of the market to subscribe to
   * @param onData Callback function for received market trades data
   * @returns A function to unsubscribe from the market trades updates
   */
  subscribeByName(marketName: string, onData: (data: MarketTradeWsMessage) => void) {
    const marketAddr = getMarketAddr(marketName, this.deps.config.deployment.perpEngineGlobal);
    const topic = `trades:${marketAddr}`;

    return this.deps.ws.subscribe(topic, MarketTradeWsMessageSchema, onData);
  }
}
