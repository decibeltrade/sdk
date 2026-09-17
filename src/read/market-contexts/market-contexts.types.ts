import z from "zod/v4";

export const MarketContextSchema = z.object({
  market: z.string(),
  volume_24h: z.number(),
  open_interest: z.number(),
  previous_day_price: z.number(),
  price_change_pct_24h: z.number(),
});

export const MarketContextsSchema = z.array(MarketContextSchema);

export const AllMarketContextsWsMessageSchema = z.object({ contexts: MarketContextsSchema });

export type MarketContext = z.infer<typeof MarketContextSchema>;
export type MarketContexts = z.infer<typeof MarketContextsSchema>;
export type AllMarketContextsWsMessage = z.infer<typeof AllMarketContextsWsMessageSchema>;
