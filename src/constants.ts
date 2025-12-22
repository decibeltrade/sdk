import { AccountAddress, Aptos, createObjectAddress, Network } from "@aptos-labs/ts-sdk";

import { DecibelWsSubscription } from "./read/ws-subscription";
import { CompatVersion, PACKAGE, RELEASE_CONFIGS, ReleaseConfig } from "./release-config";

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
  gasStationUrl: string;
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
  fullnodeUrl: "https://api.netna.aptoslabs.com/v1",
  tradingHttpUrl: "https://api.netna.aptoslabs.com/decibel",
  tradingWsUrl: "wss://api.netna.aptoslabs.com/decibel/ws",
  gasStationUrl: "https://fee-payer-dev-netna-us-central1-410192433417.us-central1.run.app",
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
  gasStationUrl: "https://fee-payer-staging-testnet-us-central1-502735673999.us-central1.run.app",
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

export function getVaultApiModule(compatVersion: CompatVersion) {
  if (compatVersion === CompatVersion.V0_1) {
    return `vault`;
  } else {
    return `vault_api`;
  }
}
