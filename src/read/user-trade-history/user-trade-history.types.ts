import z from "zod/v4";

import { AssetTypeFilter, AssetTypeSchema } from "../asset-type.types";
import { BaseRequestArgs } from "../base-reader";
import { HistoryFilterParams, PaginatedResponseSchema } from "../pagination.types";

export interface UserTradeHistoryRequestArgs extends BaseRequestArgs, HistoryFilterParams {
  subAddr: string;
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

export const UserTradeSchema = z.object({
  /** Absent on API versions that predate spot support (treat as "perp"). */
  asset_type: AssetTypeSchema.optional(),
  account: z.string(),
  market: z.string(),
  /**
   * Perp trades are position-centric (OpenLong/CloseShort/...); spot trades
   * carry the side from this row's perspective (Buy/Sell). Without the spot
   * variants, the first spot fill on the `user_trades` WS topic throws a
   * ZodError and kills the subscription.
   */
  action: z.enum(["OpenLong", "CloseLong", "OpenShort", "CloseShort", "Net", "Buy", "Sell"]),
  source: z.enum(["OrderFill", "MarginCall", "BackStopLiquidation", "ADL", "MarketDelisted"]),
  trade_id: z.string(),
  size: z.number(),
  price: z.number(),
  is_profit: z.boolean(),
  realized_pnl_amount: z.number(),
  realized_funding_amount: z.number(),
  is_rebate: z.boolean(),
  fee_amount: z.number(),
  /**
   * FA metadata address of the asset `fee_amount` is denominated in. Spot
   * only (base asset for the buyer, quote for the seller); absent on perp
   * rows, where the fee is implicitly the collateral asset (USDC).
   */
  fee_asset: z.string().optional(),
  order_id: z.string(),
  client_order_id: z.string().optional(),
  transaction_unix_ms: z.number(),
  transaction_version: z.number(),
});

export const UserTradesSchema = PaginatedResponseSchema(UserTradeSchema);
export const UserTradesWsMessageSchema = z.object({
  trades: z.array(UserTradeSchema),
});

export type UserTrade = z.infer<typeof UserTradeSchema>;
export type UserTrades = z.infer<typeof UserTradesSchema>;
export type UserTradesWsMessage = z.infer<typeof UserTradesWsMessageSchema>;
