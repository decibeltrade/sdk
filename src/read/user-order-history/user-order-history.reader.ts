import { BaseReader } from "../base-reader";
import {
  UserOrderHistoryRequestArgs,
  UserOrdersSchema,
  UserOrdersWsMessage,
  UserOrdersWsMessageSchema,
} from "./user-order-history.types";

export class UserOrderHistoryReader extends BaseReader {
  async getByAddr({ subAddr, limit, offset, fetchOptions }: UserOrderHistoryRequestArgs) {
    const queryParams: Record<string, string> = {
      user: subAddr,
    };
    if (limit !== undefined) {
      queryParams.limit = limit.toString();
    }
    if (offset !== undefined) {
      queryParams.offset = offset.toString();
    }

    const response = await this.getRequest({
      schema: UserOrdersSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/order_history`,
      queryParams,
      options: fetchOptions,
    });

    return response.data;
  }

  /**
   * Subscribe to user order updates
   * @param subAddr The subaccount address of the user to subscribe to
   * @param onData Callback function for received user order data
   * @returns A function to unsubscribe from the user order updates
   */
  subscribeByAddr(subAddr: string, onData: (data: UserOrdersWsMessage) => void) {
    const topic = `order_updates:${subAddr}`;

    return this.deps.ws.subscribe(topic, UserOrdersWsMessageSchema, onData);
  }
}
