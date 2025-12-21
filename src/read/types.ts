import { z } from "zod/v4";

// Export all types from readers
export * from "./account-overview/account-overview.types";
export * from "./candlesticks/candlesticks.types";
export * from "./delegations/delegations.types";
export * from "./leaderboard/leaderboard.types";
export * from "./market-contexts/market-contexts.types";
export * from "./market-depth/market-depth.types";
export * from "./market-prices/market-prices.types";
export * from "./market-trades/market-trades.types";
export * from "./markets/markets.types";
export * from "./pagination.types";
export * from "./portfolio-chart/portfolio-chart.types";
export * from "./user-active-twaps/user-active-twaps.types";
export * from "./user-bulk-orders/user-bulk-orders.types";
export * from "./user-funding-history/user-funding-history.types";
export * from "./user-notifications/user-notifications.types";
export * from "./user-open-orders/user-open-orders.types";
export * from "./user-order-history/user-order-history.types";
export * from "./user-positions/user-positions.types";
export * from "./user-subaccounts/user-subaccounts.types";
export * from "./user-trade-history/user-trade-history.types";
export * from "./vaults/vaults.types";

export const PerpPosition = z.object({
  size: z.number(),
  sz_decimals: z.number(),
  entry_px: z.number(),
  max_leverage: z.number(),
  is_long: z.boolean(),
  token_type: z.string(),
});
export type PerpPosition = z.infer<typeof PerpPosition>;

export const CrossedPosition = z.object({
  positions: z.array(PerpPosition),
});
export type CrossedPosition = z.infer<typeof CrossedPosition>;

export const LiquidationConfigV1 = z.object({
  __variant__: z.literal("V1"),
  backstop_liquidator: z.string(),
  backstop_margin_maintenance_divisor: z.string(),
  backstop_margin_maintenance_multiplier: z.string(),
  maintenance_margin_leverage_divisor: z.string(),
  maintenance_margin_leverage_multiplier: z.string(),
});
export type LiquidationConfigV1 = z.infer<typeof LiquidationConfigV1>;

export const CollateralBalanceSheet = z.object({
  asset_type: z.object({
    inner: z.string(),
  }),
  asset_precision: z.object({
    decimals: z.number(),
    multiplier: z.string(),
  }),
  balance_precision: z.object({
    decimals: z.number(),
    multiplier: z.string(),
  }),
  balance_table: z.object({
    handle: z.string(),
  }),
  store: z.object({
    inner: z.string(),
  }),
  store_extend_ref: z.object({
    self: z.string(),
  }),
});
export type CollateralBalanceSheet = z.infer<typeof CollateralBalanceSheet>;

export const GlobalAccountsStateV1 = z.object({
  __variant__: z.string(),
  collateral: CollateralBalanceSheet,
  liquidation_config: LiquidationConfigV1,
});
export type GlobalAccountsStateV1 = z.infer<typeof GlobalAccountsStateV1>;

export const GlobalAccountsState = GlobalAccountsStateV1;
export type GlobalAccountsState = z.infer<typeof GlobalAccountsState>;

// Search term
export interface SearchTermParams {
  searchTerm?: string;
}

// Sort direction
export type SortDirection = "ASC" | "DESC" | undefined;

// Sort params
export interface SortParams<T extends string> {
  sortKey?: T;
  sortDir?: SortDirection;
}

// Vaults
export interface CreateVaultArgs {
  subaccountAddr?: string | null;
  contributionAssetType?: string;
  vaultName: string;
  vaultDescription: string;
  vaultSocialLinks: string[];
  vaultShareSymbol: string;
  vaultShareIconUri?: string;
  vaultShareProjectUri?: string;
  feeBps: number;
  feeIntervalS: number;
  contributionLockupDurationS: number;
  initialFunding: number;
  acceptsContributions: boolean;
  delegateToCreator: boolean;
}

export interface ActivateVaultArgs {
  vaultAddress: string;
  additionalFunding?: number;
}

export interface DepositToVaultArgs {
  vaultAddress: string;
  amount: number;
}

export interface WithdrawFromVaultArgs {
  vaultAddress: string;
  shares: number;
}
