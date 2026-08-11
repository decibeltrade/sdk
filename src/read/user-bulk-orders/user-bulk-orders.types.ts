import z from "zod/v4";

import { AssetType, AssetTypeFilter, AssetTypeSchema } from "../asset-type.types";
import { BaseRequestArgs } from "../base-reader";
import { PaginatedResponseSchema } from "../pagination.types";

export interface UserBulkOrdersRequestArgs extends BaseRequestArgs {
  subAddr: string;
  market?: string;
  /**
   * Server-side product filter (default `"perp"`). Pass `"spot"` to scope
   * the response to spot, or `"all"` to omit the param and receive perp and
   * spot merged — each row then carries `asset_type` for client-side demux.
   */
  assetType?: AssetTypeFilter;
}

export interface UserBulkOrderStatusRequestArgs extends BaseRequestArgs {
  subAddr: string;
  market: string;
  sequenceNumber: number;
  /**
   * Product to query (default `"perp"`). Bulk-order status is keyed by
   * (account, market, sequence_number) per product, so there is no merged
   * `"all"` view for this endpoint.
   */
  assetType?: AssetType;
}

export interface UserBulkOrderFillsRequestArgs extends BaseRequestArgs {
  subAddr: string;
  market?: string;
  /** Single sequence number to query. */
  sequenceNumber?: number;
  /** Start of sequence number range. */
  startSequenceNumber?: number;
  /** End of sequence number range; requires `startSequenceNumber`. */
  endSequenceNumber?: number;
  limit?: number;
  offset?: number;
  /**
   * Server-side product filter (default `"perp"`). Pass `"spot"` to scope
   * the response (and its pagination) to spot, or `"all"` to omit the param
   * and receive perp and spot merged — each row then carries `asset_type`
   * for client-side demux.
   */
  assetType?: AssetTypeFilter;
}

export const UserBulkOrderSchema = z.object({
  /** Absent on API versions that predate spot support (treat as "perp"). */
  asset_type: AssetTypeSchema.optional(),
  market: z.string(),
  sequence_number: z.number(),
  /** Null on bulk-order rejection rows (no accepted predecessor). */
  previous_seq_num: z.number().nullable(),
  bid_prices: z.array(z.number()),
  bid_sizes: z.array(z.number()),
  ask_prices: z.array(z.number()),
  ask_sizes: z.array(z.number()),
  cancelled_bid_prices: z.array(z.number()),
  cancelled_bid_sizes: z.array(z.number()),
  cancelled_ask_prices: z.array(z.number()),
  cancelled_ask_sizes: z.array(z.number()),
  user: z.string().optional(),
  cancellation_reason: z.string().optional(),
  transaction_version: z.number().optional(),
  transaction_unix_ms: z.number().optional(),
});

export const UserBulkOrdersSchema = z.array(UserBulkOrderSchema);

export const UserBulkOrderStatusSchema = z.object({
  /** "Placed" or "Rejected". */
  status: z.string(),
  details: z.string(),
  bulk_order: UserBulkOrderSchema,
});

export const UserBulkOrderFillSchema = z.object({
  /** Absent on API versions that predate spot support (treat as "perp"). */
  asset_type: AssetTypeSchema.optional(),
  market: z.string(),
  sequence_number: z.number(),
  user: z.string(),
  filled_size: z.number(),
  price: z.number(),
  is_bid: z.boolean(),
  trade_id: z.string(),
  transaction_unix_ms: z.number(),
  transaction_version: z.number(),
  // The wire payload also carries `event_uid` (a u128); it is intentionally
  // not surfaced because JSON.parse cannot represent it losslessly.
});

export const UserBulkOrderFillsSchema = PaginatedResponseSchema(UserBulkOrderFillSchema);

export const UserBulkOrdersWsMessageSchema = z.object({
  bulk_orders: z.array(UserBulkOrderSchema),
});

export type UserBulkOrder = z.infer<typeof UserBulkOrderSchema>;
export type UserBulkOrders = z.infer<typeof UserBulkOrdersSchema>;
export type UserBulkOrderStatus = z.infer<typeof UserBulkOrderStatusSchema>;
export type UserBulkOrderFill = z.infer<typeof UserBulkOrderFillSchema>;
export type UserBulkOrderFills = z.infer<typeof UserBulkOrderFillsSchema>;
export type UserBulkOrdersWsMessage = z.infer<typeof UserBulkOrdersWsMessageSchema>;
