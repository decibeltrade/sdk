import { z } from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export interface AccountStreaksRequestArgs extends BaseRequestArgs {
  /** The owner address to get streak data for */
  ownerAddr: string;
}

export const AccountStreaksSchema = z.object({
  owner: z.string(),
  currentStreak: z.number(),
  streakIpoints: z.number(),
  streakAmpsEstimate: z.number(),
  graceDaysAvailable: z.number(),
  graceDaysUsed: z.number(),
  qualifyingDates: z.array(z.string()),
});

export type AccountStreaks = z.infer<typeof AccountStreaksSchema>;
