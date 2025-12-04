import z from "zod/v4";

import { BaseRequestArgs } from "../base-reader";
import { PaginatedResponseSchema } from "../pagination.types";

/**
 * Arguments for fetching vaults owned by a specific user
 */
export interface UserOwnedVaultsRequestArgs extends BaseRequestArgs {
  ownerAddr: string;
  limit?: number;
  offset?: number;
}

export interface PublicVaultsRequestArgs extends BaseRequestArgs {
  limit?: number;
  offset?: number;
  vaultType?: "user" | "protocol";
  address?: string;
}

/**
 * Arguments for fetching user performance metrics for a specific subaccount
 */
export interface UserPerformancesOnVaultsRequestArgs extends BaseRequestArgs {
  ownerAddr: string;
}

/**
 * Schema for a vault in the protocol
 * Represents both protocol-wide vaults and user-managed vaults
 */
export const VaultSchema = z.object({
  address: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  manager: z.string(),
  status: z.string(),
  created_at: z.number(),
  tvl: z.number().nullable(),
  volume: z.number().nullable(),
  all_time_return: z.number().nullable(),
  past_month_return: z.number().nullable(),
  sharpe_ratio: z.number().nullable(),
  max_drawdown: z.number().nullable(),
  weekly_win_rate_12w: z.number().nullable(),
  profit_share: z.number().nullable(),
  pnl_90d: z.number().nullable(),
  manager_avg_cash: z.number().nullable(),
  average_leverage: z.number().nullable(),
  depositors: z.number().nullable(),
  perp_equity: z.number().nullable(),
  vault_type: z.string(),
  pnl_history: z.array(z.string()).nullable(),
  social_links: z.array(z.string()).nullable(),
});

export const VaultsResponseSchema = PaginatedResponseSchema(VaultSchema).extend({
  total_value_locked: z.number(),
  total_volume: z.number(),
});
export type VaultsResponse = z.infer<typeof VaultsResponseSchema>;
export type Vault = z.infer<typeof VaultSchema>;
export type Vaults = Vault[];

/**
 * Schema for vaults owned/managed by a specific user
 * Contains summary information about vaults the user manages
 */
export const UserOwnedVaultSchema = z.object({
  vault_address: z.string(),
  vault_name: z.string(),
  vault_share_symbol: z.string(),
  status: z.string(),
  age_days: z.number(),
  num_managers: z.number(),
  tvl: z.number().nullable(),
  apr: z.number().nullable(),
  manager_equity: z.number().nullable(),
  manager_stake: z.number().nullable(),
});

export const UserOwnedVaultsResponseSchema = PaginatedResponseSchema(UserOwnedVaultSchema);
export type UserOwnedVaultsResponse = z.infer<typeof UserOwnedVaultsResponseSchema>;
export type UserOwnedVault = z.infer<typeof UserOwnedVaultSchema>;
export type UserOwnedVaults = UserOwnedVault[];

/**
 * Schema for user performance metrics within a vault
 * Tracks a user's deposits, shares, returns, and PnL for a specific vault
 */
export const UserPerformanceOnVaultSchema = z.object({
  vault_address: z.string(),
  user_address: z.string(),
  net_deposits: z.number().nullable(),
  current_num_shares: z.number().nullable(),
  current_value_of_shares: z.number().nullable(),
  all_time_return: z.number().nullable(),
  unrealized_pnl: z.number().nullable(),
  share_price: z.number(),
  volume: z.number(),
  weekly_win_rate_12w: z.number().nullable(),
});
export const UserPerformancesOnVaultsResponseSchema = z.array(UserPerformanceOnVaultSchema);
export type UserPerformanceOnVault = z.infer<typeof UserPerformanceOnVaultSchema>;
export type UserPerformancesOnVaults = UserPerformanceOnVault[];
