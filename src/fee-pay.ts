import { GasStationClient } from "@aptos-labs/gas-station-client";
import {
  AccountAuthenticator,
  PendingTransactionResponse,
  SimpleTransaction,
  TransactionResponseType,
} from "@aptos-labs/ts-sdk";

import { DecibelConfig } from "./constants";

/**
 * Submit a transaction with fee payer support.
 * Uses GasStationClient when gasStationApiKey is provided, otherwise falls back to legacy gasStationUrl.
 *
 * @param config The Decibel configuration
 * @param transaction The transaction to submit
 * @param senderAuthenticator The sender's authenticator
 * @returns A promise that resolves to the pending transaction response
 */
export async function submitFeePaidTransaction(
  config: DecibelConfig,
  transaction: SimpleTransaction,
  senderAuthenticator: AccountAuthenticator,
): Promise<PendingTransactionResponse> {
  // Use GasStationClient when API key is provided
  if (config.gasStationApiKey) {
    const gasStationClient = new GasStationClient({
      network: config.network,
      apiKey: config.gasStationApiKey,
      // Use gasStationUrl as base URL for custom networks like netna
      ...(config.gasStationUrl && { baseUrl: config.gasStationUrl }),
    });

    const { transactionHash } = await gasStationClient.signAndSubmitTransaction({
      transaction,
      senderAuthenticator,
    });

    // Build PendingTransactionResponse from SimpleTransaction.rawTransaction
    const rawTxn = transaction.rawTransaction;
    return {
      type: TransactionResponseType.Pending,
      hash: transactionHash,
      sender: rawTxn.sender.toString(),
      sequence_number: rawTxn.sequence_number.toString(),
      max_gas_amount: rawTxn.max_gas_amount.toString(),
      gas_unit_price: rawTxn.gas_unit_price.toString(),
      expiration_timestamp_secs: rawTxn.expiration_timestamp_secs.toString(),
      // Payload not available from gas station response
      payload: {} as PendingTransactionResponse["payload"],
    };
  }

  // Legacy: use custom fee payer service via gasStationUrl (for local dev with self-hosted fee payer)
  const gasStationUrl = config.gasStationUrl;
  if (!gasStationUrl) {
    throw new Error("Either gasStationApiKey or gasStationUrl must be provided");
  }

  const signatureBcs = Array.from(senderAuthenticator.bcsToBytes());
  const transactionBcs = Array.from(transaction.rawTransaction.bcsToBytes());
  const body = JSON.stringify({
    signature: signatureBcs,
    transaction: transactionBcs,
  });
  const response = await fetch(gasStationUrl + "/transactions", {
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
