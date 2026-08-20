import { z } from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export interface OwnerTradingAmpsRequestArgs extends BaseRequestArgs {
  /** The owner address to get aggregated trading Hz (Amps) for */
  ownerAddr: string;
  /** Optional season name to filter by (e.g. "season1"). Omit to aggregate across all seasons. */
  season?: string;
  /** Number of days to look back. 1 = today only, 7 = last week, etc. Omit for lifetime totals. */
  days?: number;
}

export const SubaccountAmpsSchema = z.object({
  account: z.string(),
  total_amps: z.number(),
});

export const OwnerTradingAmpsSchema = z.object({
  owner: z.string(),
  total_amps: z.number(),
  breakdown: z.array(SubaccountAmpsSchema).nullable(),
});

export type SubaccountAmps = z.infer<typeof SubaccountAmpsSchema>;
export type OwnerTradingAmps = z.infer<typeof OwnerTradingAmpsSchema>;

export interface OwnerAmpsDailyRequestArgs extends BaseRequestArgs {
  /** The owner address to get per-day Amps for */
  ownerAddr: string;
  /** Most recent season days to return. Server defaults to 14 and clamps to 90. */
  days?: number;
  /** Season name (e.g. "season1"). Defaults server-side to the season containing today. */
  season?: string;
}

export const DailyAmpsSchema = z.object({
  day_index: z.number(),
  day_start_unix_ms: z.number(),
  total_amps: z.number(),
  trading_amps: z.number(),
  streak_amps: z.number(),
  referral_amps: z.number(),
  vault_amps: z.number(),
});

export const OwnerAmpsDailySchema = z.object({
  owner: z.string(),
  season: z.string(),
  days: z.array(DailyAmpsSchema),
});

export type DailyAmps = z.infer<typeof DailyAmpsSchema>;
export type OwnerAmpsDaily = z.infer<typeof OwnerAmpsDailySchema>;
