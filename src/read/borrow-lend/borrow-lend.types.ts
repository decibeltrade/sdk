import z from "zod/v4";

import { PaginatedResponseSchema } from "../pagination.types";
import { bps, decimals, intString, rescueEnabled, uintString } from "./borrow-lend.zod";

/** The transaction that emitted a history row. */
const BorrowLendSourceSchema = z.object({
  transaction_version: uintString,
  transaction_unix_ms: z.number(),
});

export const BorrowLendPoolSchema = z.object({
  pool_address: z.string(),
  primary_asset: z.string(),
  primary_decimals: decimals,
  share_asset: z.string(),
  available_liquidity: uintString,
  total_debt: uintString,
  total_lender_claim: uintString,
  utilization_ray: uintString,
  borrow_apr_ray: uintString,
  supply_apr_ray: uintString,
  treasury_fee_bps: bps,
  insurance_fee_bps: bps,
  indices_as_of_secs: uintString,
});

export const BorrowLendCollateralSchema = z.object({
  asset: z.string(),
  decimals,
  max_collateral_units: uintString,
  /** Null = unavailable (no market source, unknown mode, or no positive oracle price). "0" only when the source market is Delisting. */
  value_usdc_per_unit: uintString.nullable(),
  max_ltv_bps: bps,
  target_ltv_bps: bps,
  liquidation_bonus_bps: bps,
  liquidation_protocol_fee_bps: bps,
});

export const BorrowLendCollateralPageSchema = PaginatedResponseSchema(BorrowLendCollateralSchema);

export const LendingPositionSchema = z.object({
  store_address: z.string(),
  shares: uintString,
  claim_usdc: uintString,
  frozen: z.boolean(),
});

export const BORROW_LEND_HISTORY_UNAVAILABLE_REASONS = [
  "history_lagging",
  "history_read_failed",
  "history_too_long",
  "history_inconsistent",
  "interest_not_reported",
] as const;

export type BorrowLendHistoryUnavailableReason =
  (typeof BORROW_LEND_HISTORY_UNAVAILABLE_REASONS)[number];

/** Any string parses, so a reason added by a newer server does not break this client. */
export const BorrowLendHistoryUnavailableSchema = z.union([
  z.enum(BORROW_LEND_HISTORY_UNAVAILABLE_REASONS),
  z.string(),
]);

export const BorrowLendAccountSchema = z.object({
  account: z.string(),
  primary_asset: z.string(),
  primary_decimals: decimals,
  indices_as_of_secs: uintString,
  debt_usdc: uintString,
  rescue_enabled: rescueEnabled,
  pledges: z.array(
    z.object({
      asset: z.string(),
      decimals,
      amount: uintString,
      value_usdc: uintString,
    }),
  ),
  collateral_value_usdc: uintString,
  max_weighted_collateral_usdc: uintString,
  borrow_capacity_usdc: uintString,
  liquidatable: z.boolean(),
  lending_positions: z.array(LendingPositionSchema),
  lender_claim_usdc: uintString,
  /** Optional until every server emits it; null when `debt_split_unavailable` is set. */
  debt_principal_usdc: z.string().nullable().optional(),
  /** Unpaid interest in `debt_usdc`, split interest-first as the chain repays. */
  debt_interest_usdc: z.string().nullable().optional(),
  /** Signed: supplied minus redeemed cash. */
  lender_net_supplied_usdc: z.string().nullable().optional(),
  /** Signed: `lender_claim_usdc` minus net supplied, including redeemed interest. */
  lender_earned_usdc: z.string().nullable().optional(),
  /** Null when both debt split fields are present; otherwise why they are null. */
  debt_split_unavailable: BorrowLendHistoryUnavailableSchema.nullable().optional(),
  /** Null when both lender earnings fields are present; otherwise why they are null. */
  lender_earnings_unavailable: BorrowLendHistoryUnavailableSchema.nullable().optional(),
});

export const VaultLendingPositionSchema = z.object({
  vault_address: z.string(),
  primary_asset: z.string(),
  primary_decimals: decimals,
  indices_as_of_secs: uintString,
  claim_usdc: uintString,
  positions: z.array(LendingPositionSchema),
});

export const BorrowLendActivitySchema = z.object({
  source: BorrowLendSourceSchema,
  event_index: uintString,
  account: z.string(),
  event_type: z.string(),
  reason: z.string(),
  counterparty: z.string(),
  asset: z.string(),
  amount: uintString,
  shares: intString,
  secondary_amount: uintString,
  protocol_fee_amount: uintString,
  reaches_target: z.boolean(),
  is_full_repay: z.boolean(),
  target_amount: uintString,
  insurance_amount: uintString,
});

export const BorrowLendActivityPageSchema = z.object({
  items: z.array(BorrowLendActivitySchema),
  next_cursor: z.string().nullable(),
});

/**
 * A pool event sets only the columns its payload determines and leaves the
 * rest at 0, so `event_type` is what says which columns this row carries.
 */
export const BorrowLendPoolHistorySchema = z.object({
  source: BorrowLendSourceSchema,
  event_index: uintString,
  pool_address: z.string(),
  event_type: z.string(),
  borrow_index: uintString,
  supply_index: uintString,
  last_index_update_secs: uintString,
  total_lender_shares: uintString,
  available_liquidity: uintString,
  base_apr_ray: uintString,
  slope1_apr_ray: uintString,
  slope2_apr_ray: uintString,
  kink_ray: uintString,
  treasury_fee_bps: bps,
  insurance_fee_bps: bps,
  liquidation_target_ltv_bps: bps,
});

export const BorrowLendPoolHistoryPageSchema = z.object({
  items: z.array(BorrowLendPoolHistorySchema),
  next_cursor: z.string().nullable(),
});

export type BorrowLendPool = z.infer<typeof BorrowLendPoolSchema>;
export type BorrowLendCollateral = z.infer<typeof BorrowLendCollateralSchema>;
export type BorrowLendCollateralPage = z.infer<typeof BorrowLendCollateralPageSchema>;
export type BorrowLendAccount = z.infer<typeof BorrowLendAccountSchema>;
export type LendingPosition = z.infer<typeof LendingPositionSchema>;
export type VaultLendingPosition = z.infer<typeof VaultLendingPositionSchema>;
export type BorrowLendActivity = z.infer<typeof BorrowLendActivitySchema>;
export type BorrowLendActivityPage = z.infer<typeof BorrowLendActivityPageSchema>;
export type BorrowLendPoolHistory = z.infer<typeof BorrowLendPoolHistorySchema>;
export type BorrowLendPoolHistoryPage = z.infer<typeof BorrowLendPoolHistoryPageSchema>;

const signedRayString = z.string().regex(/^-?\d+$/);

const rayString = z.string().regex(/^\d+$/);

/**
 * Realized interest rates since the previous point, from the last stored
 * indices in the bucket. Buckets with no index update are omitted, not carried
 * forward. `supply_apr_ray` is supplier interest only and reads "0" while the
 * supply index has not grown; it is null once bad debt wrote supplier value to
 * zero. `supply_bad_debt_loss_ray` is the one-time fraction of supplier value
 * written off in the period (1e27 = 100%): not annualized, not a rate, and not
 * for the APR axis.
 */
export const BorrowLendRatePointSchema = z.object({
  bucket_start: z.number(),
  borrow_apr_ray: signedRayString,
  supply_apr_ray: rayString.nullable(),
  supply_bad_debt_loss_ray: rayString,
  borrow_index: z.string(),
  supply_index: z.string(),
  as_of_secs: z.string(),
});

export const BorrowLendRateHistorySchema = z.object({
  points: z.array(BorrowLendRatePointSchema),
});

export type BorrowLendRateInterval = "1h" | "1d";
export type BorrowLendRatePoint = z.infer<typeof BorrowLendRatePointSchema>;
export type BorrowLendRateHistory = z.infer<typeof BorrowLendRateHistorySchema>;
