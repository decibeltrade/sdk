import { Account } from "@aptos-labs/ts-sdk";
import { describe, expect, it, vi } from "vitest";

import { NETNA_CONFIG } from "./constants";
import { DecibelWriteDex } from "./write";

// sendTx / sendEncryptedTx are protected on BaseSDK. Stub them on the instance so
// the only thing under test is submitSubaccountTx's encrypted-vs-plaintext
// routing (`encrypted ?? defaultEncrypted`) — no real build/simulate/submit.
interface SendSpies {
  sendTx: ReturnType<typeof vi.fn>;
  sendEncryptedTx: ReturnType<typeof vi.fn>;
}

function makeWriteDex(defaultEncrypted: boolean): { dex: DecibelWriteDex } & SendSpies {
  const dex = new DecibelWriteDex(NETNA_CONFIG, Account.generate(), { defaultEncrypted });
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
