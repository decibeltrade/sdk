import type {
  AccountAuthenticator,
  InputGenerateTransactionPayloadData,
  SimpleTransaction,
} from "@aptos-labs/ts-sdk";
import { Account, AccountAddress, buildTransaction } from "@aptos-labs/ts-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BaseSDK, configSupportsEncryptedSubmission, TransactionSettledMetrics } from "./base";
import { DecibelConfig, TESTNET_CONFIG } from "./constants";
import {
  getFailedDecryptionEpoch,
  isFailedDecryptionError,
  TransactionSubmissionError,
} from "./submission-error";

// Network-free encrypted builds: only `buildTransaction` and `generateTransactionPayload` are mocked.
vi.mock("@aptos-labs/ts-sdk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@aptos-labs/ts-sdk")>()),
  buildTransaction: vi.fn(),
  generateTransactionPayload: vi.fn(),
}));

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

describe("failed_decryption surfaces to the caller", () => {
  interface EncryptedInternals {
    encryptionBlocker(): Promise<undefined>;
    buildEncryptedTx(
      p?: InputGenerateTransactionPayloadData,
      s?: AccountAddress,
    ): Promise<SimpleTransaction>;
    signAndSubmit(): Promise<unknown>;
  }

  const TTL_PLUS_MARGIN_MS = 10_250;
  const failedCommit = {
    type: "user_transaction",
    hash: "0xaccepted",
    success: false,
    vm_status: "Failed to deserialize argument",
    payload: { encrypted_state: "failed_decryption", encryption_epoch: "100" },
  };
  const failedDecryption = () =>
    new TransactionSubmissionError(
      "failed",
      { outcome: "reverted", transactionHash: "0xaccepted" },
      undefined,
      failedCommit as never,
    );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(buildTransaction).mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function encryptedSdk() {
    const sdk = new SubmissionSdk(TESTNET_CONFIG, Account.generate(), { skipSimulate: true });
    const internals = sdk as unknown as EncryptedInternals;
    vi.spyOn(internals, "encryptionBlocker").mockResolvedValue(undefined);
    const build = vi.spyOn(internals, "buildEncryptedTx");
    const submit = vi.spyOn(internals, "signAndSubmit");
    return { sdk, build, submit };
  }

  it("B1: does not rebuild or resubmit after failed_decryption", async () => {
    const { sdk, build, submit } = encryptedSdk();
    const error = failedDecryption();
    build.mockResolvedValue({} as SimpleTransaction);
    submit.mockRejectedValue(error);
    const result = expect(sdk.send(true)).rejects.toBe(error);
    await vi.advanceTimersByTimeAsync(TTL_PLUS_MARGIN_MS * 2);
    await result;
    expect(build).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("B2: a reverted failed_decryption confirmation carries the committed transaction", async () => {
    const { sdk, build } = encryptedSdk();
    build.mockResolvedValue({} as SimpleTransaction);
    vi.spyOn(sdk.aptos.transaction, "sign").mockReturnValue({} as AccountAuthenticator);
    vi.spyOn(sdk, "submitTx").mockResolvedValue({ hash: "0xaccepted" } as never);
    vi.spyOn(sdk.aptos, "waitForTransaction").mockResolvedValue(failedCommit as never);
    const error = await sdk.send(true).catch((e: unknown) => e);
    expect(error).toMatchObject({
      submission: { outcome: "reverted", transactionHash: "0xaccepted" },
      transaction: failedCommit,
    });
    expect(isFailedDecryptionError(error)).toBe(true);
  });

  it.each([
    ["the error itself", failedDecryption(), 100n],
    ["a cause chain", new Error("outer", { cause: failedDecryption() }), 100n],
    [
      "a flagged order result",
      new Error("outer", {
        cause: { success: false, error: "x", failedDecryption: true, encryptionEpoch: "7" },
      }),
      7n,
    ],
    [
      "a flagged result without an epoch",
      new Error("outer", { cause: { success: false, error: "x", failedDecryption: true } }),
      undefined,
    ],
  ])("B3: detects failed_decryption through %s and reads its epoch", (_name, error, epoch) => {
    expect(isFailedDecryptionError(error)).toBe(true);
    expect(getFailedDecryptionEpoch(error)).toBe(epoch);
  });

  it.each([
    ["a plain error", new Error("Failed to fetch")],
    ["undefined", undefined],
    [
      "a decrypted move abort",
      new TransactionSubmissionError("abort", { outcome: "reverted" }, undefined, {
        ...failedCommit,
        payload: { encrypted_state: "decrypted" },
      } as never),
    ],
    ["a plain failed result", new Error("outer", { cause: { success: false, error: "x" } })],
    [
      "a null committed payload",
      new TransactionSubmissionError("x", { outcome: "reverted" }, undefined, {
        ...failedCommit,
        payload: null,
      } as never),
    ],
  ])("B4: is not failed_decryption for %s", (_name, error) => {
    expect(isFailedDecryptionError(error)).toBe(false);
    expect(getFailedDecryptionEpoch(error)).toBeUndefined();
  });

  describe("refreshEncryptionKey", () => {
    const NOW = new Date("2026-01-01T00:00:00.000Z");
    const sender = AccountAddress.from("0xabc".padEnd(66, "0"));
    const payload: InputGenerateTransactionPayloadData = {
      function: "0x1::test::submit",
      functionArguments: [],
    };
    const txAtEpoch = (epoch: bigint) =>
      ({ rawTransaction: { payload: { encryptionEpoch: epoch } } }) as never;

    beforeEach(() => vi.setSystemTime(NOW));

    async function builtAtEpoch(
      epoch: bigint,
      sdk = new BaseSDK(TESTNET_CONFIG, Account.generate()),
    ) {
      vi.mocked(buildTransaction).mockResolvedValue(txAtEpoch(epoch));
      await (sdk as unknown as EncryptedInternals).buildEncryptedTx(payload, sender);
      const ledger = vi.spyOn(sdk.aptos, "getLedgerInfo");
      return { sdk, ledger };
    }

    it("R1: waits out the ledger-info memo window measured from the last encrypted build", async () => {
      const { sdk, ledger } = await builtAtEpoch(100n);
      ledger.mockResolvedValue({ epoch: "101" } as never);
      await vi.advanceTimersByTimeAsync(4_000);
      const result = sdk.refreshEncryptionKey();
      await vi.advanceTimersByTimeAsync(TTL_PLUS_MARGIN_MS - 4_000 - 1);
      expect(ledger).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await expect(result).resolves.toBe(true);
      expect(ledger).toHaveBeenCalledTimes(1);
    });

    it("R2: does not wait once the memo window has elapsed", async () => {
      const { sdk, ledger } = await builtAtEpoch(100n);
      ledger.mockResolvedValue({ epoch: "101" } as never);
      await vi.advanceTimersByTimeAsync(TTL_PLUS_MARGIN_MS);
      await expect(sdk.refreshEncryptionKey()).resolves.toBe(true);
    });

    it.each([
      { name: "R3: the epoch did not advance", built: 100n, failedEpoch: undefined },
      { name: "R6: the failed epoch is current", built: 101n, failedEpoch: 101n },
    ])("reports false when $name", async ({ built, failedEpoch }) => {
      const { sdk, ledger } = await builtAtEpoch(built);
      ledger.mockResolvedValue({ epoch: built.toString() } as never);
      const result = sdk.refreshEncryptionKey(failedEpoch);
      await vi.advanceTimersByTimeAsync(TTL_PLUS_MARGIN_MS);
      await expect(result).resolves.toBe(false);
    });

    it("R4: reports true without waiting when nothing was built encrypted", async () => {
      const sdk = new BaseSDK(TESTNET_CONFIG, Account.generate());
      const ledger = vi
        .spyOn(sdk.aptos, "getLedgerInfo")
        .mockResolvedValue({ epoch: "5" } as never);
      await expect(sdk.refreshEncryptionKey()).resolves.toBe(true);
      expect(ledger).toHaveBeenCalledTimes(1);
    });

    it("R5: compares against the failed txn's epoch, not a later build at the new key", async () => {
      const { sdk, ledger } = await builtAtEpoch(100n);
      // A second order built at the rotated key lands between the failure and the retry.
      await builtAtEpoch(101n, sdk);
      ledger.mockResolvedValue({ epoch: "101" } as never);
      const result = sdk.refreshEncryptionKey(100n);
      await vi.advanceTimersByTimeAsync(TTL_PLUS_MARGIN_MS);
      await expect(result).resolves.toBe(true);
    });
  });
});
