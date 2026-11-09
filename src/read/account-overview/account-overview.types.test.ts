import { describe, expect, it } from "vitest";

import {
  AccountOverviewSchema,
  AccountOverviewWsMessageSchema,
  BorrowLendOverviewSectionSchema,
} from "./account-overview.types";

const BASE_OVERVIEW = {
  owner: "0xa",
  perp_equity_balance: 100,
  unrealized_pnl: 0,
  unrealized_funding_cost: 0,
  cross_margin_ratio: 0,
  maintenance_margin: 0,
  cross_account_leverage_ratio: null,
  volume: null,
  all_time_return: null,
  pnl_90d: null,
  sharpe_ratio: null,
  max_drawdown: null,
  weekly_win_rate_12w: null,
  average_cash_position: null,
  average_leverage: null,
  cross_account_position: 0,
  total_margin: 100,
  usdc_cross_withdrawable_balance: 100,
  usdc_isolated_withdrawable_balance: 0,
  realized_pnl: null,
  liquidation_fees_paid: null,
  liquidation_losses: null,
};

const BORROW_LEND_SECTION = {
  owner: "0xa",
  rescue_enabled: true,
  debt_usdc: "5000000",
  liquidatable: false,
  pledges: [
    {
      asset: "0xdlp",
      decimals: 6,
      amount: "10000000",
      value_usdc: "10000000",
      max_weighted_value_usdc: "8000000",
      target_weighted_value_usdc: "6000000",
      max_ltv_bps: 8000,
      target_ltv_bps: 6000,
      price_usdc_per_unit: "1000000",
    },
  ],
  collateral_value_usdc: "10000000",
  max_weighted_collateral_usdc: "8000000",
  borrow_capacity_usdc: "1000000",
};

describe("AccountOverviewSchema borrow_lend section", () => {
  it("parses an overview that carries the section", () => {
    const parsed = AccountOverviewSchema.parse({
      ...BASE_OVERVIEW,
      borrow_lend: BORROW_LEND_SECTION,
    });
    expect(parsed.borrow_lend?.pledges[0]?.target_ltv_bps).toBe(6000);
    expect(parsed.borrow_lend?.debt_usdc).toBe("5000000");
  });

  it("parses an overview without the section, as served when borrow/lend is disabled", () => {
    const parsed = AccountOverviewSchema.parse(BASE_OVERVIEW);
    expect(parsed.borrow_lend).toBeUndefined();
  });

  it("accepts a null section", () => {
    expect(
      AccountOverviewSchema.parse({ ...BASE_OVERVIEW, borrow_lend: null }).borrow_lend,
    ).toBeNull();
  });

  it("is inherited by the WS message", () => {
    const { volume: _volume, ...wsOverview } = BASE_OVERVIEW;
    const parsed = AccountOverviewWsMessageSchema.parse({
      account_overview: { ...wsOverview, borrow_lend: BORROW_LEND_SECTION },
    });
    expect(parsed.account_overview.borrow_lend?.liquidatable).toBe(false);
  });
});

describe("BorrowLendOverviewSectionSchema", () => {
  it("rejects a non-boolean rescue_enabled", () => {
    expect(() =>
      BorrowLendOverviewSectionSchema.parse({ ...BORROW_LEND_SECTION, rescue_enabled: "yes" }),
    ).toThrow();
  });

  it.each([true, false])("round-trips a boolean rescue_enabled of %s", (value) => {
    const parsed = BorrowLendOverviewSectionSchema.parse({
      ...BORROW_LEND_SECTION,
      rescue_enabled: value,
    });
    expect(parsed.rescue_enabled).toBe(value);
  });

  it("accepts a lender-only section: null rescue_enabled parses as true and a null pledge price", () => {
    const parsed = BorrowLendOverviewSectionSchema.parse({
      ...BORROW_LEND_SECTION,
      rescue_enabled: null,
      pledges: [{ ...BORROW_LEND_SECTION.pledges[0], price_usdc_per_unit: null }],
    });
    expect(parsed.rescue_enabled).toBe(true);
    expect(parsed.pledges[0]?.price_usdc_per_unit).toBeNull();
  });

  it.each(["0", null])("accepts a pledge price of %s (Delisting / unpriced)", (price) => {
    const parsed = BorrowLendOverviewSectionSchema.parse({
      ...BORROW_LEND_SECTION,
      liquidatable: price === "0",
      pledges: [{ ...BORROW_LEND_SECTION.pledges[0], price_usdc_per_unit: price }],
    });
    expect(parsed.pledges[0]?.price_usdc_per_unit).toBe(price);
  });

  it.each(["-1", "1.5", ""])("rejects a pledge price of %j", (price) => {
    expect(() =>
      BorrowLendOverviewSectionSchema.parse({
        ...BORROW_LEND_SECTION,
        pledges: [{ ...BORROW_LEND_SECTION.pledges[0], price_usdc_per_unit: price }],
      }),
    ).toThrow();
  });

  it("rejects a malformed amount or a fractional bps", () => {
    const [pledge] = BORROW_LEND_SECTION.pledges;
    for (const bad of [{ amount: "1e6" }, { value_usdc: "-1" }, { target_ltv_bps: 1.5 }]) {
      expect(() =>
        BorrowLendOverviewSectionSchema.parse({
          ...BORROW_LEND_SECTION,
          pledges: [{ ...pledge, ...bad }],
        }),
      ).toThrow();
    }
  });

  it("rejects a section missing a required field", () => {
    const { borrow_capacity_usdc: _dropped, ...incomplete } = BORROW_LEND_SECTION;
    expect(() => BorrowLendOverviewSectionSchema.parse(incomplete)).toThrow();
  });
});

describe("AccountOverviewSchema borrow_lend_unavailable", () => {
  it("keeps the marker the server sets when the BL section could not be read", () => {
    const parsed = AccountOverviewSchema.parse({
      ...BASE_OVERVIEW,
      borrow_lend_unavailable: "Borrow/lend read timed out",
    });
    expect(parsed.borrow_lend_unavailable).toBe("Borrow/lend read timed out");
  });

  it("accepts null or absent for servers without the marker", () => {
    expect(
      AccountOverviewSchema.parse({ ...BASE_OVERVIEW, borrow_lend_unavailable: null })
        .borrow_lend_unavailable,
    ).toBeNull();
    expect(AccountOverviewSchema.parse(BASE_OVERVIEW).borrow_lend_unavailable).toBeUndefined();
  });
});

describe("AccountOverviewSchema borrow_lend isolation", () => {
  const malformedSections = {
    "a non-boolean rescue_enabled": { ...BORROW_LEND_SECTION, rescue_enabled: "yes" },
    "a malformed uintString": { ...BORROW_LEND_SECTION, debt_usdc: "-1.5" },
  };

  for (const [name, section] of Object.entries(malformedSections)) {
    it(`keeps the overview when the section has ${name}`, () => {
      const parsed = AccountOverviewSchema.parse({ ...BASE_OVERVIEW, borrow_lend: section });
      expect(parsed.borrow_lend).toBeNull();
      expect(parsed.borrow_lend_unavailable).toBeTruthy();
      expect(parsed.perp_equity_balance).toBe(BASE_OVERVIEW.perp_equity_balance);
    });

    it(`keeps the WS overview when the section has ${name}`, () => {
      const { volume: _volume, ...wsOverview } = BASE_OVERVIEW;
      const parsed = AccountOverviewWsMessageSchema.parse({
        account_overview: { ...wsOverview, borrow_lend: section },
      });
      expect(parsed.account_overview.borrow_lend).toBeNull();
      expect(parsed.account_overview.borrow_lend_unavailable).toBeTruthy();
    });
  }

  it("leaves a valid section untouched, with no unavailable marker", () => {
    const parsed = AccountOverviewSchema.parse({
      ...BASE_OVERVIEW,
      borrow_lend: BORROW_LEND_SECTION,
    });
    expect(parsed.borrow_lend).toEqual(BORROW_LEND_SECTION);
    expect(parsed.borrow_lend_unavailable).toBeUndefined();
  });

  it("preserves a server-supplied unavailable reason over the generic one", () => {
    const parsed = AccountOverviewSchema.parse({
      ...BASE_OVERVIEW,
      borrow_lend: { ...BORROW_LEND_SECTION, rescue_enabled: "yes" },
      borrow_lend_unavailable: "Borrow/lend read timed out",
    });
    expect(parsed.borrow_lend_unavailable).toBe("Borrow/lend read timed out");
  });

  it("still rejects an overview whose non-borrow/lend fields are malformed", () => {
    expect(() =>
      AccountOverviewSchema.parse({ ...BASE_OVERVIEW, perp_equity_balance: "x" }),
    ).toThrow();
  });
});

describe("AccountOverviewSchema borrow_lend isolation edge cases", () => {
  it("replaces an empty-string unavailable marker with the generic one", () => {
    const parsed = AccountOverviewSchema.parse({
      ...BASE_OVERVIEW,
      borrow_lend: { ...BORROW_LEND_SECTION, rescue_enabled: "yes" },
      borrow_lend_unavailable: "",
    });
    expect(parsed.borrow_lend).toBeNull();
    expect(parsed.borrow_lend_unavailable).toBe("Borrow/lend section failed to parse");
  });

  it("leaves an explicit undefined section untouched, with no marker", () => {
    const parsed = AccountOverviewSchema.parse({ ...BASE_OVERVIEW, borrow_lend: undefined });
    expect(parsed.borrow_lend).toBeUndefined();
    expect(parsed.borrow_lend_unavailable).toBeUndefined();
  });

  it("keeps a server marker on the WS overview and nulls the malformed section", () => {
    const { volume: _volume, ...wsOverview } = BASE_OVERVIEW;
    const parsed = AccountOverviewWsMessageSchema.parse({
      account_overview: {
        ...wsOverview,
        borrow_lend: { ...BORROW_LEND_SECTION, rescue_enabled: "yes" },
        borrow_lend_unavailable: "x",
      },
    });
    expect(parsed.account_overview.borrow_lend).toBeNull();
    expect(parsed.account_overview.borrow_lend_unavailable).toBe("x");
  });

  it("parses a null rescue_enabled through the HTTP isolation as true, with no marker", () => {
    const parsed = AccountOverviewSchema.parse({
      ...BASE_OVERVIEW,
      borrow_lend: { ...BORROW_LEND_SECTION, rescue_enabled: null },
    });
    expect(parsed.borrow_lend?.rescue_enabled).toBe(true);
    expect(parsed.borrow_lend_unavailable).toBeUndefined();
  });
});

describe("BorrowLendOverviewSectionSchema rescue_enabled", () => {
  const section = {
    owner: "0xa",
    debt_usdc: "0",
    liquidatable: false,
    pledges: [],
    collateral_value_usdc: "0",
    max_weighted_collateral_usdc: "0",
    borrow_capacity_usdc: "0",
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
