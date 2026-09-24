/**
 * Bounded HTTP positions and WebSocket account snapshots.
 */
import { BaseReader } from "../base-reader";
import {
  UserPositionsRequestArgs,
  UserPositionsSchema,
  UserPositionsWsMessage,
  UserPositionsWsMessageSchema,
} from "./user-positions.types";

export class UserPositionsReader extends BaseReader {
  /**
   * Defaults to 10 positions and excludes deleted positions.
   *
   * @param options - Subaccount, position filters, limit, and HTTP options.
   * @returns One bounded positions response; no pagination is performed.
   */
  async getByAddr({
    subAddr,
    marketAddr,
    includeDeleted = false,
    limit = 10,
    fetchOptions,
  }: UserPositionsRequestArgs) {
    const queryParams = new URLSearchParams({
      account: subAddr,
      include_deleted: includeDeleted.toString(),
      limit: limit.toString(),
    });

    if (marketAddr) {
      queryParams.set("market_address", marketAddr);
    }

    const response = await this.getRequest({
      schema: UserPositionsSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/account_positions`,
      queryParams,
      options: fetchOptions,
    });

    return response.data;
  }

  /**
   * Subscribes to account position snapshots.
   *
   * @param subAddr - Subaccount address.
   * @param onData - Receives each position snapshot.
   * @returns A function that unsubscribes from the snapshots.
   */
  subscribeByAddr(subAddr: string, onData: (data: UserPositionsWsMessage) => void) {
    const topic = `account_positions:${subAddr}`;

    return this.deps.ws.subscribe(topic, UserPositionsWsMessageSchema, onData);
  }
}
