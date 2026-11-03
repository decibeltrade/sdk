import { describe, expect, it } from "vitest";

import { UserFundHistoryResponseSchema } from "./user-fund-history.types";

function fund(movement_type: string) {
  return {
    movement_type,
    amount: 500,
    balance_after: 1500,
    timestamp: 1_700_000_000_000,
    transaction_version: 11,
  };
}

describe("UserFundHistoryResponseSchema", () => {
  it("accepts every movement type the API returns", () => {
    const types = ["deposit", "withdrawal", "reward", "borrow_lend_in", "borrow_lend_out"];
    const parsed = UserFundHistoryResponseSchema.parse({
      funds: types.map(fund),
      total: types.length,
    });
    expect(parsed.funds.map((f) => f.movement_type)).toEqual(types);
  });

  it("rejects an unknown movement type", () => {
    const result = UserFundHistoryResponseSchema.safeParse({ funds: [fund("bonus")], total: 1 });
    expect(result.success).toBe(false);
  });
});
