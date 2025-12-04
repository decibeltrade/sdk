import { BaseReader } from "../base-reader";
import {
  UserOrderHistoryRequestArgs,
  UserOrdersSchema,
  UserOrdersWsMessage,
  UserOrdersWsMessageSchema,
} from "./user-order-history.types";

export class UserOrderHistoryReader extends BaseReader {
  async getByAddr({ subAddr, fetchOptions }: UserOrderHistoryRequestArgs) {
    const response = await this.getRequest({
      schema: UserOrdersSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/order_history`,
      queryParams: {
        user: subAddr,
      },
      options: fetchOptions,
    });

    return response.data;
  }

  /**
   * Subscribe to user order history updates
   * @param subAddr The subaccount address of the user to subscribe to
   * @param onData Callback function for received user order history data
   * @returns A function to unsubscribe from the user order history updates
   */
  subscribeByAddr(subAddr: string, onData: (data: UserOrdersWsMessage) => void) {
    const topic = `user_order_history:${subAddr}`;

    return this.deps.ws.subscribe(topic, UserOrdersWsMessageSchema, onData);
  }
}
