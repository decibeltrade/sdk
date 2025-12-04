import { BaseReader } from "../base-reader";
import {
  UserBulkOrdersRequestArgs,
  UserBulkOrdersSchema,
  UserBulkOrdersWsMessage,
  UserBulkOrdersWsMessageSchema,
} from "./user-bulk-orders.types";

export class UserBulkOrdersReader extends BaseReader {
  /**
   * Get the bulk orders for a given user
   * @param subAddr The subaccount address of the user to get bulk orders for
   * @param market Optional market address to filter by specific market
   * @returns The bulk orders for the given user
   */
  async getByAddr({ subAddr, market, fetchOptions }: UserBulkOrdersRequestArgs) {
    const response = await this.getRequest({
      schema: UserBulkOrdersSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/bulk_orders`,
      queryParams: { user: subAddr, market: market || "all" },
      options: fetchOptions,
    });

    return response.data;
  }

  /**
   * Subscribe to user bulk orders updates
   * @param subAddr The subaccount address of the user to subscribe to
   * @param onData Callback function for received user bulk orders data
   * @returns A function to unsubscribe from the user bulk orders updates
   */
  subscribeByAddr(subAddr: string, onData: (data: UserBulkOrdersWsMessage) => void) {
    const topic = `bulk_orders:${subAddr}`;
    return this.deps.ws.subscribe(topic, UserBulkOrdersWsMessageSchema, onData);
  }
}
