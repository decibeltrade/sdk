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
