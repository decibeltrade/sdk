import z from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export interface DelegationsRequestArgs extends BaseRequestArgs {
  subAddr: string;
}

export const DelegationSchema = z.object({
  delegated_account: z.string(),
  permission_type: z.string(),
  expiration_time_s: z.number().nullable(),
});

export const DelegationsSchema = z.array(DelegationSchema);

export type Delegations = z.infer<typeof DelegationsSchema>;

export type Delegation = z.infer<typeof DelegationSchema>;
