import z from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export interface AccountOverviewRequestArgs extends BaseRequestArgs {
  subAddr: string;
  volumeWindow?: VolumeWindow;
  includePerformance?: boolean;
}

export const VolumeWindow = {
  SevenDays: "7d",
  FourteenDays: "14d",
  ThirtyDays: "30d",
  NinetyDays: "90d",
} as const;

export type VolumeWindow = (typeof VolumeWindow)[keyof typeof VolumeWindow];

/** Secondary (non-USDC) collateral held in cross margin. */
export const SecondaryCollateralSchema = z.object({
  /** On-chain asset type address (e.g., DLP fungible asset address). */
  asset_type: z.string(),
  /** Raw balance normalized to human units (balance / 10^decimals). */
  amount: z.number(),
  /** USDC-equivalent value after applying the haircut. */
  value_in_usdc: z.number(),
  /** NAV per unit in USDC terms (oracle price / 10^collateral_decimals). */
  nav_per_unit: z.number(),
  /** Haircut applied to the oracle price for margin purposes (in basis points). */
  haircut_bps: z.number(),
  /** Maximum amount of this secondary asset that can be withdrawn without violating margin requirements. */
  withdrawable_amount: z.number(),
});

export type SecondaryCollateral = z.infer<typeof SecondaryCollateralSchema>;

/** A non-USDC asset held in the subaccount's spot inventory (typically APT). */
export const SpotPositionSchema = z.object({
  /** FA metadata address for the held asset. */
  asset_addr: z.string(),
  /** Human-readable symbol from the spot market (e.g., "APT"); empty when the asset isn't a base of any registered market. */
  asset_symbol: z.string(),
  /** Balance normalized to human units (raw_balance / 10^decimals). */
  amount: z.number(),
  /** amount x current mark price (mid-of-orderbook, last trade as fallback). */
  usd_value: z.number(),
  /**
   * Weighted-average cost basis for the currently-held amount, in USD.
   * 0 when the asset was acquired without an on-book spot trade (e.g., FA transfer in).
   */
  entry_notional_usd: z.number(),
  /** usd_value - entry_notional_usd. Negative when mark < average cost. */
  unrealized_pnl_usd: z.number(),
});

/** An open spot order and the funds it reserves (USDC for bids, base asset for asks). */
export const SpotInFlightOrderSchema = z.object({
  market_addr: z.string(),
  order_id: z.string(),
  is_bid: z.boolean(),
  /** FA metadata address for the reserved asset (quote for bids, base for asks). */
  reserved_asset: z.string(),
  /** Reserved amount in human units. */
  reserved_amount: z.number(),
  /** USDC-equivalent value at current mark. */
  reserved_usd_value: z.number(),
});

/**
 * Aggregate spot trading metrics for the subaccount, summed across assets.
 * Fees are taker-attributed; realized PnL uses lifetime weighted-average cost basis.
 */
export const SpotMetricsSchema = z.object({
  /** Cumulative spot volume traded (both taker and maker sides), USD. */
  cumulative_volume_usd: z.number(),
  /** Cumulative fees paid on fills where this account was the taker, USD. */
  cumulative_taker_fees_usd: z.number(),
  /** Cumulative fees paid on fills where this account was the maker, USD. */
  cumulative_maker_fees_usd: z.number(),
  /** Cumulative realized PnL from spot sells, USD. */
  cumulative_realized_pnl_usd: z.number(),
});

/**
 * Spot-tradable inventory for the subaccount. USDC is deliberately excluded
 * from `positions` (it lives in CBS and is already counted in perp equity);
 * `in_flight_orders` covers USDC locked in open spot orders.
 */
export const SpotOverviewSchema = z.object({
  positions: z.array(SpotPositionSchema),
  /** USDC-equivalent value of every position + reserved amounts in open spot orders. */
  total_usd: z.number(),
  in_flight_orders: z.array(SpotInFlightOrderSchema),
  /** Absent when the subaccount has never traded spot. */
  metrics: SpotMetricsSchema.nullable().optional(),
});

export type SpotPosition = z.infer<typeof SpotPositionSchema>;
export type SpotInFlightOrder = z.infer<typeof SpotInFlightOrderSchema>;
export type SpotMetrics = z.infer<typeof SpotMetricsSchema>;
export type SpotOverview = z.infer<typeof SpotOverviewSchema>;

export const AccountOverviewSchema = z.object({
  perp_equity_balance: z.number(),
  perp_equity_haircutted: z.number().optional(),
  unrealized_pnl: z.number(),
  unrealized_funding_cost: z.number(),
  cross_margin_ratio: z.number(),
  maintenance_margin: z.number(),
  cross_account_leverage_ratio: z.number().nullable(),
  volume: z.number().nullable(),
  /** Net deposits (total deposits - total withdrawals) in USDC */
  net_deposits: z.number().nullable().optional(), // TODO: Remove optional once back-end is deployed
  all_time_return: z.number().nullable(),
  pnl_90d: z.number().nullable(),
  sharpe_ratio: z.number().nullable(),
  max_drawdown: z.number().nullable(),
  weekly_win_rate_12w: z.number().nullable(),
  average_cash_position: z.number().nullable(),
  average_leverage: z.number().nullable(),
  cross_account_position: z.number(),
  total_margin: z.number(),
  usdc_cross_withdrawable_balance: z.number(),
  usdc_isolated_withdrawable_balance: z.number(),
  /**
   * Cross-margin deficit: 0 when healthy, negative when the account has a margin hole.
   * When negative, new deposits partially fill this deficit before becoming available to trade.
   */
  margin_deficit: z.number().optional(), // TODO: Remove optional once back-end is deployed
  realized_pnl: z.number().nullable(),
  liquidation_fees_paid: z.number().nullable(),
  liquidation_losses: z.number().nullable(),
  /** Non-trade fee income (vault/BLP accounts only). Protocol fee distributions not captured in realized_pnl. */
  fee_income: z.number().nullable().optional(), // TODO: Remove optional once back-end is deployed
  /**
   * Total USDC value of vault shares attributed to this subaccount (free shares
   * + pledged-as-collateral). For display only — DO NOT sum with
   * `perp_equity_balance`, since the pledged portion is already counted in
   * `perp_equity_balance` via `secondary_collateral`. Use `free_vault_equity`
   * (additive complement) for total-wealth calculations.
   * NULL when not yet available via WebSocket.
   */
  vault_equity: z.number().nullable().optional(), // TODO: Remove optional once back-end is deployed
  /**
   * USDC value of vault shares NOT currently pledged as DLP collateral on this
   * subaccount's perp account ("free" shares × NAV). Additive complement to
   * `perp_equity_balance`: `perp_equity_balance + free_vault_equity` gives
   * total subaccount wealth with no double-count of pledged DLP.
   * Equals 0 for users who pledge all their vault shares as collateral.
   * NULL when not yet available via WebSocket.
   */
  free_vault_equity: z.number().nullable().optional(), // TODO: Remove optional once back-end is deployed
  /** Secondary (non-USDC) collateral held in cross margin. NULL when none exists or oracle data is unavailable. */
  secondary_collateral: z.array(SecondaryCollateralSchema).nullable().optional(), // TODO: Remove optional once back-end is deployed,
  /**
   * Total cross-margin buying power across all collateral assets (USDC + secondary).
   * = max(0, raw_free_collateral − order_margin). Use this for "Available to Trade" display.
   */
  cross_available_to_trade: z.number().optional(), // TODO: Remove optional once back-end is deployed
  /**
   * Spot inventory + open-order reservations + trading metrics for this
   * subaccount. NULL for wallet-only owners or when spot enrichment fails.
   */
  spot: SpotOverviewSchema.nullable().optional(), // TODO: Remove optional once back-end is deployed
});

export const AccountOverviewWsMessageSchema = z.object({
  account_overview: AccountOverviewSchema.omit({ volume: true }),
});

export type AccountOverview = z.infer<typeof AccountOverviewSchema>;
export type AccountOverviewWsMessage = z.infer<typeof AccountOverviewWsMessageSchema>;
