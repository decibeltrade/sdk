import { Account } from "@aptos-labs/ts-sdk";
import { describe, expect, it } from "vitest";

import { BaseSDK } from "./base";
import { DecibelConfig, NETNA_CONFIG } from "./constants";

// Reach the private encryption gate + probe without a public seam. The probe is
// stubbed to `true` in every case so the only thing under test is the
// gas-station fee-payer guard.
interface EncryptionInternals {
  canEncrypt(): Promise<boolean>;
  nodeSupportsEncryption(): Promise<boolean>;
}

function makeSdk(config: DecibelConfig): EncryptionInternals {
  const sdk = new BaseSDK(config, Account.generate()) as unknown as EncryptionInternals;
  sdk.nodeSupportsEncryption = () => Promise.resolve(true);
  return sdk;
}

describe("BaseSDK.canEncrypt", () => {
  it("encrypts when no gas station is configured (sender-paid)", async () => {
    const sdk = makeSdk({ ...NETNA_CONFIG, gasStationApiKey: undefined });
    expect(await sdk.canEncrypt()).toBe(true);
  });

  it("encrypts when a gas station has a fee-payer address (sponsored)", async () => {
    const sdk = makeSdk({
      ...NETNA_CONFIG,
      gasStationApiKey: "test-key",
      gasStationAddress: "0x1",
    });
    expect(await sdk.canEncrypt()).toBe(true);
  });

  it("falls back to plaintext when a gas station is active but has no address", async () => {
    // An encrypted txn must bake the literal fee-payer address into its AEAD
    // associated data, so a sponsored-but-address-less config can't build one.
    const sdk = makeSdk({
      ...NETNA_CONFIG,
      gasStationApiKey: "test-key",
      gasStationAddress: undefined,
    });
    expect(await sdk.canEncrypt()).toBe(false);
  });
});
