import { constructKnownQueryParams } from "../../utils";
import { BaseReader } from "../base-reader";
import { LeaderboardRequestArgs, LeaderboardSchema } from "./leaderboard.types";

export class LeaderboardReader extends BaseReader {
  /**
   * Get the leaderboard
   * @param queryParams The query parameters for the leaderboard
   * @returns The leaderboard
   */
  async getLeaderboard({ fetchOptions, window, ...args }: LeaderboardRequestArgs) {
    const queryParams = constructKnownQueryParams(args);
    // All time is the API's default; only a real window goes on the wire.
    if (window && window !== "all") queryParams.set("window", window);
    const response = await this.getRequest({
      schema: LeaderboardSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/leaderboard`,
      queryParams,
      options: fetchOptions,
    });

    return response.data;
  }
}
