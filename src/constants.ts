import { AccountAddress, Aptos, createObjectAddress, Network } from "@aptos-labs/ts-sdk";

import { DecibelWsSubscription } from "./read/ws-subscription";
import { PACKAGE, RELEASE_CONFIGS, ReleaseConfig } from "./release-config";

/**
 * Decimal precision for USDC, the protocol's primary collateral asset.
 *
 * Raw u64 values returned by on-chain view functions denominated in USDC
 * (e.g. `vault::get_vault_net_asset_value`, `vault::get_vault_num_shares` —
 * vault shares are minted at the same precision as the contribution asset)
 * must be divided by `10 ** USDC_DECIMALS` to convert to human-readable units.
 */
export const USDC_DECIMALS = 6;

/** 10 ** USDC_DECIMALS — divisor between raw on-chain USDC and display units. */
export const USDC_SCALE = 10 ** USDC_DECIMALS;

// Geomi gas station rejects any transaction with max_gas_amount > 250_000, while
// ts-sdk v7's DEFAULT_MAX_GAS_AMOUNT is 2_000_000. Cap every SDK code path at the
// gas station's exact ceiling — actual gas consumed is refunded, so reserving the
// full cap costs nothing and gains headroom against rare large transactions.
export const GAS_STATION_MAX_GAS_AMOUNT = 250_000;

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

export function getCampaignPackage(publisherAddr: string): string {
  if (publisherAddr === PACKAGE.NETNA) return PACKAGE.CAMPAIGN_NETNA;
  if (publisherAddr === PACKAGE.TESTNET) return PACKAGE.CAMPAIGN_TESTNET;
  if (publisherAddr === PACKAGE.MAINNET) return PACKAGE.CAMPAIGN_MAINNET;
  return "";
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
  /**
   * On-chain fee-payer address of the gas station that sponsors transactions.
   * Consumers supply their own — the SDK ships no gas-station addresses.
   *
   * Only required to submit *encrypted* transactions through a sponsoring gas
   * station: the fee-payer is mixed into the encrypted payload's AEAD associated
   * data at build time, so it must be known before signing (the usual
   * `AccountAddress.ZERO` placeholder can't be used). Not needed for sender-paid
   * (unsponsored) transactions; plaintext sponsored transactions don't need it
   * either — the gas-station plugin fills the fee payer in at submit time. When a
   * gas station is active (`gasStationApiKey` set) but this is unset, encryption
   * is disabled and the transaction falls back to the plaintext path (see
   * `canEncrypt`).
   *
   * Geomi currently supports a single fee-payer address (no multi-fee-payer).
   */
  gasStationAddress?: string;
  deployment: Deployment;
  chainId?: number;
  /**
   * Additional HTTP headers to include in all requests (Node API, trading API, WebSocket).
   * When set, replaces API key auth. All headers are passed through as-is.
   */
  additionalHeaders?: Record<string, string>;
}

/** A trading-api read failed (HTTP or schema parse) and was rebuilt from chain views. */
export interface ChainFallbackInfo {
  method: string;
  error: unknown;
}

export interface DecibelReaderDeps {
  aptos: Aptos;
  ws: DecibelWsSubscription;
  config: DecibelConfig;
  apiKey?: string;
  onChainFallback?: (info: ChainFallbackInfo) => void;
}

export interface Deployment {
  package: string;
  predepositPackage: string;
  campaignPackage: string;
  /** FFT campaign object address (`create_campaign` result), not the module address; readers fall back to `campaignPackage` when unset. */
  fftCampaignAddr?: string;
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
    campaignPackage: getCampaignPackage(pkg),
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

export const TESTNET_DEPLOYMENT: Deployment = getDeployment(PACKAGE.TESTNET);

export const TESTNET_CONFIG: DecibelConfig = {
  network: Network.TESTNET,
  fullnodeUrl: "https://api.testnet.aptoslabs.com/v1",
  tradingHttpUrl: "https://api.testnet.aptoslabs.com/decibel",
  tradingWsUrl: "wss://api.testnet.aptoslabs.com/decibel/ws",
  gasStationUrl: "https://api.testnet.aptoslabs.com/gs/v1",
  deployment: TESTNET_DEPLOYMENT,
  chainId: 2,
  ...RELEASE_CONFIGS.TESTNET,
};

const MAINNET_USDC = "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b";

export const MAINNET_DEPLOYMENT: Deployment = {
  ...getDeployment(PACKAGE.MAINNET),
  usdc: MAINNET_USDC,
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
