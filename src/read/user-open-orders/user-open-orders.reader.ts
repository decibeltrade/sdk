import { BaseReader } from "../base-reader";
import {
  UserOpenOrdersRequestArgs,
  UserOpenOrdersSchema,
  UserOpenOrdersWsMessage,
  UserOpenOrdersWsMessageSchema,
} from "./user-open-orders.types";

export class UserOpenOrdersReader extends BaseReader {
  /**
   * Get the open orders for a given user
   * @param subAddr The subaccount address of the user to get open orders for
   * @returns The open orders for the given user
   */
  async getByAddr({ subAddr, fetchOptions }: UserOpenOrdersRequestArgs) {
    const response = await this.getRequest({
      schema: UserOpenOrdersSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/open_orders`,
      queryParams: { user: subAddr },
      options: fetchOptions,
    });

    return response.data.items;
  }

  /**
   * Subscribe to user orders updates
   * @param subAddr The subaccount address of the user to subscribe to
   * @param onData Callback function for received user orders data
   * @returns A function to unsubscribe from the user orders updates
   */
  subscribeByAddr(subAddr: string, onData: (data: UserOpenOrdersWsMessage) => void) {
    const topic = `user_open_orders:${subAddr}`;
    return this.deps.ws.subscribe(topic, UserOpenOrdersWsMessageSchema, onData);
  }
}
