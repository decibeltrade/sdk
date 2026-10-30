import { describe, expect, it } from "vitest";

import { AccountOverviewSchema } from "./account-overview.types";

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
