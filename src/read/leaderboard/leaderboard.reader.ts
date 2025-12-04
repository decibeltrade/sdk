import { constructKnownQueryParams } from "../../utils";
import { BaseReader } from "../base-reader";
import { LeaderboardRequestArgs, LeaderboardSchema } from "./leaderboard.types";

export class LeaderboardReader extends BaseReader {
  /**
   * Get the leaderboard
   * @param queryParams The query parameters for the leaderboard
   * @returns The leaderboard
   */
  async getLeaderboard({ fetchOptions, ...args }: LeaderboardRequestArgs) {
    const response = await this.getRequest({
      schema: LeaderboardSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/leaderboard`,
      queryParams: constructKnownQueryParams(args),
      options: fetchOptions,
    });

    return response.data;
  }
}
