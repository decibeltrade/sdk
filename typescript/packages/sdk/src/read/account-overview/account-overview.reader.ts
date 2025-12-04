import { BaseReader } from "../base-reader";
import {
  AccountOverviewRequestArgs,
  AccountOverviewSchema,
  AccountOverviewWsMessage,
  AccountOverviewWsMessageSchema,
} from "./account-overview.types";

export class AccountOverviewReader extends BaseReader {
  /**
   * Get the account overview for a given user
   * @param subAddr The subaccount address to get the account overview for
   * @returns The account overview for the given subaccount address
   */
  async getByAddr({ subAddr, volumeWindow, fetchOptions }: AccountOverviewRequestArgs) {
    const queryParams = new URLSearchParams({ user: subAddr });

    if (volumeWindow) {
      queryParams.set("volume_window", volumeWindow);
    }

    const response = await this.getRequest({
      schema: AccountOverviewSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/account_overviews`,
      queryParams,
      options: fetchOptions,
    });

    return response.data;
  }

  /**
   * Subscribe to account overview
   * @param subAddr The subaccount address of the user to subscribe to
   * @param onData Callback function for received account overview data
   * @returns A function to unsubscribe from the account overview updates
   */
  subscribeByAddr(subAddr: string, onData: (data: AccountOverviewWsMessage) => void) {
    const topic = `account_overview:${subAddr}`;

    return this.deps.ws.subscribe(topic, AccountOverviewWsMessageSchema, onData);
  }
}
