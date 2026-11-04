import { describe, expect, it } from "vitest";

import { MAINNET_CONFIG, TESTNET_CONFIG } from "./constants";

describe("fftCampaignAddr default", () => {
  it("testnet points at the live FFT campaign object", () => {
    expect(TESTNET_CONFIG.deployment.fftCampaignAddr).toBe(
      "0x450304373a8ec8dea2b7bd09798e944ff0b115e6f014cb7adb47dd368571c0ae",
    );
  });

  it("mainnet leaves it unset", () => {
    expect(MAINNET_CONFIG.deployment.fftCampaignAddr).toBeUndefined();
  });
});
