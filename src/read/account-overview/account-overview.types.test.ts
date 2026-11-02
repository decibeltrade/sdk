import { describe, expect, it } from "vitest";

import { AccountOverviewSchema, BorrowLendOverviewSectionSchema } from "./account-overview.types";

describe("account overview borrow/lend availability", () => {
  it("accepts borrow_lend_unavailable as a string, null, or absent", () => {
    const field = AccountOverviewSchema.shape.borrow_lend_unavailable;
    expect(field.parse("Borrow/lend read timed out")).toBe("Borrow/lend read timed out");
    expect(field.parse(null)).toBeNull();
    expect(field.parse(undefined)).toBeUndefined();
  });

  it("keeps the borrow_lend section optional alongside the marker", () => {
    expect(AccountOverviewSchema.shape.borrow_lend.parse(undefined)).toBeUndefined();
    expect(AccountOverviewSchema.shape.borrow_lend.parse(null)).toBeNull();
  });
});

describe("BorrowLendOverviewSectionSchema rescue_enabled", () => {
  const section = {
    owner: "0xa",
    debt_in_primary: "0",
    liquidatable: false,
    pledges: [],
    collateral_value_in_primary: "0",
    max_weighted_collateral_in_primary: "0",
    borrow_capacity_in_primary: "0",
  };

  it.each([true, false])("keeps a recorded %s", (value) => {
    const parsed = BorrowLendOverviewSectionSchema.parse({ ...section, rescue_enabled: value });
    expect(parsed.rescue_enabled).toBe(value);
  });

  it("reads null from an older server as the chain default, true", () => {
    const parsed = BorrowLendOverviewSectionSchema.parse({ ...section, rescue_enabled: null });
    expect(parsed.rescue_enabled).toBe(true);
  });

  it.each([undefined, "yes"])("rejects a rescue_enabled of %s", (value) => {
    expect(() =>
      BorrowLendOverviewSectionSchema.parse({ ...section, rescue_enabled: value }),
    ).toThrow();
  });
});
