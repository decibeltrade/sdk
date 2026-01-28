import { BaseReader } from "../base-reader";
import { UserTwapHistoryRequestArgs, UserTwapHistorySchema } from "./user-twap-history.types";

export class UserTwapHistoryReader extends BaseReader {
  /**
   * Get the TWAP order history for a given user
   * @param subAddr The subaccount address of the user to get TWAP history for
   * @param limit The number of TWAPs to get (default: 100, max: 200)
   * @param offset The offset for pagination (default: 0)
   * @returns The TWAP history for the given user including completed and cancelled orders
   */
  async getByAddr({ subAddr, limit = 100, offset = 0, fetchOptions }: UserTwapHistoryRequestArgs) {
    const response = await this.getRequest({
      schema: UserTwapHistorySchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/twap_history`,
      queryParams: { account: subAddr, limit: limit.toString(), offset: offset.toString() },
      options: fetchOptions,
    });

    return response.data;
  }
}
