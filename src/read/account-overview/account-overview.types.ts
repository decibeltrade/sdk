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

export const AccountOverviewSchema = z.object({
  perp_equity_balance: z.number(),
  unrealized_pnl: z.number(),
  unrealized_funding_cost: z.number(),
  cross_margin_ratio: z.number(),
  maintenance_margin: z.number(),
  cross_account_leverage_ratio: z.number().nullable(),
  volume: z.number().nullable(),
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
  realized_pnl: z.number().nullable(),
});

export const AccountOverviewWsMessageSchema = z.object({
  account_overview: AccountOverviewSchema.omit({ volume: true }),
});

export type AccountOverview = z.infer<typeof AccountOverviewSchema>;
export type AccountOverviewWsMessage = z.infer<typeof AccountOverviewWsMessageSchema>;
