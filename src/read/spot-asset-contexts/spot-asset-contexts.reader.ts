import { BaseReader, BaseRequestArgs } from "../base-reader";
import { SpotAssetContextsSchema } from "./spot-asset-contexts.types";

export class SpotAssetContextsReader extends BaseReader {
  /**
   * Get 24h stats + current price snapshot for every registered spot market
   * @returns One row per spot market
   */
  async getAll({ fetchOptions }: BaseRequestArgs = {}) {
    const response = await this.getRequest({
      schema: SpotAssetContextsSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/spot/asset_contexts`,
      options: fetchOptions,
    });

    return response.data;
  }
}
