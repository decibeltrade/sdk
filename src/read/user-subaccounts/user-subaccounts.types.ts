import z from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export interface UserSubaccountsRequestArgs extends BaseRequestArgs {
  ownerAddr: string;
  // limit?: number; // TODO: Add limit
}

export const UserSubaccountSchema = z.object({
  subaccount_address: z.string(),
  primary_account_address: z.string(),
  is_primary: z.boolean(),
  is_active: z.boolean().optional(),
  custom_label: z.string().nullable(),
});

export const UserSubaccountsSchema = z.array(UserSubaccountSchema);

export type UserSubaccount = z.infer<typeof UserSubaccountSchema>;
export type UserSubaccounts = UserSubaccount[];
