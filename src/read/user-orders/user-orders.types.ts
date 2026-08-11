import z from "zod/v4";

import { AssetType } from "../asset-type.types";
import { BaseRequestArgs } from "../base-reader";
import { UserOrderSchema } from "../user-order-history/user-order-history.types";

interface UserOrderLookupBaseArgs extends BaseRequestArgs {
  subAddr: string;
  market: string;
  /**
   * Product to look the order up in. Unlike the list readers, this defaults
   * to unset: the API then checks perp first and falls through to spot,
   * which is the right behavior for a point lookup by id.
   */
  assetType?: AssetType;
}

export type UserOrderRequestArgs = UserOrderLookupBaseArgs &
  (
    | { orderId: string; clientOrderId?: never }
    /** client_order_id is a perp-only field — spot orders don't carry one. */
    | { clientOrderId: string; orderId?: never }
  );

export const UserOrderUpdateSchema = z.object({
  status: z.string(),
  details: z.string(),
  order: UserOrderSchema,
});

export type UserOrderUpdate = z.infer<typeof UserOrderUpdateSchema>;
