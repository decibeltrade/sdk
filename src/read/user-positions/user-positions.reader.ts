import { BaseReader } from "../base-reader";
import {
  UserPositionsRequestArgs,
  UserPositionsSchema,
  UserPositionsWsMessage,
  UserPositionsWsMessageSchema,
} from "./user-positions.types";

export class UserPositionsReader extends BaseReader {
  /**
   * Get the positions for a given user
   * @param userAddr The address of the user to get positions for
   * @param includeDeleted Whether to include deleted positions in the response
   * @returns The positions for the given user
   */
  async getByAddr({
    subAddr,
    marketAddr,
    includeDeleted = false,
    limit = 10,
    fetchOptions,
  }: UserPositionsRequestArgs) {
    const queryParams = new URLSearchParams({
      user: subAddr,
      include_deleted: includeDeleted.toString(),
      limit: limit.toString(),
    });

    if (marketAddr) {
      queryParams.set("market_address", marketAddr);
    }

    const response = await this.getRequest({
      schema: UserPositionsSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/user_positions`,
      queryParams,
      options: fetchOptions,
    });

    return response.data;
  }

  /**
   * Subscribe to user positions updates
   * @param subAddr The subaccount address of the user to subscribe to
   * @param apiUrl The WebSocket server URL
   * @param onData Callback function for received user positions data
   * @returns A function to unsubscribe from the user positions updates
   */
  subscribeByAddr(subAddr: string, onData: (data: UserPositionsWsMessage) => void) {
    const topic = `user_positions:${subAddr}`;

    return this.deps.ws.subscribe(topic, UserPositionsWsMessageSchema, onData);
  }
}
