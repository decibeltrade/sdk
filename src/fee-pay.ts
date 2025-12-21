import {
  AccountAuthenticator,
  PendingTransactionResponse,
  SimpleTransaction,
} from "@aptos-labs/ts-sdk";

import { DecibelConfig } from "./constants";

/**
 * Submit a transaction with fee payer support
 * @param config The Decibel configuration containing the gas station URL
 * @param transaction The transaction to submit
 * @param senderAuthenticator The sender's authenticator
 * @returns A promise that resolves to the pending transaction response
 */
export async function submitFeePaidTransaction(
  config: DecibelConfig,
  transaction: SimpleTransaction,
  senderAuthenticator: AccountAuthenticator,
): Promise<PendingTransactionResponse> {
  const signatureBcs = Array.from(senderAuthenticator.bcsToBytes());
  const transactionBcs = Array.from(transaction.rawTransaction.bcsToBytes());
  const body = JSON.stringify({
    signature: signatureBcs,
    transaction: transactionBcs,
  });
  const response = await fetch(config.gasStationUrl + "/transactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  // TODO(bl): Error handling
  return (await response.json()) as PendingTransactionResponse;
}
