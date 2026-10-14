import { BaseReader } from "../base-reader";
import {
  TrendingMarketsRequestArgs,
  TrendingMarketsResponseSchema,
} from "./trending-markets.types";

export class TrendingMarketsReader extends BaseReader {
  /**
   * Get the server-curated Trending markets list (perp + spot, pre-ranked).
   */
  async getTrendingMarkets({ fetchOptions }: TrendingMarketsRequestArgs = {}) {
    const response = await this.getRequest({
      schema: TrendingMarketsResponseSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/trending_markets`,
      options: fetchOptions,
    });

    return response.data;
  }
}
