import {
  AccountAddress,
  AuthenticationKey,
  hashValues,
  isValidFunctionInfo,
  Serializable,
  Serializer,
} from "@aptos-labs/ts-sdk";

import { toChecksumAddress } from "./eip55";

/** The SIWA domain wallets derive under on mainnet; other deployments pass their own hostname. */
export const MAINNET_SIWA_DOMAIN = "app.decibel.trade";
const DOMAIN = MAINNET_SIWA_DOMAIN;
const ETH_AUTH_FN = "0x1::ethereum_derivable_account::authenticate";
const SOL_AUTH_FN = "0x1::solana_derivable_account::authenticate";
const SUI_AUTH_FN = "0x1::sui_derivable_account::authenticate";

class DerivableAbstractPublicKey extends Serializable {
  constructor(
    public identity: string,
    public domain: string,
  ) {
    super();
  }

  serialize(serializer: Serializer): void {
    serializer.serializeStr(this.identity);
    serializer.serializeStr(this.domain);
  }
}

function deriveAptosAddress(authFn: string, identity: string, domain: string): string {
  if (!isValidFunctionInfo(authFn)) {
    throw new Error(`Invalid auth function: ${authFn}`);
  }
  const parts = authFn.split("::") as [string, string, string];
  const s1 = new Serializer();
  AccountAddress.fromString(parts[0]).serialize(s1);
  s1.serializeStr(parts[1]);
  s1.serializeStr(parts[2]);

  const s2 = new Serializer();
  s2.serializeBytes(new DerivableAbstractPublicKey(identity, domain).bcsToBytes());

  const data = hashValues([s1.toUint8Array(), s2.toUint8Array(), new Uint8Array([5])]);
  return new AuthenticationKey({ data }).derivedAddress().toString();
}

/**
 * Derive an Aptos account address from an Ethereum wallet address
 * using the derivable account pattern (scheme byte 0x05).
 *
 * The ETH address is checksummed via EIP-55 before derivation. `domain` is the SIWA domain the
 * wallet signed in under; the same wallet derives a different account per domain, so testnet
 * (`testnet-app.decibel.trade`) must pass its own.
 */
export function deriveAptosFromEth(ethAddress: string, domain: string = DOMAIN): string {
  return deriveAptosAddress(ETH_AUTH_FN, toChecksumAddress(ethAddress), domain);
}

/**
 * Derive an Aptos account address from a Solana wallet address
 * using the derivable account pattern (scheme byte 0x05).
 *
 * The Solana address (base58) is used as-is.
 */
export function deriveAptosFromSolana(solAddress: string, domain: string = DOMAIN): string {
  return deriveAptosAddress(SOL_AUTH_FN, solAddress, domain);
}

/**
 * Derive an Aptos account address from a Sui wallet address (32-byte hex, `0x`-prefixed,
 * lower case as wallets report it) using the derivable account pattern.
 */
export function deriveAptosFromSui(suiAddress: string, domain: string = DOMAIN): string {
  return deriveAptosAddress(SUI_AUTH_FN, suiAddress, domain);
}
