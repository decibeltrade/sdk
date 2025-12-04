import z from "zod/v4";

// TODO: put this in a separate folder and split up WRITE sdk

export interface SubaccountCreatedEvent {
  is_primary: boolean;
  owner: string;
  subaccount: string;
}

export interface SubaccountActiveChangedEvent {
  is_active: boolean;
  owner: string;
  subaccount: string;
}

export interface CreateSubaccountResponse {
  subaccountAddress: string | null;
}

export interface RenameSubaccountArgs {
  subaccountAddress: string;
  newName: string;
}

export const RenameSubaccountSchema = z.object({
  subaccount_address: z.string(),
  new_name: z.string(),
});

export type RenameSubaccount = z.infer<typeof RenameSubaccountSchema>;
