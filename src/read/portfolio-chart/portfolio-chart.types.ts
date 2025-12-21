import z from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export interface PortfolioChartRequestArgs extends BaseRequestArgs {
  subAddr: string;
  range: PortfolioChartTimeRange;
  type: PortfolioChartType;
}

export const PortfolioChartPnlItemSchema = z.object({
  timestamp: z.number(),
  data_points: z.number(),
});

export const PortfolioChartSchema = z.array(PortfolioChartPnlItemSchema);

export type PortfolioChartType = "pnl" | "account_value";
export type PortfolioChartTimeRange = "24h" | "7d" | "30d" | "90d";
export type PortfolioChartItem = z.infer<typeof PortfolioChartPnlItemSchema>;
export type PortfolioChart = z.infer<typeof PortfolioChartSchema>;
