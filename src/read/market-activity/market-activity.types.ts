import z from "zod/v4";

/**
 * `/api/v1/market_activity`, keyed by market name. camelCase on purpose, unlike the rest of the
 * wire: it matches the web decoder's shape. An unmeasured figure is `null`, never `0`.
 */
export const ActivityWindowFiguresSchema = z.object({
  changePct: z.number().nullable(),
  dollarVolume: z.number().nullable(),
  priorDollarVolume: z.number().nullable(),
  multiple: z.number().nullable(),
});

export const ActivityFiguresSchema = z.object({
  windows: z.record(z.string(), ActivityWindowFiguresSchema),
  lastCloseMs: z.number().nullable(),
  firstCloseMs: z.number().nullable(),
  rows: z.number(),
});

/** The sparkline, compressed: a start time and per-point offsets in whole hours. */
export const ActivitySeriesSchema = z.object({
  t0: z.number(),
  o: z.array(z.number()),
  c: z.array(z.number()),
});

export const MarketActivityRowSchema = z.object({
  figures: ActivityFiguresSchema,
  series: ActivitySeriesSchema.nullable(),
});

export const MarketActivitySchema = z.object({
  producedAt: z.number(),
  intervalMs: z.number(),
  seriesDays: z.number(),
  windowDays: z.number(),
  markets: z.record(z.string(), MarketActivityRowSchema),
});

export type ActivityWindowFigures = z.infer<typeof ActivityWindowFiguresSchema>;
export type ActivityFigures = z.infer<typeof ActivityFiguresSchema>;
export type ActivitySeries = z.infer<typeof ActivitySeriesSchema>;
export type MarketActivityRow = z.infer<typeof MarketActivityRowSchema>;
export type MarketActivity = z.infer<typeof MarketActivitySchema>;
