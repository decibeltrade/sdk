import { getMarketAddrForProduct } from "../../utils";
import { AssetType } from "../asset-type.types";
import { BaseReader, BaseRequestArgs } from "../base-reader";
import {
  CandlestickInterval,
  CandlesticksRequestArgs,
  CandlesticksSchema,
  CandlestickWsMessage,
  CandlestickWsMessageSchema,
} from "./candlesticks.types";

export interface CandlesticksByAddrRequestArgs extends BaseRequestArgs {
  /** The market object address (e.g. `market_addr` from `/markets`). */
  marketAddr: string;
  interval: CandlestickInterval;
  startTime: number;
  endTime: number;
  hideOutliers?: boolean;
}

export class CandlesticksReader extends BaseReader {
  /**
   * Get the candlestick data points for a given market during a given time period.
   *
   * The market address is derived from the name per product (perp and spot
   * derive different addresses for the same name) — pass `assetType: "spot"`
   * for spot markets, or prefer {@link getByAddr} when you already hold the
   * market row.
   */
  async getByName({
    marketName,
    assetType = "perp",
    interval,
    startTime,
    endTime,
    hideOutliers,
    fetchOptions,
  }: CandlesticksRequestArgs) {
    const marketAddr = getMarketAddrForProduct(marketName, assetType, this.deps.config.deployment);
    return this.getByAddr({
      marketAddr: marketAddr.toString(),
      interval,
      startTime,
      endTime,
      hideOutliers,
      fetchOptions,
    });
  }

  /**
   * Get the candlestick data points by market object address — no name
   * derivation, product-agnostic.
   */
  async getByAddr({
    marketAddr,
    interval,
    startTime,
    endTime,
    hideOutliers,
    fetchOptions,
  }: CandlesticksByAddrRequestArgs) {
    const queryParams = new URLSearchParams({
      market: marketAddr,
      interval,
      startTime: startTime.toString(),
      endTime: endTime.toString(),
    });

    if (hideOutliers) {
      queryParams.set("filterWicks", "true");
      queryParams.set("nSigma", "3.0");
    }

    const response = await this.getRequest({
      schema: CandlesticksSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/candlesticks`,
      queryParams,
      options: fetchOptions,
    });

    return response.data;
  }

  /**
   * Subscribe to candlestick data points for a given market.
   * @param marketName The name of the market to subscribe to
   * @param interval The time interval of the candlestick data points
   * @param onData Callback function for received candlestick data points
   * @param assetType Product the name belongs to (default perp) — see {@link getByName}
   * @returns A function to unsubscribe from the candlestick updates
   */
  subscribeByName(
    marketName: string,
    interval: CandlestickInterval,
    onData: (data: CandlestickWsMessage) => void,
    assetType: AssetType = "perp",
  ) {
    const marketAddr = getMarketAddrForProduct(marketName, assetType, this.deps.config.deployment);
    return this.subscribeByAddr(marketAddr.toString(), interval, onData);
  }

  /** Subscribe to candlesticks by market object address — product-agnostic. */
  subscribeByAddr(
    marketAddr: string,
    interval: CandlestickInterval,
    onData: (data: CandlestickWsMessage) => void,
  ) {
    const topic = `market_candlestick:${marketAddr}:${interval}`;
    return this.deps.ws.subscribe(topic, CandlestickWsMessageSchema, onData);
  }
}
