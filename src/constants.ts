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

export function getDlpVaultAddress(publisherAddr: string) {
  const vaultConfigAddr = createObjectAddress(
    AccountAddress.fromString(publisherAddr),
    new TextEncoder().encode("GlobalVaultConfig"),
  );
  return createObjectAddress(vaultConfigAddr, new TextEncoder().encode("Decibel Protocol Vault"));
}

export function getDlpShareAddress(publisherAddr: string) {
  const dlpVaultAddr = getDlpVaultAddress(publisherAddr);
  return createObjectAddress(dlpVaultAddr, new TextEncoder().encode("vault_share_asset"));
}
export interface DecibelConfig extends ReleaseConfig {
  network: Network;
  fullnodeUrl: string;
  tradingHttpUrl: string;
  tradingWsUrl: string;
  /**
   * Base URL for the Geomi Gas Station API.
   * Example: "https://api.testnet.aptoslabs.com/gs/v1"
   */
  gasStationUrl?: string;
  /**
   * API key for Geomi Gas Station Client.
   * When provided, uses GasStationClient with gasStationUrl as base URL.
   */
  gasStationApiKey?: string;
  deployment: Deployment;
  chainId?: number;
  /**
   * Additional HTTP headers to include in all requests (Node API, trading API, WebSocket).
   * When set, replaces API key auth. All headers are passed through as-is.
   */
  additionalHeaders?: Record<string, string>;
}

export interface DecibelReaderDeps {
  aptos: Aptos;
  ws: DecibelWsSubscription;
  config: DecibelConfig;
  apiKey?: string;
}

export interface Deployment {
  package: string;
  predepositPackage: string;
  campaignPackage: string;
  usdc: string;
  testc: string;
  perpEngineGlobal: string;
  dlpVault: string;
  dlpShare: string;
}

const getDeployment = (pkg: string): Deployment => {
  return {
    package: pkg,
    predepositPackage: PACKAGE.PREDEPOSIT,
    campaignPackage: "",
    usdc: getUsdcAddress(pkg).toString(),
    testc: getTestcAddress(pkg).toString(),
    perpEngineGlobal: getPerpEngineGlobalAddress(pkg).toString(),
    dlpVault: getDlpVaultAddress(pkg).toString(),
    dlpShare: getDlpShareAddress(pkg).toString(),
  };
};

export const NETNA_CONFIG: DecibelConfig = {
  network: Network.CUSTOM,
  fullnodeUrl: "https://api.netna.aptoslabs.com/v1",
  tradingHttpUrl: "https://api.netna.aptoslabs.com/decibel",
  tradingWsUrl: "wss://api.netna.aptoslabs.com/decibel/ws",
  gasStationUrl: "https://api.netna.aptoslabs.com/gs/v1",
  deployment: getDeployment(PACKAGE.NETNA),
  chainId: 208,
  ...RELEASE_CONFIGS.NETNA,
};

export const TESTNET_DEPLOYMENT: Deployment = {
  package: PACKAGE.TESTNET,
  predepositPackage: PACKAGE.PREDEPOSIT,
  campaignPackage: "",
  usdc: getUsdcAddress(PACKAGE.TESTNET).toString(),
  testc: getTestcAddress(PACKAGE.TESTNET).toString(),
  perpEngineGlobal: getPerpEngineGlobalAddress(PACKAGE.TESTNET).toString(),
  dlpVault: getDlpVaultAddress(PACKAGE.TESTNET).toString(),
  dlpShare: getDlpShareAddress(PACKAGE.TESTNET).toString(),
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

const MAINNET_USDC = "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b";

export const MAINNET_DEPLOYMENT: Deployment = {
  package: PACKAGE.MAINNET,
  predepositPackage: PACKAGE.PREDEPOSIT,
  campaignPackage: "",
  usdc: MAINNET_USDC,
  testc: getTestcAddress(PACKAGE.MAINNET).toString(),
  perpEngineGlobal: getPerpEngineGlobalAddress(PACKAGE.MAINNET).toString(),
  dlpVault: getDlpVaultAddress(PACKAGE.MAINNET).toString(),
  dlpShare: getDlpShareAddress(PACKAGE.MAINNET).toString(),
};

export const MAINNET_CONFIG: DecibelConfig = {
  network: Network.MAINNET,
  fullnodeUrl: "https://api.mainnet.aptoslabs.com/v1",
  tradingHttpUrl: "https://api.mainnet.aptoslabs.com/decibel",
  tradingWsUrl: "wss://api.mainnet.aptoslabs.com/decibel/ws",
  gasStationUrl: "https://api.mainnet.aptoslabs.com/gs/v1",
  deployment: MAINNET_DEPLOYMENT,
  chainId: 1,
  ...RELEASE_CONFIGS.MAINNET,
};

export const LOCAL_CONFIG: DecibelConfig = {
  network: Network.CUSTOM,
  fullnodeUrl: "http://localhost:8080/v1",
  tradingHttpUrl: "http://localhost:8084",
  tradingWsUrl: "ws://localhost:8083",
  deployment: getDeployment(PACKAGE.NETNA),
  ...RELEASE_CONFIGS.LOCAL,
};

export const DOCKER_CONFIG: DecibelConfig = {
  network: Network.CUSTOM,
  fullnodeUrl: "http://tradenet:8080/v1",
  tradingHttpUrl: "http://trading-api-http:8080",
  // nosemgrep: javascript.lang.security.detect-insecure-websocket.detect-insecure-websocket
  tradingWsUrl: "ws://trading-api-ws:8080",
  deployment: getDeployment(PACKAGE.NETNA),
  ...RELEASE_CONFIGS.DOCKER,
};

export const NAMED_CONFIGS: Record<string, DecibelConfig | undefined> = {
  netna: NETNA_CONFIG,
  local: LOCAL_CONFIG,
  docker: DOCKER_CONFIG,
  testnet: TESTNET_CONFIG,
  mainnet: MAINNET_CONFIG,
};

export const QUERY_PARAM_KEYS = {
  offset: "offset",
  limit: "limit",
  sortKey: "sort_key",
  sortDir: "sort_dir",
  searchTerm: "search_term",
};
