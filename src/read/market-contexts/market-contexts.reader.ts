import { BaseReader, BaseRequestArgs } from "../base-reader";
import { MarketContextsSchema } from "./market-contexts.types";

export class MarketContextsReader extends BaseReader {
  /**
   * Get the asset context for a given market
   *
   * // DEV NOTE: marketName is not supported by the API yet
   * // @param marketName The name of the market to get asset context for
   * @returns The asset context for the given market or all if no market name is provided
   */
  async getAll({ fetchOptions }: BaseRequestArgs = {}) {
    // const marketAddr = marketName
    //   ? getMarketAddr(marketName, this.config.deployment.perpEngineGlobal)
    //   : undefined;
    const response = await this.getRequest({
      schema: MarketContextsSchema,
      // TODO: Update this when the API is /market_contexts
      url: `${this.deps.config.tradingHttpUrl}/api/v1/asset_contexts`,
      // queryParams: marketAddr ? { market: marketAddr.toString() } : undefined,
      options: fetchOptions,
    });

    return response.data;
  }
}
