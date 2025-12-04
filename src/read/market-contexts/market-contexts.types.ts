import z from "zod/v4";

export const MarketContextSchema = z.object({
  market: z.string(),
  volume_24h: z.number(),
  open_interest: z.number(),
  mark_price: z.number(),
  mid_price: z.number(),
  oracle_price: z.number(),
  previous_day_price: z.number(),
  price_change_pct_24h: z.number(),
  price_history: z.array(z.number()),
});

export const MarketContextsSchema = z.array(MarketContextSchema);

export type MarketContext = z.infer<typeof MarketContextSchema>;
export type MarketContexts = z.infer<typeof MarketContextsSchema>;
