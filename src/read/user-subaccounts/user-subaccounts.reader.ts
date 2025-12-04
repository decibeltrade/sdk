import { BaseReader } from "../base-reader";
import { UserSubaccountsRequestArgs, UserSubaccountsSchema } from "./user-subaccounts.types";

export class UserSubaccountsReader extends BaseReader {
  /**
   * Get the subaccounts for a given user
   * @param ownerAddr The address of the owner to get subaccounts for
   * @param limit The number of subaccounts to get (default: 10)
   * @returns The subaccounts for the given user
   */
  async getByAddr({
    ownerAddr,
    // limit = 10,
    fetchOptions,
  }: UserSubaccountsRequestArgs) {
    const queryParams = new URLSearchParams({
      owner: ownerAddr,
      // limit: limit.toString(),
    });

    const response = await this.getRequest({
      schema: UserSubaccountsSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/subaccounts`, // TODO: update to /user_subaccounts?
      queryParams,
      options: fetchOptions,
    });

    return response.data;
  }
}
