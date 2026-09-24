import { Account } from "@aptos-labs/ts-sdk";
import { describe, expect, it, vi } from "vitest";

import { TESTNET_CONFIG } from "./constants";
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
