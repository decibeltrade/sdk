import { BaseReader, BaseRequestArgs } from "../base-reader";
import { MarketActivitySchema } from "./market-activity.types";

export class MarketActivityReader extends BaseReader {
  /** Every perp market in one read: call once per screen and share it, not once per row. */
  async getAll({ fetchOptions }: BaseRequestArgs = {}) {
    const response = await this.getRequest({
      schema: MarketActivitySchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/market_activity`,
      options: fetchOptions,
    });

    return response.data;
  }
}
