import { AccountAddress, Aptos, createObjectAddress, Network } from "@aptos-labs/ts-sdk";

import { DecibelWsSubscription } from "./read/ws-subscription";

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

export enum CompatVersion {
  V0_1 = "v0.1", // decibel-testnet-release-v0.1
  V0_2 = "v0.2", // Current main branch (bumped when new branch is created)
}

export const DEFAULT_COMPAT_VERSION = CompatVersion.V0_2;

export interface DecibelConfig {
  network: Network;
  fullnodeUrl: string;
  tradingHttpUrl: string;
  tradingWsUrl: string;
  gasStationUrl: string;
  deployment: Deployment;
  chainId?: number;
  compatVersion: CompatVersion;
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

const NETNA_PACKAGE = "0xb8a5788314451ce4d2fbbad32e1bad88d4184b73943b7fe5166eab93cf1a5a95";
export const NETNA_DEPLOYMENT: Deployment = {
  package: NETNA_PACKAGE,
  usdc: getUsdcAddress(NETNA_PACKAGE).toString(),
  testc: getTestcAddress(NETNA_PACKAGE).toString(),
  perpEngineGlobal: getPerpEngineGlobalAddress(NETNA_PACKAGE).toString(),
};

export const NETNA_CONFIG: DecibelConfig = {
  network: Network.CUSTOM,
  fullnodeUrl: "https://api.netna.aptoslabs.com/v1",
  tradingHttpUrl: "https://api.netna.aptoslabs.com/decibel",
  tradingWsUrl: "wss://api.netna.aptoslabs.com/decibel/ws",
  gasStationUrl: "https://fee-payer-dev-netna-us-central1-410192433417.us-central1.run.app",
  deployment: NETNA_DEPLOYMENT,
  chainId: 206,
  compatVersion: DEFAULT_COMPAT_VERSION,
};

const TESTNET_PACKAGE = "0x1f513904b7568445e3c291a6c58cb272db017d8a72aea563d5664666221d5f75";
export const TESTNET_DEPLOYMENT: Deployment = {
  package: TESTNET_PACKAGE,
  usdc: getUsdcAddress(TESTNET_PACKAGE).toString(),
  testc: getTestcAddress(TESTNET_PACKAGE).toString(),
  perpEngineGlobal: getPerpEngineGlobalAddress(TESTNET_PACKAGE).toString(),
};

export const TESTNET_CONFIG: DecibelConfig = {
  network: Network.TESTNET,
  fullnodeUrl: "https://api.testnet.aptoslabs.com/v1",
  tradingHttpUrl: "https://api.testnet.aptoslabs.com/decibel",
  tradingWsUrl: "wss://api.testnet.aptoslabs.com/decibel/ws",
  gasStationUrl: "https://fee-payer-staging-testnet-us-central1-502735673999.us-central1.run.app",
  deployment: TESTNET_DEPLOYMENT,
  chainId: 2,
  compatVersion: CompatVersion.V0_1,
};

export const LOCAL_CONFIG: DecibelConfig = {
  network: Network.CUSTOM,
  fullnodeUrl: "http://localhost:8080/v1",
  tradingHttpUrl: "http://localhost:8084",
  tradingWsUrl: "ws://localhost:8083",
  gasStationUrl: "http://localhost:8085",
  deployment: NETNA_DEPLOYMENT,
  compatVersion: DEFAULT_COMPAT_VERSION,
};

export const DOCKER_CONFIG: DecibelConfig = {
  network: Network.CUSTOM,
  fullnodeUrl: "http://tradenet:8080/v1",
  tradingHttpUrl: "http://trading-api-http:8080",
  // nosemgrep: javascript.lang.security.detect-insecure-websocket.detect-insecure-websocket
  tradingWsUrl: "ws://trading-api-ws:8080",
  gasStationUrl: "http://fee-payer:8080",
  deployment: NETNA_DEPLOYMENT,
  compatVersion: DEFAULT_COMPAT_VERSION,
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

export function getVaultApiModule(compatVersion: CompatVersion) {
  if (compatVersion === CompatVersion.V0_1) {
    return `vault`;
  } else {
    return `vault_api`;
  }
}
