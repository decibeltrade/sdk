import z from "zod/v4";

import { AssetType, AssetTypeSchema } from "../asset-type.types";
import { BaseRequestArgs } from "../base-reader";

export interface UserBulkOrdersRequestArgs extends BaseRequestArgs {
  subAddr: string;
  market?: string;
  /**
   * Server-side product filter. Omit to receive perp and spot merged
   * (each row carries `asset_type`); pass `"perp"` or `"spot"` to scope
   * the response to one product. Only send this against a trading-api
   * version with spot support: older servers reject requests carrying
   * unknown parameters.
   */
  assetType?: AssetType;
}

export const UserBulkOrderSchema = z.object({
  /** Absent on API versions that predate spot support (treat as "perp"). */
  asset_type: AssetTypeSchema.optional(),
  market: z.string(),
  sequence_number: z.number(),
  previous_seq_num: z.number(),
  bid_prices: z.array(z.number()),
  bid_sizes: z.array(z.number()),
  ask_prices: z.array(z.number()),
  ask_sizes: z.array(z.number()),
  cancelled_bid_prices: z.array(z.number()),
  cancelled_bid_sizes: z.array(z.number()),
  cancelled_ask_prices: z.array(z.number()),
  cancelled_ask_sizes: z.array(z.number()),
});

export const UserBulkOrdersSchema = z.array(UserBulkOrderSchema);

export const UserBulkOrdersWsMessageSchema = z.object({
  bulk_orders: z.array(UserBulkOrderSchema),
});

export type UserBulkOrder = z.infer<typeof UserBulkOrderSchema>;
export type UserBulkOrders = z.infer<typeof UserBulkOrdersSchema>;
export type UserBulkOrdersWsMessage = z.infer<typeof UserBulkOrdersWsMessageSchema>;
