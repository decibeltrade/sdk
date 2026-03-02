import { BaseReader } from "../base-reader";
import { GlobalPointsStatsRequestArgs, GlobalPointsStatsSchema } from "./global-points-stats.types";

export class GlobalPointsStatsReader extends BaseReader {
  async get({ fetchOptions }: GlobalPointsStatsRequestArgs = {}) {
    const response = await this.getRequest({
      schema: GlobalPointsStatsSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/points/global`,
      options: fetchOptions,
    });

    return response.data;
  }
}
