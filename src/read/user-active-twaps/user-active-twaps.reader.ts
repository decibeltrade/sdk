import { BaseReader } from "../base-reader";
import {
  UserActiveTwapsRequestArgs,
  UserActiveTwapsSchema,
  UserActiveTwapsWsMessage,
  UserActiveTwapsWsMessageSchema,
} from "./user-active-twaps.types";

export class UserActiveTwapsReader extends BaseReader {
  /**
   * Get the active twaps for a given user
   * @param subAddr The subaccount address of the user to get active twaps for
   * @returns The active twaps for the given user
   */
  async getByAddr({ subAddr, fetchOptions }: UserActiveTwapsRequestArgs) {
    const response = await this.getRequest({
      schema: UserActiveTwapsSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/active_twaps`,
      queryParams: { user: subAddr },
      options: fetchOptions,
    });

    return response.data;
  }

  /**
   * Subscribe to active twaps updates
   * @param subAddr The subaccount address of the user to subscribe to
   * @param onData Callback function for received active twaps data
   * @returns A function to unsubscribe from the active twaps updates
   */
  subscribeByAddr(subAddr: string, onData: (data: UserActiveTwapsWsMessage) => void) {
    const topic = `user_active_twaps:${subAddr}`;
    return this.deps.ws.subscribe(topic, UserActiveTwapsWsMessageSchema, onData);
  }
}
