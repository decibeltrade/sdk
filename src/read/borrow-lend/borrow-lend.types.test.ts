import { describe, expect, it } from "vitest";

import accountBorrower from "./__fixtures__/account_borrower.json";
import accountLenderOnly from "./__fixtures__/account_lender_only.json";
import pool from "./__fixtures__/pool.json";
import { BorrowLendAccountSchema, BorrowLendPoolSchema } from "./borrow-lend.types";

/**
 * The fixtures are written by `cargo test -p trading-api --lib write_sdk_fixtures`
 * from the real DTOs, so these assert against what the server emits rather
 * than against hand-written JSON that can drift from it.
 */
describe("BorrowLendPoolSchema", () => {
  it("parses a serialized pool DTO", () => {
    expect(() => BorrowLendPoolSchema.parse(pool)).not.toThrow();
  });

  it("carries the pool figures at the stored indices", () => {
    const parsed = BorrowLendPoolSchema.parse(pool);
    expect(parsed.available_liquidity).toBe("10");
    expect(parsed.total_debt).toBeTypeOf("string");
    expect(parsed.total_lender_claim).toBeTypeOf("string");
    expect(parsed.indices_as_of_secs).toBe("1000");
  });
});

describe("BorrowLendAccountSchema", () => {
  it("parses a borrower with a recorded policy", () => {
    const parsed = BorrowLendAccountSchema.parse(accountBorrower);
    expect(parsed.rescue_enabled).toBe(true);
    expect(parsed.debt).toBeTypeOf("string");
  });

  it("accepts a lender-only account whose rescue_enabled is null", () => {
    const parsed = BorrowLendAccountSchema.parse(accountLenderOnly);
    expect(parsed.rescue_enabled).toBeNull();
  });

  it("rejects a rescue_enabled that is neither a boolean nor null", () => {
    expect(() =>
      BorrowLendAccountSchema.parse({ ...accountLenderOnly, rescue_enabled: "yes" }),
    ).toThrow();
  });
});

/**
 * These pin every key the server emits, so a field the schema forgot cannot
 * hide as an undeclared one.
 */
describe("schema coverage of the serialized DTOs", () => {
  const declaredKeys = (schema: { shape: Record<string, unknown> }) =>
    Object.keys(schema.shape).sort();

  it("declares every key the pool DTO emits", () => {
    expect(declaredKeys(BorrowLendPoolSchema)).toEqual(Object.keys(pool).sort());
  });

  it("declares every key the account DTO emits", () => {
    expect(declaredKeys(BorrowLendAccountSchema)).toEqual(Object.keys(accountBorrower).sort());
  });
});
