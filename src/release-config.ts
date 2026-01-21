export enum CompatVersion {
  // we can comment out old versions, after new ones have been released.
  // V0_0 = "v0.0", // decibel-testnet-release-v0.0
  // V0_1 = "v0.1", // decibel-testnet-release-v0.1
  // V0_2_PARTIAL = "v0.2.partial", // decibel-testnet-release-v0.2
  // V0_2 = "v0.2", // decibel-release-v0.12
  V0_3 = "v0.3", // decibel-testnet-release-v0.3
  V0_4 = "v0.4", // Current main branch (bumped when new branch is created)
}

export interface ReleaseConfig {
  compatVersion: CompatVersion;
}

export const PACKAGE = {
  NETNA: "0xb8a5788314451ce4d2fbbad32e1bad88d4184b73943b7fe5166eab93cf1a5a95",
  TESTNET: "0xd0b2dd565e0f2020d66d581a938e7766b2163db4b8c63410c17578d32b4e9e88",
};

export const DEFAULT_COMPAT_VERSION = CompatVersion.V0_3;

const NETNA_RELEASE_CONFIG: ReleaseConfig = {
  compatVersion: CompatVersion.V0_3,
};

const TESTNET_RELEASE_CONFIG: ReleaseConfig = {
  compatVersion: CompatVersion.V0_3,
};

const LOCAL_RELEASE_CONFIG: ReleaseConfig = {
  compatVersion: DEFAULT_COMPAT_VERSION,
};

const DOCKER_RELEASE_CONFIG: ReleaseConfig = {
  compatVersion: DEFAULT_COMPAT_VERSION,
};

export const RELEASE_CONFIGS = {
  NETNA: NETNA_RELEASE_CONFIG,
  TESTNET: TESTNET_RELEASE_CONFIG,
  LOCAL: LOCAL_RELEASE_CONFIG,
  DOCKER: DOCKER_RELEASE_CONFIG,
};
