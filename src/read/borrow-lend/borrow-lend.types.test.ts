import { describe, expect, it } from "vitest";

import accountBorrower from "./__fixtures__/account_borrower.json";
import accountLenderOnly from "./__fixtures__/account_lender_only.json";
import pool from "./__fixtures__/pool.json";
import rateHistory from "./__fixtures__/rate_history.json";
import {
  BorrowLendAccountSchema,
  BorrowLendActivitySchema,
  BorrowLendPoolSchema,
  BorrowLendRateHistorySchema,
  BorrowLendRatePointSchema,
} from "./borrow-lend.types";

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

  it("carries the current protocol fees as numbers", () => {
    const parsed = BorrowLendPoolSchema.parse(pool);
    expect(parsed.treasury_fee_bps).toBe(1000);
    expect(parsed.insurance_fee_bps).toBe(500);
  });

  it.each(["treasury_fee_bps", "insurance_fee_bps"])("requires %s", (field) => {
    const { [field]: _omitted, ...incomplete } = pool as Record<string, unknown>;
    expect(() => BorrowLendPoolSchema.parse(incomplete)).toThrow();
  });

  it.each(["treasury_fee_bps", "insurance_fee_bps"])("rejects a string %s", (field) => {
    expect(() => BorrowLendPoolSchema.parse({ ...pool, [field]: "1000" })).toThrow();
  });
});

describe("BorrowLendAccountSchema", () => {
  it("parses a borrower with a recorded policy", () => {
    const parsed = BorrowLendAccountSchema.parse(accountBorrower);
    expect(parsed.rescue_enabled).toBe(true);
    expect(parsed.debt).toBeTypeOf("string");
  });

  it("reads the chain default for a lender-only account", () => {
    const parsed = BorrowLendAccountSchema.parse(accountLenderOnly);
    expect(parsed.rescue_enabled).toBe(true);
  });

  it.each([null, "yes"])("rejects a rescue_enabled of %s", (value) => {
    expect(() =>
      BorrowLendAccountSchema.parse({ ...accountLenderOnly, rescue_enabled: value }),
    ).toThrow();
  });
});

describe("BorrowLendActivitySchema", () => {
  const liquidation = {
    source: { transaction_version: "42", transaction_unix_ms: 100123 },
    event_index: "6",
    account: "0xborrower",
    event_type: "Liquidation",
    reason: "Borrower",
    counterparty: "0xliquidator",
    asset: "0xasset",
    amount: "100",
    shares: "0",
    secondary_amount: "25",
    protocol_fee_amount: "2",
    reaches_target: false,
    is_full_repay: false,
    target_amount: "110",
    insurance_amount: "1",
  };

  it("parses a liquidation row with its target and insurance amounts", () => {
    const parsed = BorrowLendActivitySchema.parse(liquidation);
    expect(parsed.target_amount).toBe("110");
    expect(parsed.insurance_amount).toBe("1");
  });

  it("parses the liquidator's row of the same liquidation with its side", () => {
    const parsed = BorrowLendActivitySchema.parse({
      ...liquidation,
      account: "0xliquidator",
      counterparty: "0xborrower",
      reason: "Liquidator",
    });
    expect(parsed.reason).toBe("Liquidator");
    expect(parsed.secondary_amount).toBe("25");
  });

  it.each(["target_amount", "insurance_amount"])("requires %s", (field) => {
    const { [field]: _omitted, ...incomplete } = liquidation as Record<string, unknown>;
    expect(() => BorrowLendActivitySchema.parse(incomplete)).toThrow();
  });
});

describe("BorrowLendRateHistorySchema", () => {
  it("parses a serialized rate history that keeps bad-debt losses apart from the supply rate", () => {
    const parsed = BorrowLendRateHistorySchema.parse(rateHistory);
    expect(parsed.points.map((point) => point.bucket_start)).toEqual([
      3_600_000, 7_200_000, 10_800_000,
    ]);
    const [earning, partialLoss, wipedOut] = parsed.points;
    expect(earning.supply_apr_ray).not.toBe("0");
    expect(earning.supply_bad_debt_loss_ray).toBe("0");
    expect(partialLoss.supply_apr_ray).toBe("0");
    expect(partialLoss.supply_bad_debt_loss_ray).not.toBe("0");
    expect(wipedOut.supply_apr_ray).toBeNull();
    expect(wipedOut.supply_bad_debt_loss_ray).toBe("1000000000000000000000000000");
  });

  it.each(["supply_apr_ray", "supply_bad_debt_loss_ray"] as const)(
    "rejects a negative %s",
    (key) => {
      const [point] = rateHistory.points;
      expect(() => BorrowLendRatePointSchema.parse({ ...point, [key]: "-1" })).toThrow();
    },
  );

  it.each(["1.5", "", "1e27", "--1"])("rejects a borrow_apr_ray of %j", (value) => {
    const [point] = rateHistory.points;
    expect(() => BorrowLendRatePointSchema.parse({ ...point, borrow_apr_ray: value })).toThrow();
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

  it("declares every key a rate history point emits", () => {
    expect(declaredKeys(BorrowLendRatePointSchema)).toEqual(
      Object.keys(rateHistory.points[0]).sort(),
    );
  });
});
