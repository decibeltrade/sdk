import { getMarketAddr } from "../../utils";
import { BaseReader } from "../base-reader";
import {
  MarketDepth,
  MarketDepthAggregationSize,
  MarketDepthRequestArgs,
  MarketDepthSchema,
} from "./market-depth.types";

export class MarketDepthReader extends BaseReader {
  /**
   * Get the market depth data for a given market
   * @param marketName The name of the market to get market depth for
   * @returns The market depth data for the given market
   */
  async getByName({ marketName, limit, fetchOptions }: MarketDepthRequestArgs) {
    const marketAddr = getMarketAddr(marketName, this.deps.config.deployment.perpEngineGlobal);
    const queryParams = new URLSearchParams({ market: marketAddr.toString() });
    if (limit !== undefined) {
      queryParams.set("limit", limit.toString());
    }

    const response = await this.getRequest({
      schema: MarketDepthSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/depth`,
      queryParams,
      options: fetchOptions,
    });

    return response.data;
  }

  /**
   * Subscribe to market depth updates for a given market ID
   * @param marketName The name of the market to subscribe to
   * @param onData Callback function for received market depth data
   * @returns A function to unsubscribe from the market depth updates
   */
  subscribeByName(
    marketName: string,
    aggregationSize: MarketDepthAggregationSize,
    onData: (data: MarketDepth) => void,
  ) {
    const marketAddr = getMarketAddr(marketName, this.deps.config.deployment.perpEngineGlobal);
    const topic = `depth:${marketAddr}:${aggregationSize}`;

    return this.deps.ws.subscribe(topic, MarketDepthSchema, onData);
  }

  resetSubscriptionByName(marketName: string, aggregationSize: MarketDepthAggregationSize = 1) {
    const marketAddr = getMarketAddr(marketName, this.deps.config.deployment.perpEngineGlobal);
    const topic = `depth:${marketAddr}:${aggregationSize}`;

    this.deps.ws.reset(topic);
  }

  getAggregationSizes() {
    return [1, 2, 5, 10, 100, 1000] as const satisfies MarketDepthAggregationSize[];
  }
}
