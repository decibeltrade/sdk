import { Aptos, Network } from "@aptos-labs/ts-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DecibelConfig, DecibelReaderDeps } from "../../constants";
import { DEFAULT_COMPAT_VERSION } from "../../release-config";
import { DecibelWsSubscription } from "../ws-subscription";
import { MarketTradesReader } from "./market-trades.reader";

function createMockDeps(): DecibelReaderDeps {
  const mockConfig: DecibelConfig = {
    network: Network.TESTNET,
    fullnodeUrl: "https://testnet.aptoslabs.com/v1",
    tradingHttpUrl: "https://api.testnet.example.com",
    tradingWsUrl: "wss://ws.testnet.example.com",
    deployment: {
      package: "0x0000000000000000000000000000000000000000000000000000000000000123",
      predepositPackage: "0x0000000000000000000000000000000000000000000000000000000000000456",
      campaignPackage: "0x0000000000000000000000000000000000000000000000000000000000004e110",
      usdc: "0x0000000000000000000000000000000000000000000000000000000000000789",
      testc: "0x0000000000000000000000000000000000000000000000000000000000000abc",
      perpEngineGlobal: "0x0000000000000000000000000000000000000000000000000000000000000def",
      dlpVault: "0x0000000000000000000000000000000000000000000000000000000000000ghi",
      dlpShare: "0x0000000000000000000000000000000000000000000000000000000000000jkl",
    },
    compatVersion: DEFAULT_COMPAT_VERSION,
  };

  return {
    aptos: {} as unknown as Aptos,
    ws: {} as unknown as DecibelWsSubscription,
    config: mockConfig,
    apiKey: "test-api-key",
  };
}

const FILL = {
  account: "0xa",
  market: "0xm",
  action: "OpenLong",
  size: 1,
  price: 2000,
  is_profit: false,
  realized_pnl_amount: 0,
  realized_funding_amount: 0,
  is_rebate: false,
  fee_amount: 0.5,
  transaction_unix_ms: 1_000,
  transaction_version: 7,
};

describe("MarketTradesReader.getWindow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests /api/v1/trades/window with the window and parses the bare array", async () => {
    const reader = new MarketTradesReader(createMockDeps());
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify([FILL]), { status: 200 }));

    const result = await reader.getWindow({
      marketAddr: "0xm",
      fromMs: 1_000,
      toMs: 2_000,
      minNotionalUsd: 100,
      limit: 1000,
    });

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "https://api.testnet.example.com/api/v1/trades/window?market=0xm&from_ms=1000&to_ms=2000&min_notional_usd=100&limit=1000",
    );
    expect(result).toEqual([FILL]);
  });
});
