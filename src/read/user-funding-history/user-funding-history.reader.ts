import { BaseReader } from "../base-reader";
import {
  UserFundingHistoryRequestArgs,
  UserFundingHistorySchema,
} from "./user-funding-history.types";

export class UserFundingHistoryReader extends BaseReader {
  /**
   * Get the trade history for a given user
   * @param subAddr The subaccount address of the user to get trade history for
   * @param limit The number of trades to get (default: 10)
   * @param offset The offset for pagination (default: 0)
   * @returns The trade history for the given user
   */
  async getByAddr({
    subAddr,
    limit = 10,
    offset = 0,
    fetchOptions,
  }: UserFundingHistoryRequestArgs) {
    const response = await this.getRequest({
      schema: UserFundingHistorySchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/funding_rate_history`,
      queryParams: { account: subAddr, limit: limit.toString(), offset: offset.toString() },
      options: fetchOptions,
    });

    return response.data;
  }
}
