import { Account } from "@aptos-labs/ts-sdk";
import { describe, expect, it, vi } from "vitest";

import { TESTNET_CONFIG } from "./constants";
import { getSpotMarketAddr } from "./utils";
import { DecibelWriteDex, TimeInForce } from "./write";

const PKG = TESTNET_CONFIG.deployment.package;
const SUB = `0x${"ab".repeat(32)}`;
const BUILDER = `0x${"cd".repeat(32)}`;
const MARKET_NAME = "APT/USDC";
const MARKET_ADDR = getSpotMarketAddr(MARKET_NAME, PKG).toString();

// Same harness as write.test.ts: stub the protected sendTx / sendEncryptedTx on
// the instance so tests assert only the entry-function payloads the spot
// methods build — no real build/simulate/submit.
interface SendSpies {
  sendTx: ReturnType<typeof vi.fn>;
  sendEncryptedTx: ReturnType<typeof vi.fn>;
}

interface EntryPayload {
  function: string;
  functionArguments: unknown[];
}

function makeWriteDex(opts?: { defaultEncrypted?: boolean; txResponse?: object }): {
  dex: DecibelWriteDex;
} & SendSpies {
  const dex = new DecibelWriteDex(TESTNET_CONFIG, Account.generate(), {
    defaultEncrypted: opts?.defaultEncrypted ?? false,
  });
  const tx = opts?.txResponse ?? { hash: "0xhash" };
  const sendTx = vi.fn().mockResolvedValue(tx);
  const sendEncryptedTx = vi.fn().mockResolvedValue(tx);
  const internals = dex as unknown as SendSpies;
  internals.sendTx = sendTx;
  internals.sendEncryptedTx = sendEncryptedTx;
  return { dex, sendTx, sendEncryptedTx };
}

function sentPayload(spy: ReturnType<typeof vi.fn>): EntryPayload {
  return spy.mock.calls[0][0] as EntryPayload;
}

describe("placeSpotOrder", () => {
  it("sends place_spot_order_to_subaccount with the market addr derived from the name", async () => {
    const { dex, sendTx } = makeWriteDex();
    await dex.placeSpotOrder({
      marketName: MARKET_NAME,
      price: 500,
      size: 1000,
      isBuy: true,
      timeInForce: TimeInForce.GoodTillCanceled,
      builderAddr: BUILDER,
      builderFee: 10,
      subaccountAddr: SUB,
    });

    const payload = sentPayload(sendTx);
    expect(payload.function).toBe(
      `${PKG}::dex_accounts_spot_entry::place_spot_order_to_subaccount`,
    );
    expect(payload.functionArguments).toEqual([
      SUB,
      MARKET_ADDR,
      500,
      1000,
      true,
      TimeInForce.GoodTillCanceled,
      BUILDER,
      1000, // 10 bps -> chain units (x100)
    ]);
  });

  // Spot prices are limit/IOC BOUNDS, so tick rounding must be side-safe:
  // nearest-tick could push a buy above the user's cap or a sell below their
  // floor (the web market-order path derives non-aligned caps from slippage).
  it("rounds a buy price DOWN to the tick so the cap is never exceeded", async () => {
    const { dex, sendTx } = makeWriteDex();
    await dex.placeSpotOrder({
      marketName: MARKET_NAME,
      price: 10_060, // 100.6 ticks of 100 — nearest would round UP to 10_100
      size: 1000,
      isBuy: true,
      timeInForce: TimeInForce.ImmediateOrCancel,
      tickSize: 100,
      subaccountAddr: SUB,
    });
    expect(sentPayload(sendTx).functionArguments[2]).toBe(10_000);
  });

  it("rounds a sell price UP to the tick so the floor is never undercut", async () => {
    const { dex, sendTx } = makeWriteDex();
    await dex.placeSpotOrder({
      marketName: MARKET_NAME,
      price: 10_040, // 100.4 ticks of 100 — nearest would round DOWN to 10_000
      size: 1000,
      isBuy: false,
      timeInForce: TimeInForce.ImmediateOrCancel,
      tickSize: 100,
      subaccountAddr: SUB,
    });
    expect(sentPayload(sendTx).functionArguments[2]).toBe(10_100);
  });

  it("leaves tick-aligned prices unchanged on both sides", async () => {
    for (const isBuy of [true, false]) {
      const { dex, sendTx } = makeWriteDex();
      await dex.placeSpotOrder({
        marketName: MARKET_NAME,
        price: 10_100,
        size: 1000,
        isBuy,
        timeInForce: TimeInForce.GoodTillCanceled,
        tickSize: 100,
        subaccountAddr: SUB,
      });
      expect(sentPayload(sendTx).functionArguments[2]).toBe(10_100);
    }
  });

  it("passes undefined builder fields when no builder code is supplied", async () => {
    const { dex, sendTx } = makeWriteDex();
    await dex.placeSpotOrder({
      marketAddr: MARKET_ADDR,
      price: 500,
      size: 1000,
      isBuy: false,
      timeInForce: TimeInForce.PostOnly,
      subaccountAddr: SUB,
    });

    const payload = sentPayload(sendTx);
    expect(payload.functionArguments).toEqual([
      SUB,
      MARKET_ADDR,
      500,
      1000,
      false,
      TimeInForce.PostOnly,
      undefined,
      undefined,
    ]);
  });

  it("extracts the order id from a spot OrderEvent for the subaccount", async () => {
    const { dex } = makeWriteDex({
      txResponse: {
        hash: "0xhash",
        events: [
          {
            type: `${PKG}::market_types::OrderEvent`,
            data: { order_id: "42", user: SUB },
          },
        ],
      },
    });
    const result = await dex.placeSpotOrder({
      marketAddr: MARKET_ADDR,
      price: 500,
      size: 1000,
      isBuy: true,
      timeInForce: TimeInForce.GoodTillCanceled,
      subaccountAddr: SUB,
    });

    expect(result).toEqual({
      success: true,
      orderId: "42",
      pendingCbs: false,
      transactionHash: "0xhash",
    });
  });

  it("matches the subaccount across address formats (short vs zero-padded long form)", async () => {
    // Event payloads may render addresses with leading zeros stripped while
    // the caller passes the canonical long form (or vice versa).
    const longForm = `0x${"0".repeat(62)}ab`;
    const shortForm = "0xab";
    const { dex } = makeWriteDex({
      txResponse: {
        hash: "0xhash",
        events: [
          {
            type: `${PKG}::market_types::OrderEvent`,
            data: { order_id: "42", user: shortForm },
          },
        ],
      },
    });
    const result = await dex.placeSpotOrder({
      marketAddr: MARKET_ADDR,
      price: 500,
      size: 1000,
      isBuy: true,
      timeInForce: TimeInForce.GoodTillCanceled,
      subaccountAddr: longForm,
    });

    expect(result).toEqual({
      success: true,
      orderId: "42",
      pendingCbs: false,
      transactionHash: "0xhash",
    });
  });

  it("flags pendingCbs when the order was queued for a CBS withdrawal", async () => {
    const { dex } = makeWriteDex({
      txResponse: {
        hash: "0xhash",
        events: [
          {
            type: `${PKG}::spot_pending_cbs_queue::SpotOrderPendingCbsEvent`,
            data: { order_id: "77", subaccount_addr: SUB },
          },
        ],
      },
    });
    const result = await dex.placeSpotOrder({
      marketAddr: MARKET_ADDR,
      price: 500,
      size: 1000,
      isBuy: true,
      timeInForce: TimeInForce.GoodTillCanceled,
      subaccountAddr: SUB,
    });

    expect(result).toEqual({
      success: true,
      orderId: "77",
      pendingCbs: true,
      transactionHash: "0xhash",
    });
  });

  it("ignores events belonging to other subaccounts", async () => {
    const { dex } = makeWriteDex({
      txResponse: {
        hash: "0xhash",
        events: [
          {
            type: `${PKG}::market_types::OrderEvent`,
            data: { order_id: "42", user: `0x${"ee".repeat(32)}` },
          },
        ],
      },
    });
    const result = await dex.placeSpotOrder({
      marketAddr: MARKET_ADDR,
      price: 500,
      size: 1000,
      isBuy: true,
      timeInForce: TimeInForce.GoodTillCanceled,
      subaccountAddr: SUB,
    });

    expect(result).toEqual({
      success: true,
      orderId: undefined,
      pendingCbs: false,
      transactionHash: "0xhash",
    });
  });

  it("returns success:false when the transaction throws", async () => {
    const { dex, sendTx } = makeWriteDex();
    sendTx.mockRejectedValue(new Error("boom"));
    const result = await dex.placeSpotOrder({
      marketAddr: MARKET_ADDR,
      price: 500,
      size: 1000,
      isBuy: true,
      timeInForce: TimeInForce.GoodTillCanceled,
      subaccountAddr: SUB,
    });

    expect(result).toEqual({ success: false, error: "boom" });
  });

  it("routes through sendEncryptedTx when defaultEncrypted is true", async () => {
    const { dex, sendTx, sendEncryptedTx } = makeWriteDex({ defaultEncrypted: true });
    await dex.placeSpotOrder({
      marketAddr: MARKET_ADDR,
      price: 500,
      size: 1000,
      isBuy: true,
      timeInForce: TimeInForce.GoodTillCanceled,
      subaccountAddr: SUB,
    });

    expect(sendEncryptedTx).toHaveBeenCalledTimes(1);
    expect(sendTx).not.toHaveBeenCalled();
  });
});

describe("cancelSpotOrder", () => {
  it("sends cancel_spot_order_to_subaccount with the order id as a bigint", async () => {
    const { dex, sendTx } = makeWriteDex();
    await dex.cancelSpotOrder({
      orderId: "123456789012345678901234567890",
      marketAddr: MARKET_ADDR,
      subaccountAddr: SUB,
    });

    const payload = sentPayload(sendTx);
    expect(payload.function).toBe(
      `${PKG}::dex_accounts_spot_entry::cancel_spot_order_to_subaccount`,
    );
    expect(payload.functionArguments).toEqual([
      SUB,
      MARKET_ADDR,
      BigInt("123456789012345678901234567890"),
    ]);
  });

  it("derives the market addr from a market name", async () => {
    const { dex, sendTx } = makeWriteDex();
    await dex.cancelSpotOrder({ orderId: 7, marketName: MARKET_NAME, subaccountAddr: SUB });

    expect(sentPayload(sendTx).functionArguments).toEqual([SUB, MARKET_ADDR, 7n]);
  });

  it("routes through sendEncryptedTx when defaultEncrypted is true", async () => {
    const { dex, sendTx, sendEncryptedTx } = makeWriteDex({ defaultEncrypted: true });
    await dex.cancelSpotOrder({ orderId: 7, marketAddr: MARKET_ADDR, subaccountAddr: SUB });

    expect(sendEncryptedTx).toHaveBeenCalledTimes(1);
    expect(sendTx).not.toHaveBeenCalled();
  });
});

describe("placeSpotBulkOrder", () => {
  it("sends place_spot_bulk_order_to_subaccount with per-level arrays", async () => {
    const { dex, sendTx } = makeWriteDex();
    await dex.placeSpotBulkOrder({
      marketName: MARKET_NAME,
      sequenceNumber: 3,
      bidPrices: [99, 98],
      bidSizes: [10, 20],
      askPrices: [101, 102],
      askSizes: [30, 40],
      builderAddr: BUILDER,
      builderFee: 5,
      subaccountAddr: SUB,
    });

    const payload = sentPayload(sendTx);
    expect(payload.function).toBe(
      `${PKG}::dex_accounts_spot_entry::place_spot_bulk_order_to_subaccount`,
    );
    expect(payload.functionArguments).toEqual([
      SUB,
      MARKET_ADDR,
      3,
      [99, 98],
      [10, 20],
      [101, 102],
      [30, 40],
      BUILDER,
      500, // 5 bps -> chain units
    ]);
  });
});

describe("cancelSpotBulkOrder", () => {
  it("sends cancel_spot_bulk_order_to_subaccount", async () => {
    const { dex, sendTx } = makeWriteDex();
    await dex.cancelSpotBulkOrder({ marketAddr: MARKET_ADDR, subaccountAddr: SUB });

    const payload = sentPayload(sendTx);
    expect(payload.function).toBe(
      `${PKG}::dex_accounts_spot_entry::cancel_spot_bulk_order_to_subaccount`,
    );
    expect(payload.functionArguments).toEqual([SUB, MARKET_ADDR]);
  });
});

describe("cancelSpotBulkOrderAtPriceLevel", () => {
  it("sends the price level and side", async () => {
    const { dex, sendTx } = makeWriteDex();
    await dex.cancelSpotBulkOrderAtPriceLevel({
      marketAddr: MARKET_ADDR,
      price: 99,
      isBuy: true,
      subaccountAddr: SUB,
    });

    const payload = sentPayload(sendTx);
    expect(payload.function).toBe(
      `${PKG}::dex_accounts_spot_entry::cancel_spot_bulk_order_at_price_level_to_subaccount`,
    );
    expect(payload.functionArguments).toEqual([SUB, MARKET_ADDR, 99, true]);
  });
});

describe("spot builder fee approvals", () => {
  it("approveMaxSpotBuilderFee converts bps to chain units", async () => {
    const { dex, sendTx } = makeWriteDex();
    await dex.approveMaxSpotBuilderFee({ builderAddr: BUILDER, maxFee: 10, subaccountAddr: SUB });

    const payload = sentPayload(sendTx);
    expect(payload.function).toBe(
      `${PKG}::dex_accounts_spot_entry::approve_max_spot_builder_fee_for_subaccount`,
    );
    expect(payload.functionArguments).toEqual([SUB, BUILDER, 1000]);
  });

  it("revokeMaxSpotBuilderFee targets the builder", async () => {
    const { dex, sendTx } = makeWriteDex();
    await dex.revokeMaxSpotBuilderFee({ builderAddr: BUILDER, subaccountAddr: SUB });

    const payload = sentPayload(sendTx);
    expect(payload.function).toBe(
      `${PKG}::dex_accounts_spot_entry::revoke_max_spot_builder_fee_for_subaccount`,
    );
    expect(payload.functionArguments).toEqual([SUB, BUILDER]);
  });
});

describe("setHoldAsNonCollateral", () => {
  it("sends the asset metadata address and flag", async () => {
    const assetAddr = `0x${"11".repeat(32)}`;
    const { dex, sendTx } = makeWriteDex();
    await dex.setHoldAsNonCollateral({ assetAddr, hold: true, subaccountAddr: SUB });

    const payload = sentPayload(sendTx);
    expect(payload.function).toBe(
      `${PKG}::dex_accounts_spot_entry::set_hold_as_non_collateral_for_subaccount`,
    );
    expect(payload.functionArguments).toEqual([SUB, assetAddr, true]);
  });
});

describe("processSpotPendingRequests", () => {
  it("cranks the market queue without a subaccount", async () => {
    const { dex, sendTx } = makeWriteDex();
    await dex.processSpotPendingRequests({ marketName: MARKET_NAME, maxFills: 50 });

    const payload = sentPayload(sendTx);
    expect(payload.function).toBe(`${PKG}::dex_accounts_spot_entry::process_spot_pending_requests`);
    expect(payload.functionArguments).toEqual([MARKET_ADDR, 50]);
  });
});
