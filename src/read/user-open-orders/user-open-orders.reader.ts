/**
 * Scoped HTTP order pages and WebSocket account snapshots.
 */
import { toAssetTypeParam } from "../asset-type.types";
import { BaseReader } from "../base-reader";
import {
  UserOpenOrdersRequestArgs,
  UserOpenOrdersSchema,
  UserOpenOrdersWsMessage,
  UserOpenOrdersWsMessageSchema,
} from "./user-open-orders.types";

export class UserOpenOrdersReader extends BaseReader {
  /**
   * Defaults to perpetual orders; `"all"` also includes spot orders.
   *
   * @param options - Subaccount, pagination, asset scope, and HTTP options.
   * @returns One order page with the API's optional `total_count`.
   */
  async getByAddr({
    subAddr,
    limit,
    offset,
    assetType = "perp",
    fetchOptions,
  }: UserOpenOrdersRequestArgs) {
    const queryParams: Record<string, string> = {
      account: subAddr,
    };
    if (limit !== undefined) {
      queryParams.limit = limit.toString();
    }
    if (offset !== undefined) {
      queryParams.offset = offset.toString();
    }
    const assetTypeParam = toAssetTypeParam(assetType);
    if (assetTypeParam !== undefined) {
      queryParams.asset_type = assetTypeParam;
    }

    const response = await this.getRequest({
      schema: UserOpenOrdersSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/open_orders`,
      queryParams,
      options: fetchOptions,
    });

    return response.data;
  }

  /**
   * Subscribes to account open-order snapshots.
   *
   * @param subAddr - Subaccount address.
   * @param onData - Receives each open-order snapshot.
   * @returns A function that unsubscribes from the snapshots.
   */
  subscribeByAddr(subAddr: string, onData: (data: UserOpenOrdersWsMessage) => void) {
    const topic = `account_open_orders:${subAddr}`;
    return this.deps.ws.subscribe(topic, UserOpenOrdersWsMessageSchema, onData);
  }
}
