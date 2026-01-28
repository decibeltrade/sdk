import { Aptos, Network } from "@aptos-labs/ts-sdk";
import { describe, expect, it, vi } from "vitest";

import { DecibelConfig, DecibelReaderDeps } from "../../constants";
import { DEFAULT_COMPAT_VERSION } from "../../release-config";
import { DecibelWsSubscription } from "../ws-subscription";
import { MarketDepthReader } from "./market-depth.reader";
import { MarketDepthAggregationSize } from "./market-depth.types";

describe("MarketDepthReader - Aggregation Levels", () => {
  const createMockDeps = (): DecibelReaderDeps => {
    const mockAptos = {
      config: {
        network: Network.TESTNET,
      },
    } as unknown as Aptos;

    const mockConfig: DecibelConfig = {
      network: Network.TESTNET,
      fullnodeUrl: "https://testnet.aptoslabs.com/v1",
      tradingHttpUrl: "https://api.testnet.example.com",
      tradingWsUrl: "wss://ws.testnet.example.com",
      deployment: {
        package: "0x0000000000000000000000000000000000000000000000000000000000000123",
        usdc: "0x0000000000000000000000000000000000000000000000000000000000000456",
        testc: "0x0000000000000000000000000000000000000000000000000000000000000789",
        perpEngineGlobal: "0x0000000000000000000000000000000000000000000000000000000000000abc",
      },
      compatVersion: DEFAULT_COMPAT_VERSION,
    };

    const mockWs = {
      subscribe: vi.fn(),
      reset: vi.fn(),
    } as unknown as DecibelWsSubscription;

    return {
      aptos: mockAptos,
      ws: mockWs,
      config: mockConfig,
    };
  };

  describe("subscribeByName() - topic generation with aggregation levels", () => {
    it("should generate correct topics for all aggregation levels", () => {
      const deps = createMockDeps();
      const reader = new MarketDepthReader(deps);
      const aggregationLevels: MarketDepthAggregationSize[] = reader.getAggregationSizes();
      const mockCallback = vi.fn();

      aggregationLevels.forEach((level) => {
        reader.subscribeByName("BTC/USD", level, mockCallback);
      });

      expect(deps.ws.subscribe).toHaveBeenCalledTimes(aggregationLevels.length);
      aggregationLevels.forEach((level) => {
        expect(deps.ws.subscribe).toHaveBeenCalledWith(
          expect.stringMatching(new RegExp(`^depth:0x[a-f0-9]+:${level}$`)),
          expect.any(Object),
          mockCallback,
        );
      });
    });
  });

  describe("resetSubscriptionByName() - topic generation with aggregation levels", () => {
    it("should generate correct topics for all aggregation levels", () => {
      const deps = createMockDeps();
      const reader = new MarketDepthReader(deps);
      const aggregationLevels: MarketDepthAggregationSize[] = reader.getAggregationSizes();

      aggregationLevels.forEach((level) => {
        reader.resetSubscriptionByName("BTC/USD", level);
      });

      expect(deps.ws.reset).toHaveBeenCalledTimes(aggregationLevels.length);
      aggregationLevels.forEach((level) => {
        expect(deps.ws.reset).toHaveBeenCalledWith(
          expect.stringMatching(new RegExp(`^depth:0x[a-f0-9]+:${level}$`)),
        );
      });
    });
  });
});
