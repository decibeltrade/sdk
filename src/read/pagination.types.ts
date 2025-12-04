import z from "zod/v4";

export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total_count: z.number(),
  });

export interface PaginatedResponse<T> {
  items: T[];
  total_count: number;
}

// Page related types
export interface PageParams {
  limit?: number;
  offset?: number;
}
