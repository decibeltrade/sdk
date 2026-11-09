import { Account } from "@aptos-labs/ts-sdk";
import { describe, expect, it, vi } from "vitest";

import { TESTNET_CONFIG } from "./constants";
import { classifyTxKind, ORDER_FUNCTION_KINDS } from "./order-functions";
import { TransactionSubmissionError } from "./submission-error";
import { DecibelWriteDex, TimeInForce } from "./write";

// sendTx / sendEncryptedTx are protected on BaseSDK. Stub them on the instance so
// the only thing under test is submitSubaccountTx's encrypted-vs-plaintext
// routing (`encrypted ?? defaultEncrypted`) — no real build/simulate/submit.
interface SendSpies {
  sendTx: ReturnType<typeof vi.fn>;
  sendEncryptedTx: ReturnType<typeof vi.fn>;
}

function makeWriteDex(defaultEncrypted: boolean): { dex: DecibelWriteDex } & SendSpies {
  const dex = new DecibelWriteDex(TESTNET_CONFIG, Account.generate(), { defaultEncrypted });
  const sendTx = vi.fn().mockResolvedValue({ hash: "0xplaintext" });
  const sendEncryptedTx = vi.fn().mockResolvedValue({ hash: "0xencrypted" });
  const internals = dex as unknown as SendSpies;
  internals.sendTx = sendTx;
  internals.sendEncryptedTx = sendEncryptedTx;
  return { dex, sendTx, sendEncryptedTx };
}

// cancelOrder is a thin front-run-sensitive write that routes straight through
// submitSubaccountTx, so it exercises the routing without extra post-processing.
const CANCEL_ARGS = { orderId: 1, marketAddr: "0xmarket", subaccountAddr: "0xsub" };

describe("DecibelWriteDex encryption routing", () => {
  it("submits plaintext by default (defaultEncrypted false, no per-call override)", async () => {
    const { dex, sendTx, sendEncryptedTx } = makeWriteDex(false);
    await dex.cancelOrder({ ...CANCEL_ARGS });
    expect(sendTx).toHaveBeenCalledTimes(1);
    expect(sendEncryptedTx).not.toHaveBeenCalled();
  });

  it("encrypts by default when defaultEncrypted is true", async () => {
    const { dex, sendTx, sendEncryptedTx } = makeWriteDex(true);
    await dex.cancelOrder({ ...CANCEL_ARGS });
    expect(sendEncryptedTx).toHaveBeenCalledTimes(1);
    expect(sendTx).not.toHaveBeenCalled();
  });

  it("per-call encrypted:true overrides a false default", async () => {
    const { dex, sendTx, sendEncryptedTx } = makeWriteDex(false);
    await dex.cancelOrder({ ...CANCEL_ARGS, encrypted: true });
    expect(sendEncryptedTx).toHaveBeenCalledTimes(1);
    expect(sendTx).not.toHaveBeenCalled();
  });

  it("per-call encrypted:false overrides a true default", async () => {
    const { dex, sendTx, sendEncryptedTx } = makeWriteDex(true);
    await dex.cancelOrder({ ...CANCEL_ARGS, encrypted: false });
    expect(sendTx).toHaveBeenCalledTimes(1);
    expect(sendEncryptedTx).not.toHaveBeenCalled();
  });
});

// Every write that goes through submitSubaccountTx must be an order function, and
// every other write must classify as `other`, so telemetry `txKind` can't drift
// from the encrypted routing.
describe("order function classification guard", () => {
  const M = "0xmarket";
  const S = "0xsub";
  const writes: Array<(dex: DecibelWriteDex) => Promise<unknown>> = [
    (d) => d.createSubaccount(),
    (d) => d.adminCreateSubaccount("0x2"),
    (d) => d.deposit(1, S),
    (d) => d.withdraw(1, S),
    (d) => d.withdrawNonCollateral("0xasset", 1, S),
    (d) =>
      d.configureUserSettingsForMarket({
        marketAddr: M,
        subaccountAddr: S,
        isCross: true,
        userLeverage: 1,
      }),
    (d) =>
      d.placeOrder({
        marketName: "APT/USDC",
        price: 1,
        size: 1,
        isBuy: true,
        timeInForce: TimeInForce.GoodTillCanceled,
        isReduceOnly: false,
      }),
    (d) => d.triggerMatching({ marketAddr: M, maxWorkUnit: 1 }),
    (d) =>
      d.placeTwapOrder({
        marketName: "APT/USDC",
        size: 1,
        isBuy: true,
        isReduceOnly: false,
        twapFrequencySeconds: 60,
        twapDurationSeconds: 600,
      }),
    (d) => d.cancelOrder({ orderId: 1, marketAddr: M }),
    (d) => d.cancelClientOrder({ clientOrderId: "c", marketName: "APT/USDC" }),
    (d) => d.cancelBulkOrder({ marketAddr: M }),
    (d) =>
      d.placeSpotOrder({
        price: 1,
        size: 1,
        isBuy: true,
        timeInForce: TimeInForce.GoodTillCanceled,
        marketAddr: M,
      }),
    (d) => d.cancelSpotOrder({ orderId: 1, marketAddr: M }),
    (d) =>
      d.placeSpotBulkOrder({
        sequenceNumber: 1,
        bidPrices: [],
        bidSizes: [],
        askPrices: [],
        askSizes: [],
        marketAddr: M,
      }),
    (d) => d.cancelSpotBulkOrder({ marketAddr: M }),
    (d) => d.cancelSpotBulkOrderAtPriceLevel({ price: 1, isBuy: true, marketAddr: M }),
    (d) => d.approveMaxSpotBuilderFee({ builderAddr: "0xb", maxFee: 1 }),
    (d) => d.revokeMaxSpotBuilderFee({ builderAddr: "0xb" }),
    (d) => d.setHoldAsNonCollateral({ assetAddr: "0xasset", hold: true }),
    (d) => d.processSpotPendingRequests({ maxFills: 1, marketAddr: M }),
    (d) => d.delegateTradingToForSubaccount({ subaccountAddr: S, accountToDelegateTo: "0xd" }),
    (d) => d.revokeDelegation({ accountToRevoke: "0xd" }),
    (d) => d.placeTpSlOrderForPosition({ marketAddr: M }),
    (d) => d.updateTpOrderForPosition({ marketAddr: M, prevOrderId: 1 }),
    (d) => d.updateSlOrderForPosition({ marketAddr: M, prevOrderId: 1 }),
    (d) => d.cancelTpSlOrderForPosition({ marketAddr: M, orderId: 1 }),
    (d) =>
      d.updateOrder({
        orderId: 1,
        marketAddr: M,
        price: 1,
        size: 1,
        isBuy: true,
        timeInForce: TimeInForce.GoodTillCanceled,
        isReduceOnly: false,
      }),
    (d) => d.cancelTwapOrder({ orderId: "1", marketAddr: M }),
    (d) => d.createVault({} as Parameters<DecibelWriteDex["createVault"]>[0]),
    (d) => d.depositToVault({ vaultAddress: "0xv", amount: 1, subaccountAddr: S }),
    (d) => d.withdrawFromVault({ vaultAddress: "0xv", shares: 1 }),
    (d) => d.approveMaxBuilderFee({ builderAddr: "0xb", maxFee: 1 }),
    (d) => d.revokeMaxBuilderFee({ builderAddr: "0xb" }),
    (d) => d.claimCampaignReward(1),
    (d) => d.openFftTrial({ campaignPackage: "0xc", campaignAddr: "0xa", owner: "0xo" }),
    (d) =>
      d.claimFftUnlock({ campaignPackage: "0xc", campaignAddr: "0xa", lockId: 1n, owner: "0xo" }),
    (d) => d.settleFftTrial({ campaignPackage: "0xc", campaignAddr: "0xa", trialId: 1 }),
    (d) => d.supplyToLenderPool(1),
    (d) => d.redeemFromLenderPool(1, S),
    (d) => d.depositCollateral("0xasset", 1, S),
    (d) => d.withdrawCollateral("0xasset", 1, S),
    (d) => d.repayUsdc(1, S),
    (d) => d.setBorrowRescueEnabled(true, S),
  ];

  it("routes exactly the order functions through submitSubaccountTx", async () => {
    const { dex, sendTx, sendEncryptedTx } = makeWriteDex(true);
    for (const write of writes) await write(dex);

    const functionsOf = (calls: unknown[][]): string[] =>
      calls.map(([payload]) =>
        payload && typeof payload === "object" && "function" in payload
          ? String(payload.function)
          : "",
      );
    const routed = functionsOf(sendEncryptedTx.mock.calls);
    const direct = functionsOf(sendTx.mock.calls);

    expect(routed.map((fn) => fn.split("::").slice(1).join("::")).sort()).toEqual(
      Object.keys(ORDER_FUNCTION_KINDS).sort(),
    );
    expect(direct.length).toBeGreaterThan(0);
    for (const fn of direct) {
      expect(classifyTxKind(fn), fn).toBe("other");
    }
  });
});

describe("borrow-lend writes are u64-exact", () => {
  const PKG = TESTNET_CONFIG.deployment.package;
  const S = `0x${"ab".repeat(32)}`;
  const ASSET = "0xa";
  const MAX = "18446744073709551615";

  const cases: Array<{
    name: string;
    call: (d: DecibelWriteDex, amount: string | bigint | number) => Promise<unknown>;
    fn: string;
    args: (amount: string) => unknown[];
  }> = [
    {
      name: "supplyToLenderPool",
      call: (d, a) => d.supplyToLenderPool(a),
      fn: "account_management_apis::supply_to_lender_pool",
      args: (a) => [a],
    },
    {
      name: "redeemFromLenderPool",
      call: (d, a) => d.redeemFromLenderPool(a, S),
      fn: "account_management_apis::redeem_from_lender_pool_entry",
      args: (a) => [S, a],
    },
    {
      name: "depositCollateral",
      call: (d, a) => d.depositCollateral(ASSET, a, S),
      fn: "dex_accounts_entry::deposit_to_subaccount_at",
      args: (a) => [S, ASSET, a],
    },
    {
      name: "withdrawCollateral",
      call: (d, a) => d.withdrawCollateral(ASSET, a, S),
      fn: "dex_accounts_entry::withdraw_from_cross_collateral",
      args: (a) => [S, ASSET, a],
    },
    {
      name: "repayUsdc",
      call: (d, a) => d.repayUsdc(a, S),
      fn: "dex_accounts_entry::repay_usdc_from_subaccount",
      args: (a) => [S, a],
    },
    {
      name: "deposit",
      call: (d, a) => d.deposit(a, S),
      fn: "dex_accounts_entry::deposit_to_subaccount_at",
      args: (a) => [S, TESTNET_CONFIG.deployment.usdc, a],
    },
    {
      name: "withdraw",
      call: (d, a) => d.withdraw(a, S),
      fn: "dex_accounts_entry::withdraw_from_cross_collateral",
      args: (a) => [S, TESTNET_CONFIG.deployment.usdc, a],
    },
  ];

  describe.each(cases)("$name", ({ call, fn, args }) => {
    it.each([
      ["string", MAX],
      ["bigint", BigInt(MAX)],
    ])("sends a %s amount above 2^53 exactly", async (_kind, amount) => {
      const { dex, sendTx } = makeWriteDex(false);
      await call(dex, amount);
      expect(sendTx.mock.calls[0][0]).toEqual({
        function: `${PKG}::${fn}`,
        typeArguments: [],
        functionArguments: args(MAX),
      });
    });

    it("sends a safe-integer number as a decimal string", async () => {
      const { dex, sendTx } = makeWriteDex(false);
      await call(dex, 1_000_000);
      expect(sendTx.mock.calls[0][0]).toMatchObject({ functionArguments: args("1000000") });
    });

    it.each([2 ** 53, 1.5, -1, Number.NaN, "1e3", "0x10", "1.5", "-1"])(
      "rejects %s before submitting",
      async (amount) => {
        const { dex, sendTx } = makeWriteDex(false);
        await expect(call(dex, amount)).rejects.toThrow();
        expect(sendTx).not.toHaveBeenCalled();
      },
    );
  });

  it.each([
    ["supplyToLenderPool", (d: DecibelWriteDex) => d.supplyToLenderPool(0)],
    ["redeemFromLenderPool", (d: DecibelWriteDex) => d.redeemFromLenderPool(0, S)],
    ["repayUsdc", (d: DecibelWriteDex) => d.repayUsdc(0, S)],
  ])("%s rejects a zero amount like its payload builder", async (_name, call) => {
    const { dex, sendTx } = makeWriteDex(false);
    await expect(call(dex)).rejects.toThrow("must be greater than zero");
    expect(sendTx).not.toHaveBeenCalled();
  });

  it.each([
    ["depositCollateral", (d: DecibelWriteDex) => d.depositCollateral(ASSET, 0, S)],
    ["depositCollateral (string)", (d: DecibelWriteDex) => d.depositCollateral(ASSET, "0", S)],
    ["withdrawCollateral", (d: DecibelWriteDex) => d.withdrawCollateral(ASSET, 0, S)],
    [
      "withdrawCollateral (bigint)",
      (d: DecibelWriteDex) => d.withdrawCollateral(ASSET, BigInt(0), S),
    ],
    ["deposit", (d: DecibelWriteDex) => d.deposit(0, S)],
    ["withdraw", (d: DecibelWriteDex) => d.withdraw(0, S)],
  ])("%s rejects a zero amount like its payload builder (Q3)", async (_name, call) => {
    const { dex, sendTx } = makeWriteDex(false);
    await expect(call(dex)).rejects.toThrow("must be greater than zero");
    expect(sendTx).not.toHaveBeenCalled();
  });

  describe("deposit/withdraw (USDC) input validation, 0.8.2 to 0.9.0 break", () => {
    const INTEGER_MSG = "amount must be a safe integer; pass a string or bigint above 2^53";

    it.each([
      ["deposit", (d: DecibelWriteDex, a: number) => d.deposit(a, S)],
      ["withdraw", (d: DecibelWriteDex, a: number) => d.withdraw(a, S)],
    ])("%s rejects a fractional number with the safe-integer message", async (_n, call) => {
      const { dex, sendTx } = makeWriteDex(false);
      await expect(call(dex, 1.5)).rejects.toThrow(INTEGER_MSG);
      await expect(call(dex, 2 ** 53)).rejects.toThrow(INTEGER_MSG);
      expect(sendTx).not.toHaveBeenCalled();
    });

    it("withdraw(-1) rejects as non-negative", async () => {
      const { dex, sendTx } = makeWriteDex(false);
      await expect(dex.withdraw(-1, S)).rejects.toThrow("amount must be non-negative");
      expect(sendTx).not.toHaveBeenCalled();
    });

    it("deposit(-1) rejects as non-negative", async () => {
      const { dex } = makeWriteDex(false);
      await expect(dex.deposit(-1, S)).rejects.toThrow("amount must be non-negative");
    });
  });

  it("setBorrowRescueEnabled targets the subaccount entry", async () => {
    const { dex, sendTx } = makeWriteDex(false);
    await dex.setBorrowRescueEnabled(false, S);
    expect(sendTx.mock.calls[0][0]).toEqual({
      function: `${PKG}::dex_accounts_entry::set_borrow_rescue_enabled_from_subaccount`,
      typeArguments: [],
      functionArguments: [S, false],
    });
  });
});

const MARKET_NAME = "APT/USDC";
const ORDER_ARGS = {
  marketName: MARKET_NAME,
  price: 500,
  size: 1000,
  isBuy: true,
  timeInForce: TimeInForce.GoodTillCanceled,
  isReduceOnly: false,
};

function makeOrderDex(txResponse: object): { dex: DecibelWriteDex; account: Account } {
  const account = Account.generate();
  const dex = new DecibelWriteDex(TESTNET_CONFIG, account, { defaultEncrypted: false });
  (dex as unknown as SendSpies).sendTx = vi.fn().mockResolvedValue(txResponse);
  return { dex, account };
}

function orderEventTx(user: string) {
  return {
    hash: "0xplaintext",
    events: [
      {
        type: `${TESTNET_CONFIG.deployment.package}::market_types::OrderEvent`,
        data: { order_id: "42", user },
      },
    ],
  };
}

describe("order id extraction", () => {
  it("exposes the same account-scoped decoder for original-transaction recovery", () => {
    const { dex } = makeOrderDex({});
    expect(dex.extractOrderIdFromTransaction(orderEventTx("0x1") as never, "0x1")).toBe("42");
    expect(dex.extractOrderIdFromTransaction(orderEventTx("0x2") as never, "0x1")).toBeNull();
    expect(dex.extractOrderIdFromTransaction({ hash: "0xaccepted" } as never, "0x1")).toBeNull();
  });
  it("extracts the order id when no subaccountAddr is passed", async () => {
    const account = Account.generate();
    const dex = new DecibelWriteDex(TESTNET_CONFIG, account, { defaultEncrypted: false });
    const primarySubaccount = dex.getPrimarySubaccountAddress(account.accountAddress);
    (dex as unknown as SendSpies).sendTx = vi
      .fn()
      .mockResolvedValue(orderEventTx(primarySubaccount));

    const result = await dex.placeOrder({ ...ORDER_ARGS });
    expect(result).toEqual({ success: true, orderId: "42", transactionHash: "0xplaintext" });
  });

  it("matches a supplied subaccountAddr across zero-trimmed and padded forms", async () => {
    const padded = `0x0a11ce${"0".repeat(52)}0a11ce`;
    const trimmed = `0xa11ce${"0".repeat(52)}0a11ce`;
    const { dex } = makeOrderDex(orderEventTx(trimmed));

    const result = await dex.placeOrder({ ...ORDER_ARGS, subaccountAddr: padded });
    expect(result).toEqual({ success: true, orderId: "42", transactionHash: "0xplaintext" });
  });

  it("ignores an event whose user is the owner account rather than its subaccount", async () => {
    const account = Account.generate();
    const dex = new DecibelWriteDex(TESTNET_CONFIG, account, { defaultEncrypted: false });
    (dex as unknown as SendSpies).sendTx = vi
      .fn()
      .mockResolvedValue(orderEventTx(account.accountAddress.toString()));

    const result = await dex.placeOrder({ ...ORDER_ARGS });
    expect(result).toEqual({ success: true, orderId: undefined, transactionHash: "0xplaintext" });
  });

  it("extracts the order id from a TwapEvent for the default subaccount", async () => {
    const account = Account.generate();
    const dex = new DecibelWriteDex(TESTNET_CONFIG, account, { defaultEncrypted: false });
    const primarySubaccount = dex.getPrimarySubaccountAddress(account.accountAddress);
    (dex as unknown as SendSpies).sendTx = vi.fn().mockResolvedValue({
      hash: "0xplaintext",
      events: [
        {
          type: `${TESTNET_CONFIG.deployment.package}::async_matching_engine::TwapEvent`,
          data: { order_id: "77", account: primarySubaccount },
        },
      ],
    });

    const result = await dex.placeTwapOrder({
      marketName: MARKET_NAME,
      size: 1000,
      isBuy: true,
      isReduceOnly: false,
      twapFrequencySeconds: 60,
      twapDurationSeconds: 600,
    });
    expect(result.orderId).toBe("77");
  });
});

describe("placeOrder submission failures", () => {
  it.each(["not-submitted", "reverted", "unknown"] as const)(
    "retains %s provenance in its failure result",
    async (outcome) => {
      const { dex, sendTx } = makeWriteDex(false);
      const submission = { outcome, transactionHash: "0xaccepted" };
      sendTx.mockRejectedValue(new TransactionSubmissionError("order failed", submission));
      expect(await dex.placeOrder(ORDER_ARGS)).toEqual({
        success: false,
        error: "order failed",
        submission,
      });
    },
  );

  it("does not invent provenance for a custom untyped submit override", async () => {
    const { dex, sendTx } = makeWriteDex(false);
    sendTx.mockRejectedValue(new Error("user rejected after submission timeout"));
    const result = await dex.placeOrder(ORDER_ARGS);
    expect(result).toMatchObject({
      success: false,
      error: "user rejected after submission timeout",
    });
    expect("submission" in result && result.submission).toBeUndefined();
  });

  it("flags a failed_decryption commit so the caller can offer a retry", async () => {
    const { dex, sendEncryptedTx } = makeWriteDex(true);
    const submission = { outcome: "reverted" as const, transactionHash: "0xaccepted" };
    const committed = {
      payload: { encrypted_state: "failed_decryption", encryption_epoch: "100" },
    };
    sendEncryptedTx.mockRejectedValue(
      new TransactionSubmissionError("failed", submission, undefined, committed as never),
    );
    expect(await dex.placeOrder(ORDER_ARGS)).toEqual({
      success: false,
      error: "failed",
      submission,
      failedDecryption: true,
      encryptionEpoch: "100",
    });
  });
});

describe("DecibelWriteDex.placeOrder order id extraction", () => {
  const PKG = TESTNET_CONFIG.deployment.package;

  // `eventsFor` receives the signer's primary subaccount so a fixture can name it.
  function dexWithEvents(eventsFor: (primarySubaccount: string) => object[]) {
    const account = Account.generate();
    const dex = new DecibelWriteDex(TESTNET_CONFIG, account);
    const tx = {
      hash: "0xhash",
      events: eventsFor(dex.getPrimarySubaccountAddress(account.accountAddress)),
    };
    const internals = dex as unknown as SendSpies;
    internals.sendTx = vi.fn().mockResolvedValue(tx);
    internals.sendEncryptedTx = vi.fn().mockResolvedValue(tx);
    return dex;
  }

  const ORDER = {
    marketName: "BTC/USD",
    price: 100,
    size: 1,
    isBuy: true,
    timeInForce: TimeInForce.GoodTillCanceled,
    isReduceOnly: false,
  };

  // The order lands on the primary subaccount, so that is who the event names — not the owner.
  it("matches the primary subaccount when no subaccountAddr is passed", async () => {
    const dex = dexWithEvents((primary) => [
      { type: `${PKG}::market_types::OrderEvent`, data: { order_id: "42", user: primary } },
    ]);
    expect(await dex.placeOrder(ORDER)).toMatchObject({ success: true, orderId: "42" });
  });

  it("matches across zero-padding when subaccountAddr is passed", async () => {
    const dex = dexWithEvents(() => [
      { type: `${PKG}::market_types::OrderEvent`, data: { order_id: "42", user: "0xab" } },
    ]);
    const longForm = `0x${"0".repeat(62)}ab`;
    expect(await dex.placeOrder({ ...ORDER, subaccountAddr: longForm })).toMatchObject({
      success: true,
      orderId: "42",
    });
  });

  it("matches a TWAP event by its account field", async () => {
    const sub = `0x${"cd".repeat(32)}`;
    const dex = dexWithEvents(() => [
      { type: `${PKG}::async_matching_engine::TwapEvent`, data: { order_id: "9", account: sub } },
    ]);
    const result = await dex.placeTwapOrder({
      marketName: "BTC/USD",
      size: 1,
      isBuy: true,
      isReduceOnly: false,
      twapFrequencySeconds: 60,
      twapDurationSeconds: 600,
      subaccountAddr: sub,
    });
    expect(result).toMatchObject({ success: true, orderId: "9" });
  });
});
