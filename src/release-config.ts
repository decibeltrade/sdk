export enum CompatVersion {
  V0_0 = "v0.0", // decibel-testnet-release-v0.0
  V0_1 = "v0.1", // decibel-testnet-release-v0.1
  V0_2 = "v0.2", // decibel-testnet-release-v0.2
  V0_3 = "v0.3", // Current main branch (bumped when new branch is created)
}

export type SubaccountVariant = "v0" | "v1" | "v2";

export interface ReleaseConfig {
  compatVersion: CompatVersion;
  subaccountVariant: SubaccountVariant;
}

export const PACKAGE = {
  NETNA: "0xb8a5788314451ce4d2fbbad32e1bad88d4184b73943b7fe5166eab93cf1a5a95",
  TESTNET: "0x9f830083a19fb8b87395983ca9edaea2b0379c97be6dfe234bb914e6c6672844",
};

export const DEFAULT_COMPAT_VERSION = CompatVersion.V0_3;

const NETNA_RELEASE_CONFIG: ReleaseConfig = {
  compatVersion: DEFAULT_COMPAT_VERSION,
  subaccountVariant: "v2",
};

const TESTNET_RELEASE_CONFIG: ReleaseConfig = {
  compatVersion: CompatVersion.V0_2,
  subaccountVariant: "v2",
};

const LOCAL_RELEASE_CONFIG: ReleaseConfig = {
  compatVersion: DEFAULT_COMPAT_VERSION,
  subaccountVariant: "v1",
};

const DOCKER_RELEASE_CONFIG: ReleaseConfig = {
  compatVersion: DEFAULT_COMPAT_VERSION,
  subaccountVariant: "v1",
};

export const RELEASE_CONFIGS = {
  NETNA: NETNA_RELEASE_CONFIG,
  TESTNET: TESTNET_RELEASE_CONFIG,
  LOCAL: LOCAL_RELEASE_CONFIG,
  DOCKER: DOCKER_RELEASE_CONFIG,
};
