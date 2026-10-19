import { Aptos, Network } from "@aptos-labs/ts-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DecibelConfig, DecibelReaderDeps } from "../../constants";
import { DEFAULT_COMPAT_VERSION } from "../../release-config";
import { DecibelWsSubscription } from "../ws-subscription";
import { CampaignsReader } from "./campaigns.reader";

function createMockDeps(): DecibelReaderDeps {
  const config: DecibelConfig = {
    network: Network.TESTNET,
    fullnodeUrl: "https://testnet.aptoslabs.com/v1",
    tradingHttpUrl: "https://api.testnet.example.com",
    tradingWsUrl: "wss://ws.testnet.example.com",
    deployment: {
      package: "0x123",
      predepositPackage: "0x456",
      campaignPackage: "0x4e110",
      usdc: "0x789",
      testc: "0xabc",
      perpEngineGlobal: "0xdef",
      dlpVault: "0x1",
      dlpShare: "0x2",
    },
    compatVersion: DEFAULT_COMPAT_VERSION,
  };
  return {
    aptos: {} as unknown as Aptos,
    ws: {} as unknown as DecibelWsSubscription,
    config,
    apiKey: "test-api-key",
  };
}

const EMPTY_SUMMARY = {
  lifetime_earned: 0,
  ready_to_claim: 0,
  total_claimed: 0,
  breakdown_by_type: [],
  claims: [],
  year_to_date: 0,
  weekly_wow_bps: 0,
  weekly_breakdown: [],
  total_claims: 0,
};

function mockFetch(body: unknown) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(body), { status: 200 })));
}

function sentHeaders(fetchSpy: ReturnType<typeof mockFetch>): Headers {
  return new Headers(fetchSpy.mock.calls[0]?.[1]?.headers);
}

describe("CampaignsReader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opts into unknown enum members on getActive", async () => {
    const fetchSpy = mockFetch([]);
    await new CampaignsReader(createMockDeps()).getActive();

    expect(sentHeaders(fetchSpy).get("Prefer")).toBe("include-unknown-enum-members");
  });

  it("opts into unknown enum members on getSummary", async () => {
    const fetchSpy = mockFetch(EMPTY_SUMMARY);
    await new CampaignsReader(createMockDeps()).getSummary({ accountAddress: "0x1" });

    expect(sentHeaders(fetchSpy).get("Prefer")).toBe("include-unknown-enum-members");
  });

  it("still applies caller-supplied headers alongside the opt-in", async () => {
    const fetchSpy = mockFetch([]);
    await new CampaignsReader(createMockDeps()).getActive({
      fetchOptions: { headers: { "X-Trace": "abc" } },
    });

    const headers = sentHeaders(fetchSpy);
    expect(headers.get("X-Trace")).toBe("abc");
    expect(headers.get("Prefer")).toBe("include-unknown-enum-members");
    expect(headers.get("Authorization")).toBe("Bearer test-api-key");
  });
});
