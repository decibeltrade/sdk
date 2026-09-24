/**
 * Bounded HTTP TWAPs and WebSocket account snapshots.
 */
import { BaseReader } from "../base-reader";
import {
  UserActiveTwapsRequestArgs,
  UserActiveTwapsSchema,
  UserActiveTwapsWsMessage,
  UserActiveTwapsWsMessageSchema,
} from "./user-active-twaps.types";

export class UserActiveTwapsReader extends BaseReader {
  /**
   * Uses the API's limit when omitted.
   *
   * @param options - Subaccount, optional limit, and HTTP options.
   * @returns One bounded TWAP response, without pagination or status filtering.
   */
  async getByAddr({ subAddr, limit, fetchOptions }: UserActiveTwapsRequestArgs) {
    const queryParams: Record<string, string> = { account: subAddr };
    if (limit !== undefined) queryParams.limit = limit.toString();
    const response = await this.getRequest({
      schema: UserActiveTwapsSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/active_twaps`,
      queryParams,
      options: fetchOptions,
    });

    return response.data;
  }

  /**
   * Subscribes to account TWAP snapshots.
   *
   * @param subAddr - Subaccount address.
   * @param onData - Receives each TWAP snapshot.
   * @returns A function that unsubscribes from the snapshots.
   */
  subscribeByAddr(subAddr: string, onData: (data: UserActiveTwapsWsMessage) => void) {
    const topic = `user_active_twaps:${subAddr}`;
    return this.deps.ws.subscribe(topic, UserActiveTwapsWsMessageSchema, onData);
  }
}
