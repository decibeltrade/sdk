import { z } from "zod/v4";

export const MarketModeConfigSchema = z.discriminatedUnion("__variant__", [
  z.object({ __variant__: z.literal("Open") }),
  z.object({ __variant__: z.literal("ReduceOnly") }),
  z.object({
    __variant__: z.literal("AllowlistOnly"),
    allowlist: z.array(z.string()),
  }),
  z.object({ __variant__: z.literal("Halt") }),
]);

export const PerpMarketConfigSchema = z.object({
  __variant__: z.literal("V1"),
  name: z.string(),
  sz_precision: z.object({
    decimals: z.number(),
    multiplier: z.string(),
  }),
  min_size: z.string(),
  lot_size: z.string(),
  ticker_size: z.string(),
  max_leverage: z.number(),
  mode: MarketModeConfigSchema,
});

export const MarketModeSchema = z.enum([
  "Open",
  "ReduceOnly",
  "AllowlistOnly",
  "Halt",
  "Delisting",
]);

export const PerpMarketSchema = z.object({
  market_addr: z.string(),
  market_name: z.string(),
  sz_decimals: z.number(),
  px_decimals: z.number(),
  max_leverage: z.number(),
  tick_size: z.number(),
  min_size: z.number(),
  lot_size: z.number(),
  max_open_interest: z.number(),
  mode: MarketModeSchema,
});

export const PerpMarketsSchema = z.array(PerpMarketSchema);

export type MarketModeConfig = z.infer<typeof MarketModeConfigSchema>;
export type PerpMarketConfig = z.infer<typeof PerpMarketConfigSchema>;
export type MarketMode = z.infer<typeof MarketModeSchema>;
export type PerpMarket = z.infer<typeof PerpMarketSchema>;
export type PerpMarkets = z.infer<typeof PerpMarketsSchema>;
