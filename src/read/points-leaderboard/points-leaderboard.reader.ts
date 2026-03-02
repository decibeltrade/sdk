import { constructKnownQueryParams } from "../../utils";
import { BaseReader } from "../base-reader";
import { PointsLeaderboardRequestArgs, PointsLeaderboardSchema } from "./points-leaderboard.types";

export class PointsLeaderboardReader extends BaseReader {
  /**
   * Get the points leaderboard (Hz/Amps rankings)
   * @param queryParams The query parameters for the points leaderboard
   * @returns The points leaderboard
   */
  async getPointsLeaderboard({ fetchOptions, tier, ...args }: PointsLeaderboardRequestArgs) {
    const queryParams = constructKnownQueryParams(args);
    if (tier) {
      queryParams.set("tier", tier);
    }

    const response = await this.getRequest({
      schema: PointsLeaderboardSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/points_leaderboard`,
      queryParams,
      options: fetchOptions,
    });

    return response.data;
  }
}
