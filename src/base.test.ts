import type {
  AccountAuthenticator,
  InputGenerateTransactionPayloadData,
  SimpleTransaction,
} from "@aptos-labs/ts-sdk";
import { Account } from "@aptos-labs/ts-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BaseSDK, configSupportsEncryptedSubmission, TransactionSettledMetrics } from "./base";
import { DecibelConfig, TESTNET_CONFIG } from "./constants";

// Reach the private encryption gate + probe without a public seam. The probe is
// stubbed to "supported" in every case so the only thing under test is the
// gas-station fee-payer guard.
interface EncryptionInternals {
  encryptionBlocker(): Promise<string | undefined>;
  nodeSupportsEncryption(): Promise<"supported" | "unsupported" | "failed">;
}

function makeSdk(config: DecibelConfig): EncryptionInternals {
  const sdk = new BaseSDK(config, Account.generate()) as unknown as EncryptionInternals;
  sdk.nodeSupportsEncryption = () => Promise.resolve("supported");
  return sdk;
}

describe("BaseSDK.encryptionBlocker", () => {
  it("encrypts when no gas station is configured (sender-paid)", async () => {
    const sdk = makeSdk({ ...TESTNET_CONFIG, gasStationApiKey: undefined });
    expect(await sdk.encryptionBlocker()).toBeUndefined();
  });

  it("encrypts when a gas station has a fee-payer address (sponsored)", async () => {
    const sdk = makeSdk({
      ...TESTNET_CONFIG,
      gasStationApiKey: "test-key",
      gasStationAddress: "0x1",
    });
    expect(await sdk.encryptionBlocker()).toBeUndefined();
  });

  it("falls back to plaintext when a gas station is active but has no address", async () => {
    // An encrypted txn must bake the literal fee-payer address into its AEAD
    // associated data, so a sponsored-but-address-less config can't build one.
    const sdk = makeSdk({
      ...TESTNET_CONFIG,
      gasStationApiKey: "test-key",
      gasStationAddress: undefined,
    });
    expect(await sdk.encryptionBlocker()).toBe("gas_station_unconfigured");
  });
});

describe("configSupportsEncryptedSubmission", () => {
  it("is true when no gas station is configured (sender-paid)", () => {
    expect(configSupportsEncryptedSubmission({ gasStationApiKey: undefined })).toBe(true);
  });

  it("is true when a gas station has a fee-payer address", () => {
    expect(
      configSupportsEncryptedSubmission({
        gasStationApiKey: "test-key",
        gasStationAddress: "0x1",
      }),
    ).toBe(true);
  });

  it("is false when a gas station is active but has no fee-payer address", () => {
    expect(
      configSupportsEncryptedSubmission({
        gasStationApiKey: "test-key",
        gasStationAddress: undefined,
      }),
    ).toBe(false);
  });
});

class SubmissionSdk extends BaseSDK {
  send(encrypted = false) {
    const payload: InputGenerateTransactionPayloadData = {
      function: "0x1::test::submit",
      functionArguments: [],
    };
    return encrypted ? this.sendEncryptedTx(payload) : this.sendTx(payload);
  }
}

function submissionSdk(
  config: DecibelConfig = TESTNET_CONFIG,
  onTransactionSettled?: (m: TransactionSettledMetrics) => void,
) {
  const sdk = new SubmissionSdk(config, Account.generate(), {
    skipSimulate: true,
    onTransactionSettled,
  });
  const build = vi.spyOn(sdk, "buildTx").mockResolvedValue({} as SimpleTransaction);
  const sign = vi.spyOn(sdk.aptos.transaction, "sign").mockReturnValue({} as AccountAuthenticator);
  const submit = vi.spyOn(sdk, "submitTx").mockResolvedValue({ hash: "0xaccepted" } as never);
  const wait = vi
    .spyOn(sdk.aptos, "waitForTransaction")
    .mockResolvedValue({ type: "user_transaction", hash: "0xaccepted", success: true } as never);
  return { sdk, build, sign, submit, wait };
}

describe("submission failure provenance", () => {
  it("marks a build failure not-submitted without signing", async () => {
    const { sdk, build, sign, submit } = submissionSdk();
    build.mockRejectedValue(new Error("build failed"));
    await expect(sdk.send()).rejects.toMatchObject({ submission: { outcome: "not-submitted" } });
    expect(sign).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it("marks a signing failure not-submitted", async () => {
    const { sdk, sign, submit } = submissionSdk();
    sign.mockImplementation(() => {
      throw new Error("sign failed");
    });
    await expect(sdk.send()).rejects.toMatchObject({ submission: { outcome: "not-submitted" } });
    expect(submit).not.toHaveBeenCalled();
  });

  it("preserves uncertainty when submission acknowledgment is lost", async () => {
    const { sdk, submit, wait } = submissionSdk();
    submit.mockRejectedValue(new Error("gateway timeout"));
    await expect(sdk.send()).rejects.toMatchObject({ submission: { outcome: "unknown" } });
    expect(wait).not.toHaveBeenCalled();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("retains the acknowledged hash after a confirmation error", async () => {
    const { sdk, wait } = submissionSdk();
    wait.mockRejectedValue(new Error("confirmation disconnected"));
    await expect(sdk.send()).rejects.toMatchObject({
      submission: { outcome: "unknown", transactionHash: "0xaccepted" },
    });
  });

  it("retains a confirmed revert and its hash", async () => {
    const { sdk, wait } = submissionSdk();
    wait.mockResolvedValue({
      type: "user_transaction",
      success: false,
      hash: "0xaccepted",
      vm_status: "Move abort",
    } as never);
    await expect(sdk.send()).rejects.toMatchObject({
      submission: { outcome: "reverted", transactionHash: "0xaccepted" },
    });
  });

  it("keeps private error payloads unknown without replacing the acknowledged hash", async () => {
    const { sdk, wait } = submissionSdk();
    wait.mockRejectedValue(
      Object.assign(new Error("Move abort"), {
        transaction: { type: "user_transaction", success: false, hash: "0xother" },
      }),
    );
    await expect(sdk.send()).rejects.toMatchObject({
      submission: { outcome: "unknown", transactionHash: "0xaccepted" },
    });
  });

  it.each([
    null,
    { type: "pending_transaction", success: false, hash: "0xaccepted" },
    { type: "user_transaction", hash: "0xaccepted" },
    { type: "user_transaction", success: false },
  ])("keeps malformed confirmation %j unknown", async (response) => {
    const { sdk, wait } = submissionSdk();
    wait.mockResolvedValue(response as never);
    await expect(sdk.send()).rejects.toMatchObject({
      submission: { outcome: "unknown", transactionHash: "0xaccepted" },
    });
  });

  it("retains the hash on encrypted confirmation errors", async () => {
    const { sdk, wait } = submissionSdk();
    const internals = sdk as unknown as {
      buildEncryptedTx(): Promise<SimpleTransaction>;
    };
    vi.spyOn(sdk.aptos, "getLedgerInfo").mockResolvedValue({ encryption_key: "0xkey" } as never);
    vi.spyOn(internals, "buildEncryptedTx").mockResolvedValue({} as SimpleTransaction);
    wait.mockRejectedValue(new Error("confirmation disconnected"));
    await expect(sdk.send(true)).rejects.toMatchObject({
      submission: { outcome: "unknown", transactionHash: "0xaccepted" },
    });
  });
});

describe("transaction settled telemetry", () => {
  afterEach(() => vi.restoreAllMocks());

  function telemetrySdk(config: DecibelConfig = TESTNET_CONFIG) {
    const settled = vi.fn<(m: TransactionSettledMetrics) => void>();
    const parts = submissionSdk(config, settled);
    const internals = parts.sdk as unknown as {
      buildEncryptedTx(): Promise<SimpleTransaction>;
    };
    const buildEncrypted = vi
      .spyOn(internals, "buildEncryptedTx")
      .mockResolvedValue({} as SimpleTransaction);
    const ledger = vi.spyOn(parts.sdk.aptos, "getLedgerInfo");
    return { ...parts, settled, buildEncrypted, ledger };
  }

  function only(settled: { mock: { calls: unknown[][] } }): TransactionSettledMetrics {
    expect(settled).toHaveBeenCalledTimes(1);
    return settled.mock.calls[0]?.[0] as TransactionSettledMetrics;
  }

  it("emits once for a plaintext build failure and still rejects", async () => {
    const { sdk, build, settled } = telemetrySdk();
    build.mockRejectedValue(new Error("build failed"));
    await expect(sdk.send()).rejects.toMatchObject({ submission: { outcome: "not-submitted" } });
    const m = only(settled);
    expect(m).toMatchObject({
      success: false,
      outcome: "not-submitted",
      encrypted: false,
      encryptionRequested: false,
      error: "build failed",
      functionId: "0x1::test::submit",
      txKind: "other",
    });
    expect(m.fallbackReason).toBeUndefined();
  });

  it("measures durationMs from call entry, including probe and build", async () => {
    const { sdk, ledger, buildEncrypted, wait, settled } = telemetrySdk();
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    ledger.mockImplementation(() => {
      now += 5;
      return Promise.resolve({ encryption_key: "0xkey" } as never);
    });
    buildEncrypted.mockImplementation(() => {
      now += 15;
      return Promise.resolve({} as SimpleTransaction);
    });
    wait.mockImplementation(() => {
      now += 40;
      return Promise.resolve({
        type: "user_transaction",
        hash: "0xaccepted",
        success: true,
      } as never);
    });
    await sdk.send(true);
    const m = only(settled);
    expect(m).toMatchObject({ success: true, encrypted: true, durationMs: 60, hash: "0xaccepted" });
    expect(m.outcome).toBeUndefined();
  });

  it("falls back with probe_failed when the probe errors", async () => {
    const { sdk, ledger, settled, buildEncrypted } = telemetrySdk();
    ledger.mockRejectedValue(new Error("network"));
    vi.spyOn(console, "warn").mockReturnValue(undefined);
    await sdk.send(true);
    expect(buildEncrypted).not.toHaveBeenCalled();
    expect(only(settled)).toMatchObject({
      success: true,
      encrypted: false,
      encryptionRequested: true,
      fallbackReason: "probe_failed",
    });
  });

  it("falls back with node_unsupported when the node has no encryption key", async () => {
    const { sdk, ledger, settled } = telemetrySdk();
    ledger.mockResolvedValue({} as never);
    await sdk.send(true);
    expect(only(settled)).toMatchObject({
      encrypted: false,
      encryptionRequested: true,
      fallbackReason: "node_unsupported",
    });
  });

  it("falls back with gas_station_unconfigured when the gas station has no address", async () => {
    const { sdk, ledger, settled } = telemetrySdk({
      ...TESTNET_CONFIG,
      gasStationApiKey: "k",
      gasStationAddress: undefined,
    });
    await sdk.send(true);
    expect(ledger).not.toHaveBeenCalled();
    expect(only(settled)).toMatchObject({
      encrypted: false,
      encryptionRequested: true,
      fallbackReason: "gas_station_unconfigured",
    });
  });

  it("emits encrypted success with no fallback reason", async () => {
    const { sdk, ledger, settled } = telemetrySdk();
    ledger.mockResolvedValue({ encryption_key: "0xkey" } as never);
    await sdk.send(true);
    const m = only(settled);
    expect(m).toMatchObject({ success: true, encrypted: true, encryptionRequested: true });
    expect(m.fallbackReason).toBeUndefined();
  });

  it("reports an encrypted build failure as encrypted not-submitted", async () => {
    const { sdk, ledger, settled, buildEncrypted } = telemetrySdk();
    ledger.mockResolvedValue({ encryption_key: "0xkey" } as never);
    buildEncrypted.mockRejectedValue(new Error("encrypt failed"));
    await expect(sdk.send(true)).rejects.toMatchObject({
      submission: { outcome: "not-submitted" },
    });
    expect(only(settled)).toMatchObject({
      success: false,
      encrypted: true,
      encryptionRequested: true,
      outcome: "not-submitted",
    });
  });

  it("reports reverted and unknown outcomes with the acknowledged hash", async () => {
    const reverted = telemetrySdk();
    reverted.wait.mockResolvedValue({
      type: "user_transaction",
      success: false,
      hash: "0xaccepted",
      vm_status: "Move abort",
    } as never);
    await expect(reverted.sdk.send()).rejects.toThrow();
    expect(only(reverted.settled)).toMatchObject({
      outcome: "reverted",
      hash: "0xaccepted",
      success: false,
    });

    const lost = telemetrySdk();
    lost.wait.mockRejectedValue(new Error("confirmation disconnected"));
    await expect(lost.sdk.send()).rejects.toThrow();
    expect(only(lost.settled)).toMatchObject({ outcome: "unknown", hash: "0xaccepted" });
  });

  it("does not let a throwing callback break submission", async () => {
    const { sdk, settled } = telemetrySdk();
    settled.mockImplementation(() => {
      throw new Error("analytics down");
    });
    await expect(sdk.send()).resolves.toMatchObject({ hash: "0xaccepted" });
  });
});

describe("installed Aptos confirmation response contract", () => {
  afterEach(() => vi.restoreAllMocks());

  function confirmationSdk(response: unknown) {
    const { sdk, wait, submit } = submissionSdk();
    wait.mockRestore();
    vi.spyOn(sdk.aptos.config.client, "provider").mockResolvedValue({
      status: 200,
      statusText: "OK",
      data: response,
      headers: {},
    } as never);
    return { sdk, submit };
  }

  it("returns a successful committed transaction", async () => {
    const response = { type: "user_transaction", success: true, hash: "0xaccepted" };
    const { sdk, submit } = confirmationSdk(response);
    await expect(sdk.send()).resolves.toEqual(response);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("classifies a failed committed transaction without a private error", async () => {
    const { sdk, submit } = confirmationSdk({
      type: "user_transaction",
      success: false,
      hash: "0xaccepted",
      vm_status: "Move abort",
    });
    await expect(sdk.send()).rejects.toMatchObject({
      submission: { outcome: "reverted", transactionHash: "0xaccepted" },
    });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it.each([
    { type: "user_transaction", success: "false", hash: "0xaccepted" },
    { type: "user_transaction", success: false, hash: "0xother" },
    { type: "future_transaction", success: true, hash: "0xaccepted" },
  ])("keeps response drift %j unknown", async (response) => {
    const { sdk, submit } = confirmationSdk(response);
    await expect(sdk.send()).rejects.toMatchObject({
      submission: { outcome: "unknown", transactionHash: "0xaccepted" },
    });
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
