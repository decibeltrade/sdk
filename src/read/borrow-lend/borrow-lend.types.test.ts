import { describe, expect, it } from "vitest";

import accountBorrower from "./__fixtures__/account_borrower.json";
import accountLenderOnly from "./__fixtures__/account_lender_only.json";
import pool from "./__fixtures__/pool.json";
import rateHistory from "./__fixtures__/rate_history.json";
import {
  BORROW_LEND_HISTORY_UNAVAILABLE_REASONS,
  BorrowLendAccountSchema,
  BorrowLendActivitySchema,
  BorrowLendCollateralSchema,
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
    const incomplete = Object.fromEntries(Object.entries(pool).filter(([key]) => key !== field));
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
    expect(parsed.debt_usdc).toBeTypeOf("string");
  });

  it("reads the chain default for a lender-only account", () => {
    const parsed = BorrowLendAccountSchema.parse(accountLenderOnly);
    expect(parsed.rescue_enabled).toBe(true);
  });

  it.each([true, false])("round-trips a boolean rescue_enabled of %s", (value) => {
    const parsed = BorrowLendAccountSchema.parse({ ...accountLenderOnly, rescue_enabled: value });
    expect(parsed.rescue_enabled).toBe(value);
  });

  it("parses a null rescue_enabled as the chain default", () => {
    const parsed = BorrowLendAccountSchema.parse({ ...accountLenderOnly, rescue_enabled: null });
    expect(parsed.rescue_enabled).toBe(true);
  });

  it("rejects a non-boolean rescue_enabled", () => {
    expect(() =>
      BorrowLendAccountSchema.parse({ ...accountLenderOnly, rescue_enabled: "yes" }),
    ).toThrow();
  });

  const splitFields = [
    "debt_principal_usdc",
    "debt_interest_usdc",
    "lender_net_supplied_usdc",
    "lender_earned_usdc",
  ];

  it("carries the debt and lender splits as raw-unit strings", () => {
    const parsed = BorrowLendAccountSchema.parse(accountBorrower);
    expect(parsed.debt_principal_usdc).toBe("40");
    expect(parsed.debt_interest_usdc).toBe("10");
    expect(parsed.lender_net_supplied_usdc).toBe("0");
    expect(parsed.lender_earned_usdc).toBe("0");
  });

  const reasonFields = ["debt_split_unavailable", "lender_earnings_unavailable"];

  it("reads an unavailable split as null values with its reason", () => {
    const parsed = BorrowLendAccountSchema.parse(accountLenderOnly);
    expect(parsed.lender_net_supplied_usdc).toBeNull();
    expect(parsed.lender_earned_usdc).toBeNull();
    expect(parsed.lender_earnings_unavailable).toBe("history_lagging");
    expect(parsed.debt_principal_usdc).toBe("0");
    expect(parsed.debt_split_unavailable).toBeNull();
  });

  it.each([accountBorrower, accountLenderOnly])(
    "has null values exactly when the split has a reason",
    (fixture) => {
      const parsed = BorrowLendAccountSchema.parse(fixture);
      const sides = [
        [[parsed.debt_principal_usdc, parsed.debt_interest_usdc], parsed.debt_split_unavailable],
        [
          [parsed.lender_net_supplied_usdc, parsed.lender_earned_usdc],
          parsed.lender_earnings_unavailable,
        ],
      ] as const;
      for (const [values, reason] of sides) {
        for (const value of values) {
          expect(value === null).toBe(reason !== null);
        }
      }
    },
  );

  it("parses a server that predates the split fields", () => {
    const legacy = Object.fromEntries(
      Object.entries(accountBorrower).filter(
        ([key]) => !splitFields.includes(key) && !reasonFields.includes(key),
      ),
    );
    const parsed = BorrowLendAccountSchema.parse(legacy);
    expect(parsed.debt_interest_usdc).toBeUndefined();
    expect(parsed.debt_split_unavailable).toBeUndefined();
  });

  it.each(BORROW_LEND_HISTORY_UNAVAILABLE_REASONS)("parses the known reason %s", (reason) => {
    const parsed = BorrowLendAccountSchema.parse({
      ...accountLenderOnly,
      lender_earnings_unavailable: reason,
    });
    expect(parsed.lender_earnings_unavailable).toBe(reason);
  });

  it("reads a debt row that predates carried interest as an unavailable debt split", () => {
    const parsed = BorrowLendAccountSchema.parse({
      ...accountBorrower,
      debt_principal_usdc: null,
      debt_interest_usdc: null,
      debt_split_unavailable: "interest_not_reported",
    });
    expect(parsed.debt_split_unavailable).toBe("interest_not_reported");
    expect(parsed.debt_interest_usdc).toBeNull();
    expect(parsed.debt_usdc).toBe(accountBorrower.debt_usdc);
  });

  it("accepts a reason added by a newer server", () => {
    const parsed = BorrowLendAccountSchema.parse({
      ...accountLenderOnly,
      lender_earnings_unavailable: "history_reindexing",
    });
    expect(parsed.lender_earnings_unavailable).toBe("history_reindexing");
  });

  it.each([...splitFields, ...reasonFields])("rejects a numeric %s", (field) => {
    expect(() => BorrowLendAccountSchema.parse({ ...accountBorrower, [field]: 10 })).toThrow();
  });

  it("accepts a negative lender net supplied", () => {
    const parsed = BorrowLendAccountSchema.parse({
      ...accountBorrower,
      lender_net_supplied_usdc: "-50",
      lender_earned_usdc: "50",
    });
    expect(parsed.lender_net_supplied_usdc).toBe("-50");
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

  it.each(["target_amount", "insurance_amount"])("rejects a non-u64 %s", (field) => {
    for (const bad of ["-1", "1.5", ""]) {
      expect(() => BorrowLendActivitySchema.parse({ ...liquidation, [field]: bad })).toThrow();
    }
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

describe("numeric string fields", () => {
  it.each(["available_liquidity", "total_debt", "total_lender_claim", "supply_apr_ray"])(
    "rejects a malformed pool %s",
    (field) => {
      for (const bad of ["1e-7", "-1", "1.5", "", "abc"]) {
        expect(() => BorrowLendPoolSchema.parse({ ...pool, [field]: bad })).toThrow();
      }
    },
  );

  it("rejects a negative or fractional bps number", () => {
    expect(() => BorrowLendPoolSchema.parse({ ...pool, treasury_fee_bps: -1 })).toThrow();
    expect(() => BorrowLendPoolSchema.parse({ ...pool, treasury_fee_bps: 1.5 })).toThrow();
  });

  it("accepts negative activity shares (a lender redemption) but not malformed ones", () => {
    const activity = {
      source: { transaction_version: "1", transaction_unix_ms: 1 },
      event_index: "0",
      account: "0x1",
      event_type: "lender_redeemed",
      reason: "",
      counterparty: "",
      asset: "0x2",
      amount: "90",
      shares: "-90",
      secondary_amount: "0",
      protocol_fee_amount: "0",
      reaches_target: false,
      is_full_repay: false,
      target_amount: "0",
      insurance_amount: "0",
    };
    expect(BorrowLendActivitySchema.parse(activity).shares).toBe("-90");
    for (const bad of ["--1", "-", "1.5", "", "-1e2"]) {
      expect(() => BorrowLendActivitySchema.parse({ ...activity, shares: bad })).toThrow();
    }
  });
});

describe("BorrowLendCollateralSchema value_usdc_per_unit", () => {
  const collateral = {
    asset: "0xabc",
    decimals: 8,
    max_collateral_units: "1000",
    value_usdc_per_unit: "1",
    max_ltv_bps: 8000,
    target_ltv_bps: 6000,
    liquidation_bonus_bps: 500,
    liquidation_protocol_fee_bps: 100,
  };

  it.each(["0", null])("accepts %s (Delisting price / unpriced)", (price) => {
    const parsed = BorrowLendCollateralSchema.parse({
      ...collateral,
      value_usdc_per_unit: price,
    });
    expect(parsed.value_usdc_per_unit).toBe(price);
  });

  it.each(["-1", "1.5", ""])("rejects %j", (price) => {
    expect(() =>
      BorrowLendCollateralSchema.parse({ ...collateral, value_usdc_per_unit: price }),
    ).toThrow();
  });
});

describe("BorrowLendAccountSchema and ray strings", () => {
  it("rejects an account whose rescue_enabled key is absent", () => {
    const { rescue_enabled: _omit, ...withoutKey } = accountBorrower;
    expect(() => BorrowLendAccountSchema.parse(withoutKey)).toThrow();
  });

  it("accepts a 1e27 ray string, which exceeds u64", () => {
    const ray = `1${"0".repeat(27)}`;
    const parsed = BorrowLendPoolSchema.parse({ ...pool, utilization_ray: ray });
    expect(parsed.utilization_ray).toBe(ray);
  });
});

describe("BorrowLendCollateralSchema live testnet item", () => {
  it("parses the APT collateral as served (price 0.634248, 8 dp)", () => {
    const parsed = BorrowLendCollateralSchema.parse({
      asset: "0xa",
      decimals: 8,
      max_collateral_units: "25000000000000",
      value_usdc_per_unit: "634248",
      max_ltv_bps: 6300,
      target_ltv_bps: 5800,
      liquidation_bonus_bps: 750,
      liquidation_protocol_fee_bps: 1000,
    });
    expect(parsed.value_usdc_per_unit).toBe("634248");
  });
});
