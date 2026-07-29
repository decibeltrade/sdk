import { z } from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export interface MarketPricesByNameRequestArgs extends BaseRequestArgs {
  marketName: string;
}

export const PricesSchema = z.object({
  market: z.string(),
  mark_px: z.number(),
  mid_px: z.number(),
  oracle_px: z.number(),
  funding_rate_bps: z.number(),
  is_funding_positive: z.boolean(),
  funding_period_s: z.number(),
  open_interest: z.number(),
  transaction_unix_ms: z.number(),
});

export const MarketPricesSchema = z.array(PricesSchema);

export const MarketPriceSchema = z.object({
  market: z.string(),
  mark_px: z.number(),
  mid_px: z.number(),
  oracle_px: z.number(),
  funding_rate_bps: z.number(),
  is_funding_positive: z.boolean(),
  funding_period_s: z.number(),
  open_interest: z.number(),
  transaction_unix_ms: z.number(),
});

export const MarketPriceWsMessageSchema = z.object({ price: MarketPriceSchema });

export const AllMarketPricesWsMessageSchema = z.object({ prices: MarketPricesSchema });

export const MidSchema = z.object({
  market_addr: z.string(),
  asset_type: z.enum(["perp", "spot"]),
  mid: z.number().nullable(),
  last_trade_price: z.number().nullable(),
  transaction_unix_ms: z.number(),
});

export const AllSpotMidsWsMessageSchema = z.object({ mids: z.array(MidSchema) });

export type Prices = z.infer<typeof PricesSchema>;
export type MarketPrices = z.infer<typeof MarketPricesSchema>;
export type MarketPrice = z.infer<typeof MarketPriceSchema>;
export type MarketPriceWsMessage = z.infer<typeof MarketPriceWsMessageSchema>;
export type AllMarketPricesWsMessage = z.infer<typeof AllMarketPricesWsMessageSchema>;
export type Mid = z.infer<typeof MidSchema>;
export type AllSpotMidsWsMessage = z.infer<typeof AllSpotMidsWsMessageSchema>;
