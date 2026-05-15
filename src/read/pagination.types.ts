import z from "zod/v4";

export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total_count: z.number().optional(),
  });

export interface PaginatedResponse<T> {
  items: T[];
  total_count?: number;
}

// Page related types
export interface PageParams {
  limit?: number;
  offset?: number;
}

// History filter params supported by all history endpoints
export interface HistoryFilterParams {
  /** Unix milliseconds, inclusive start of date range */
  startTimestamp?: number;
  /** Unix milliseconds, inclusive end of date range */
  endTimestamp?: number;
  /** Sort direction for results */
  sortDir?: "ASC" | "DESC";
}
