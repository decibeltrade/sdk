export enum CompatVersion {
  // we can comment out old versions, after new ones have been released.
  // V0_0 = "v0.0", // decibel-testnet-release-v0.0
  // V0_1 = "v0.1", // decibel-testnet-release-v0.1
  // V0_2_PARTIAL = "v0.2.partial", // decibel-testnet-release-v0.2
  // V0_2 = "v0.2", // decibel-release-v0.12
  // V0_3 = "v0.3", // decibel-testnet-release-v0.3
  V0_4 = "v0.4", // decibel-testnet-release-v0.4 - and final version.
}

export interface ReleaseConfig {
  compatVersion: CompatVersion;
}

export const PACKAGE = {
  NETNA: "0xb8a5788314451ce4d2fbbad32e1bad88d4184b73943b7fe5166eab93cf1a5a95",
  TESTNET: "0xe7da2794b1d8af76532ed95f38bfdf1136abfd8ea3a240189971988a83101b7f",
  PREDEPOSIT: "0xc5939ec6e7e656cb6fed9afa155e390eb2aa63ba74e73157161829b2f80e1538",
  MAINNET: "0x50ead22afd6ffd9769e3b3d6e0e64a2a350d68e8b102c4e72e33d0b8cfdfdb06",
};

export const DEFAULT_COMPAT_VERSION = CompatVersion.V0_4;

const NETNA_RELEASE_CONFIG: ReleaseConfig = {
  compatVersion: CompatVersion.V0_4,
};

const TESTNET_RELEASE_CONFIG: ReleaseConfig = {
  compatVersion: CompatVersion.V0_4,
};

const LOCAL_RELEASE_CONFIG: ReleaseConfig = {
  compatVersion: DEFAULT_COMPAT_VERSION,
};

const DOCKER_RELEASE_CONFIG: ReleaseConfig = {
  compatVersion: DEFAULT_COMPAT_VERSION,
};

const MAINNET_RELEASE_CONFIG: ReleaseConfig = {
  compatVersion: CompatVersion.V0_4,
};

export const RELEASE_CONFIGS = {
  NETNA: NETNA_RELEASE_CONFIG,
  TESTNET: TESTNET_RELEASE_CONFIG,
  LOCAL: LOCAL_RELEASE_CONFIG,
  DOCKER: DOCKER_RELEASE_CONFIG,
  MAINNET: MAINNET_RELEASE_CONFIG,
};
