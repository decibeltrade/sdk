import { z } from "zod/v4";

/**
 * Product discriminator carried on rows of endpoints that serve perp and spot
 * together (`/markets`, open orders, order history, bulk orders/fills, trades,
 * and their WS topics). Optional everywhere: API versions that predate spot
 * support omit the field, and an absent value means "perp".
 */
export const AssetTypeSchema = z.enum(["perp", "spot"]);

export type AssetType = z.infer<typeof AssetTypeSchema>;

export function isSpot(assetType: AssetType | undefined): boolean {
  return assetType === "spot";
}
