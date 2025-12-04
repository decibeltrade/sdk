import { getMarketAddr } from "../../utils";
import { BaseReader } from "../base-reader";
import {
  CandlestickInterval,
  CandlesticksRequestArgs,
  CandlesticksSchema,
  CandlestickWsMessage,
  CandlestickWsMessageSchema,
} from "./candlesticks.types";

export class CandlesticksReader extends BaseReader {
  /**
   * Get the candlestick data points for a given market during a given time period
   * @param marketName The name of the market to get candlestick data for
   * @param interval The time interval of the candlestick data points
   * @param startTime The start time of the candlestick data points
   * @param endTime The end time of the candlestick data points
   * @returns The candlestick data points for the given market during the given time period
   */
  async getByName({
    marketName,
    interval,
    startTime,
    endTime,
    fetchOptions,
  }: CandlesticksRequestArgs) {
    const marketAddr = getMarketAddr(marketName, this.deps.config.deployment.perpEngineGlobal);

    const response = await this.getRequest({
      schema: CandlesticksSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/candlesticks`,
      queryParams: {
        market: marketAddr.toString(),
        interval,
        startTime: startTime.toString(),
        endTime: endTime.toString(),
      },
      options: fetchOptions,
    });

    return response.data;
  }

  /**
   * Subscribe to candlestick data points for a given market
   * @param marketName The name of the market to subscribe to
   * @param interval The time interval of the candlestick data points
   * @param onData Callback function for received candlestick data points
   * @returns A function to unsubscribe from the candlestick updates
   */
  subscribeByName(
    marketName: string,
    interval: CandlestickInterval,
    onData: (data: CandlestickWsMessage) => void,
  ) {
    const marketAddr = getMarketAddr(marketName, this.deps.config.deployment.perpEngineGlobal);
    const topic = `market_candlestick:${marketAddr}:${interval}`;

    return this.deps.ws.subscribe(topic, CandlestickWsMessageSchema, onData);
  }
}
