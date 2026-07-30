import z from "zod/v4";

import { AssetType, AssetTypeSchema } from "../asset-type.types";
import { BaseRequestArgs } from "../base-reader";
import { HistoryFilterParams, PaginatedResponseSchema } from "../pagination.types";

export interface UserTradeHistoryRequestArgs extends BaseRequestArgs, HistoryFilterParams {
  subAddr: string;
  limit?: number;
  offset?: number;
  /**
   * Server-side product filter. Omitted = the server unions perp and spot
   * (each row carries `asset_type`); pass `"perp"` or `"spot"` to scope
   * pagination to one product. Only send against servers that support spot
   * on /trade_history; older servers reject unknown params with a 400.
   */
  assetType?: AssetType;
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
