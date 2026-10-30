import z from "zod/v4";

/** The transaction that emitted a history row. */
const BorrowLendSourceSchema = z.object({
  transaction_version: z.string(),
  transaction_unix_ms: z.number(),
});

export const BorrowLendPoolSchema = z.object({
  pool_address: z.string(),
  primary_asset: z.string(),
  primary_decimals: z.number().int().min(0).max(255),
  share_asset: z.string(),
  available_liquidity: z.string(),
  total_debt: z.string(),
  total_lender_claim: z.string(),
  utilization_ray: z.string(),
  borrow_apr_ray: z.string(),
  supply_apr_ray: z.string(),
  treasury_fee_bps: z.number(),
  insurance_fee_bps: z.number(),
  indices_as_of_secs: z.string(),
});

export const BorrowLendCollateralSchema = z.object({
  asset: z.string(),
  decimals: z.number().int().min(0).max(255),
  max_collateral_units: z.string(),
  /** Null when the asset has no registered market source or the market has no
   * recorded oracle price: unavailable, not zero. */
  value_in_primary_per_unit: z.string().nullable(),
  max_ltv_bps: z.number(),
  target_ltv_bps: z.number(),
  liquidation_bonus_bps: z.number(),
  liquidation_protocol_fee_bps: z.number(),
});

export const BorrowLendCollateralPageSchema = z.object({
  items: z.array(BorrowLendCollateralSchema),
  total_count: z.number().optional(),
});

export const LendingPositionSchema = z.object({
  store_address: z.string(),
  shares: z.string(),
  claim_in_primary: z.string(),
  frozen: z.boolean(),
});

export const BorrowLendAccountSchema = z.object({
  account: z.string(),
  primary_asset: z.string(),
  primary_decimals: z.number().int().min(0).max(255),
  indices_as_of_secs: z.string(),
  debt: z.string(),
  /** The chain default (true) when the account has no borrower record. */
  rescue_enabled: z.boolean(),
  pledges: z.array(
    z.object({
      asset: z.string(),
      decimals: z.number().int().min(0).max(255),
      amount: z.string(),
      value_in_primary: z.string(),
    }),
  ),
  collateral_value_in_primary: z.string(),
  max_weighted_collateral_in_primary: z.string(),
  borrow_capacity_in_primary: z.string(),
  liquidatable: z.boolean(),
  lending_positions: z.array(LendingPositionSchema),
  lender_claim_in_primary: z.string(),
});

export const VaultLendingPositionSchema = z.object({
  vault_address: z.string(),
  primary_asset: z.string(),
  primary_decimals: z.number().int().min(0).max(255),
  indices_as_of_secs: z.string(),
  claim_in_primary: z.string(),
  positions: z.array(LendingPositionSchema),
});

export const BorrowLendActivitySchema = z.object({
  source: BorrowLendSourceSchema,
  event_index: z.string(),
  account: z.string(),
  event_type: z.string(),
  reason: z.string(),
  counterparty: z.string(),
  asset: z.string(),
  amount: z.string(),
  shares: z.string(),
  secondary_amount: z.string(),
  protocol_fee_amount: z.string(),
  reaches_target: z.boolean(),
  is_full_repay: z.boolean(),
  target_amount: z.string(),
  insurance_amount: z.string(),
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
  event_index: z.string(),
  pool_address: z.string(),
  event_type: z.string(),
  borrow_index: z.string(),
  supply_index: z.string(),
  last_index_update_secs: z.string(),
  total_lender_shares: z.string(),
  available_liquidity: z.string(),
  base_apr_ray: z.string(),
  slope1_apr_ray: z.string(),
  slope2_apr_ray: z.string(),
  kink_ray: z.string(),
  treasury_fee_bps: z.number(),
  insurance_fee_bps: z.number(),
  liquidation_target_ltv_bps: z.number(),
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
