import { BaseReader } from "../base-reader";
import { AccountStreaksRequestArgs, AccountStreaksSchema } from "./streaks.types";

export class StreaksReader extends BaseReader {
  /**
   * Get streak data for an owner including qualifying dates and grace days
   * @param ownerAddr The owner address to get streak data for
   * @returns The streak data with qualifying dates
   */
  async getByOwner({ ownerAddr, fetchOptions }: AccountStreaksRequestArgs) {
    const queryParams = new URLSearchParams({ owner: ownerAddr });

    const response = await this.getRequest({
      schema: AccountStreaksSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/streaks/account`,
      queryParams,
      options: fetchOptions,
    });

    return response.data;
  }
}
