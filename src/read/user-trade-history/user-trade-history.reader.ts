import { BaseReader } from "../base-reader";
import {
  UserTradeHistoryRequestArgs,
  UserTradesSchema,
  UserTradesWsMessage,
  UserTradesWsMessageSchema,
} from "./user-trade-history.types";

export class UserTradeHistoryReader extends BaseReader {
  /**
   * Get the trade history for a given user
   * @param subAddr The subaccount address of the user to get trade history for
   * @param limit The number of trades to get (default: 10)
   * @returns The trade history for the given user
   */
  async getByAddr({ subAddr, limit = 10, fetchOptions }: UserTradeHistoryRequestArgs) {
    const response = await this.getRequest({
      schema: UserTradesSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/trade_history`,
      queryParams: { user: subAddr, limit: limit.toString() },
      options: fetchOptions,
    });

    return response.data;
  }

  /**
   * Subscribe to trade history updates
   * @param subAddr The subaccount address of the user to subscribe to
   * @param onData Callback function for received trade history data
   * @returns A function to unsubscribe from the trade history updates
   */
  subscribeByAddr(subAddr: string, onData: (data: UserTradesWsMessage) => void) {
    const topic = `user_trade_history:${subAddr}`;

    return this.deps.ws.subscribe(topic, UserTradesWsMessageSchema, onData);
  }
}
