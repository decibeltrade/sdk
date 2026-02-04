import { z } from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export interface OwnerTradingPointsRequestArgs extends BaseRequestArgs {
  /** The owner address to get aggregated trading points for */
  ownerAddr: string;
}

export const SubaccountPointsSchema = z.object({
  account: z.string(),
  points: z.number(),
});

export const OwnerTradingPointsSchema = z.object({
  owner: z.string(),
  total_points: z.number(),
  breakdown: z.array(SubaccountPointsSchema).nullable(),
});

export type SubaccountPoints = z.infer<typeof SubaccountPointsSchema>;
export type OwnerTradingPoints = z.infer<typeof OwnerTradingPointsSchema>;
