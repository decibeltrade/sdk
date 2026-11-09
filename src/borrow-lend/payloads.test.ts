import { describe, expect, it } from "vitest";

import { U64_MAX } from "../u64";
import {
  buildDepositToSubaccountPayload,
  buildRedeemFromLenderPoolPayload,
  buildRepayUsdcPayload,
  buildSetBorrowRescueEnabledPayload,
  buildSupplyToLenderPoolPayload,
  buildWithdrawFromCrossCollateralPayload,
} from "./payloads";

const PACKAGE = "0x4e110";
const SUBACCOUNT = "0x00000000000000000000000000000000000000000000000000000000000000aa";

describe("buildSupplyToLenderPoolPayload", () => {
  it("targets the signer-direct perp entry and passes base units through untouched", () => {
    expect(buildSupplyToLenderPoolPayload({ packageAddress: PACKAGE, amount: "12500000" })).toEqual(
      {
        function: `${PACKAGE}::account_management_apis::supply_to_lender_pool`,
        typeArguments: [],
        functionArguments: ["12500000"],
      },
    );
  });

  it("is exact above Number.MAX_SAFE_INTEGER", () => {
    const payload = buildSupplyToLenderPoolPayload({
      packageAddress: PACKAGE,
      amount: "9007199254740993",
    });
    expect(payload.functionArguments).toEqual(["9007199254740993"]);
  });
});

describe("amount validation", () => {
  const builders = {
    supply: (amount: string) => buildSupplyToLenderPoolPayload({ packageAddress: PACKAGE, amount }),
    repay: (amount: string) =>
      buildRepayUsdcPayload({
        packageAddress: PACKAGE,
        subaccountAddr: SUBACCOUNT,
        amount,
      }),
  };

  describe.each(Object.entries(builders))("%s", (_name, build) => {
    it.each(["0", "", "1.5", "-1", "1e3", " 5 "])("rejects %j", (amount) => {
      expect(() => build(amount)).toThrow();
    });

    it("rejects an amount above u64::MAX", () => {
      expect(() => build((U64_MAX + BigInt(1)).toString())).toThrow();
    });

    it("accepts exactly u64::MAX (repay-all; the contract clamps to debt)", () => {
      expect(build(U64_MAX.toString()).functionArguments?.at(-1)).toBe(U64_MAX.toString());
    });
  });
});

describe("buildRedeemFromLenderPoolPayload", () => {
  it("passes the subaccount and the share amount", () => {
    expect(
      buildRedeemFromLenderPoolPayload({
        packageAddress: PACKAGE,
        subaccountAddr: SUBACCOUNT,
        shares: "1000000",
      }),
    ).toEqual({
      function: `${PACKAGE}::account_management_apis::redeem_from_lender_pool_entry`,
      typeArguments: [],
      functionArguments: [SUBACCOUNT, "1000000"],
    });
  });
});

describe("redeem shares validation", () => {
  const redeem = (shares: string) =>
    buildRedeemFromLenderPoolPayload({
      packageAddress: PACKAGE,
      subaccountAddr: SUBACCOUNT,
      shares,
    });

  it.each(["0", "", "-1", "1.5", " 5 ", "0x10", "0o7", "0b11", "+1", "1e3"])(
    "rejects %j",
    (shares) => {
      expect(() => redeem(shares)).toThrow();
    },
  );

  it("rejects shares above u64::MAX", () => {
    expect(() => redeem((U64_MAX + BigInt(1)).toString())).toThrow();
  });

  it("accepts exactly u64::MAX for a max redeem", () => {
    expect(redeem(U64_MAX.toString()).functionArguments).toEqual([SUBACCOUNT, U64_MAX.toString()]);
  });
});

describe("buildRepayUsdcPayload", () => {
  it("repays the subaccount's debt from its cross margin", () => {
    expect(
      buildRepayUsdcPayload({
        packageAddress: PACKAGE,
        subaccountAddr: SUBACCOUNT,
        amount: "5000000",
      }),
    ).toEqual({
      function: `${PACKAGE}::dex_accounts_entry::repay_usdc_from_subaccount`,
      typeArguments: [],
      functionArguments: [SUBACCOUNT, "5000000"],
    });
  });
});

describe("buildDepositToSubaccountPayload / buildWithdrawFromCrossCollateralPayload", () => {
  const ASSET = "0xa";
  const build = (
    fn: typeof buildDepositToSubaccountPayload,
    amount: Parameters<typeof fn>[0]["amount"],
  ) => fn({ packageAddress: PACKAGE, subaccountAddr: SUBACCOUNT, assetAddr: ASSET, amount });

  it("targets the deposit entry and stringifies the amount", () => {
    expect(build(buildDepositToSubaccountPayload, 1_000_000)).toEqual({
      function: `${PACKAGE}::dex_accounts_entry::deposit_to_subaccount_at`,
      typeArguments: [],
      functionArguments: [SUBACCOUNT, ASSET, "1000000"],
    });
  });

  it("targets the cross-collateral withdraw entry", () => {
    expect(build(buildWithdrawFromCrossCollateralPayload, BigInt(U64_MAX))).toEqual({
      function: `${PACKAGE}::dex_accounts_entry::withdraw_from_cross_collateral`,
      typeArguments: [],
      functionArguments: [SUBACCOUNT, ASSET, U64_MAX.toString()],
    });
  });

  describe.each([
    ["deposit", buildDepositToSubaccountPayload],
    ["withdraw", buildWithdrawFromCrossCollateralPayload],
  ])("%s validation", (_name, fn) => {
    it.each([0, "0", BigInt(0)])("rejects zero %s", (amount) => {
      expect(() => build(fn, amount)).toThrow("amount must be greater than zero");
    });
    it.each([1.5, -1, 2 ** 53, "1.5", "1e3"])("rejects %s", (amount) => {
      expect(() => build(fn, amount)).toThrow();
    });
  });
});

describe("buildSetBorrowRescueEnabledPayload", () => {
  it.each([true, false])("sets the subaccount's rescue flag to %s", (enabled) => {
    expect(
      buildSetBorrowRescueEnabledPayload({
        packageAddress: PACKAGE,
        subaccountAddr: SUBACCOUNT,
        enabled,
      }),
    ).toEqual({
      function: `${PACKAGE}::dex_accounts_entry::set_borrow_rescue_enabled_from_subaccount`,
      typeArguments: [],
      functionArguments: [SUBACCOUNT, enabled],
    });
  });
});

describe("payloads survive JSON serialisation", () => {
  const MAX = U64_MAX.toString();
  const payloads = {
    supply: buildSupplyToLenderPoolPayload({ packageAddress: PACKAGE, amount: MAX }),
    redeem: buildRedeemFromLenderPoolPayload({
      packageAddress: PACKAGE,
      subaccountAddr: SUBACCOUNT,
      shares: MAX,
    }),
    repay: buildRepayUsdcPayload({
      packageAddress: PACKAGE,
      subaccountAddr: SUBACCOUNT,
      amount: MAX,
    }),
    rescue: buildSetBorrowRescueEnabledPayload({
      packageAddress: PACKAGE,
      subaccountAddr: SUBACCOUNT,
      enabled: false,
    }),
  };

  it.each(Object.entries(payloads))("%s round-trips through JSON at u64::MAX", (_name, payload) => {
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
    expect((payload.functionArguments ?? []).some((a) => typeof a === "bigint")).toBe(false);
  });
});
