import { AccountAddress, Aptos, createObjectAddress, Network } from "@aptos-labs/ts-sdk";

import { DecibelWsSubscription } from "./read/ws-subscription";
import { PACKAGE, RELEASE_CONFIGS, ReleaseConfig } from "./release-config";

export function getUsdcAddress(publisherAddr: string) {
  return createObjectAddress(
    AccountAddress.fromString(publisherAddr),
    new TextEncoder().encode("USDC"),
  );
}

export function getTestcAddress(publisherAddr: string) {
  return createObjectAddress(
    AccountAddress.fromString(publisherAddr),
    new TextEncoder().encode("TESTC"),
  );
}

export function getPerpEngineGlobalAddress(publisherAddr: string) {
  return createObjectAddress(
    AccountAddress.fromString(publisherAddr),
    new TextEncoder().encode("GlobalPerpEngine"),
  );
}

export interface DecibelConfig extends ReleaseConfig {
  network: Network;
  fullnodeUrl: string;
  tradingHttpUrl: string;
  tradingWsUrl: string;
  /**
   * Gas station URL. When used with gasStationApiKey, this is the base URL for the Aptos Labs Gas Station API.
   * When used without gasStationApiKey, this is the URL for the legacy self-hosted fee payer (local dev only).
   * Example: "https://api.netna.aptoslabs.com/gs/v1"
   */
  gasStationUrl?: string;
  /**
   * API key for Aptos Labs Gas Station Client.
   * When provided, uses GasStationClient with gasStationUrl as base URL.
   */
  gasStationApiKey?: string;
  deployment: Deployment;
  chainId?: number;
}

export interface DecibelReaderDeps {
  aptos: Aptos;
  ws: DecibelWsSubscription;
  config: DecibelConfig;
  apiKey?: string;
}

export interface Deployment {
  package: string;
  usdc: string;
  testc: string;
  perpEngineGlobal: string;
}

const getDeployment = (pkg: string): Deployment => {
  return {
    package: pkg,
    usdc: getUsdcAddress(pkg).toString(),
    testc: getTestcAddress(pkg).toString(),
    perpEngineGlobal: getPerpEngineGlobalAddress(pkg).toString(),
  };
};

export const NETNA_CONFIG: DecibelConfig = {
  network: Network.CUSTOM,
  fullnodeUrl: "https://api.netna.staging.aptoslabs.com/v1",
  tradingHttpUrl: "https://api.netna.staging.aptoslabs.com/decibel",
  tradingWsUrl: "wss://api.netna.staging.aptoslabs.com/decibel/ws",
  gasStationUrl: "https://api.netna.staging.aptoslabs.com/gs/v1",
  deployment: getDeployment(PACKAGE.NETNA),
  chainId: 208,
  ...RELEASE_CONFIGS.NETNA,
};

export const TESTNET_DEPLOYMENT: Deployment = {
  package: PACKAGE.TESTNET,
  usdc: getUsdcAddress(PACKAGE.TESTNET).toString(),
  testc: getTestcAddress(PACKAGE.TESTNET).toString(),
  perpEngineGlobal: getPerpEngineGlobalAddress(PACKAGE.TESTNET).toString(),
};

export const TESTNET_CONFIG: DecibelConfig = {
  network: Network.TESTNET,
  fullnodeUrl: "https://api.testnet.aptoslabs.com/v1",
  tradingHttpUrl: "https://api.testnet.aptoslabs.com/decibel",
  tradingWsUrl: "wss://api.testnet.aptoslabs.com/decibel/ws",
  gasStationUrl: "https://api.testnet.aptoslabs.com/gs/v1",
  deployment: getDeployment(PACKAGE.TESTNET),
  chainId: 2,
  ...RELEASE_CONFIGS.TESTNET,
};

export const LOCAL_CONFIG: DecibelConfig = {
  network: Network.CUSTOM,
  fullnodeUrl: "http://localhost:8080/v1",
  tradingHttpUrl: "http://localhost:8084",
  tradingWsUrl: "ws://localhost:8083",
  gasStationUrl: "http://localhost:8085",
  deployment: getDeployment(PACKAGE.NETNA),
  ...RELEASE_CONFIGS.LOCAL,
};

export const DOCKER_CONFIG: DecibelConfig = {
  network: Network.CUSTOM,
  fullnodeUrl: "http://tradenet:8080/v1",
  tradingHttpUrl: "http://trading-api-http:8080",
  // nosemgrep: javascript.lang.security.detect-insecure-websocket.detect-insecure-websocket
  tradingWsUrl: "ws://trading-api-ws:8080",
  gasStationUrl: "http://fee-payer:8080",
  deployment: getDeployment(PACKAGE.NETNA),
  ...RELEASE_CONFIGS.DOCKER,
};

export const NAMED_CONFIGS: Record<string, DecibelConfig | undefined> = {
  netna: NETNA_CONFIG,
  local: LOCAL_CONFIG,
  docker: DOCKER_CONFIG,
  testnet: TESTNET_CONFIG,
};

export const QUERY_PARAM_KEYS = {
  offset: "offset",
  limit: "limit",
  sortKey: "sort_key",
  sortDir: "sort_dir",
  searchTerm: "search_term",
};
