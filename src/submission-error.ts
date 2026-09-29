import {
  Aptos,
  CommittedTransactionResponse,
  isUserTransactionResponse,
  PendingTransactionResponse,
} from "@aptos-labs/ts-sdk";

import { errorToMessage } from "./utils";

/** Submission provenance is a snapshot; unknown is unresolved, not terminal. */
export interface TransactionSubmissionFailure {
  outcome: "not-submitted" | "reverted" | "unknown";
  transactionHash?: string;
}

export class TransactionSubmissionError extends Error {
  constructor(
    message: string,
    public readonly submission: TransactionSubmissionFailure,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "TransactionSubmissionError";
  }
}

export function getTransactionSubmissionFailure(
  error: unknown,
): TransactionSubmissionFailure | undefined {
  return error instanceof TransactionSubmissionError ? error.submission : undefined;
}

/** Submit once and retain the acknowledged hash when confirmation is unresolved. */
export async function submitAndWaitForTransaction(
  aptos: Pick<Aptos, "waitForTransaction">,
  submit: () => Promise<Pick<PendingTransactionResponse, "hash">>,
): Promise<CommittedTransactionResponse> {
  let transactionHash: string | undefined;
  try {
    transactionHash = (await submit()).hash;
    const committed = await aptos.waitForTransaction({
      transactionHash,
      options: { checkSuccess: false },
    });
    if (!isUserTransactionResponse(committed)) {
      throw new Error("Invalid transaction confirmation response");
    }
    if (!transactionHash || committed.hash !== transactionHash) {
      throw new Error("Invalid transaction confirmation response");
    }
    const success: unknown = committed.success;
    if (typeof success !== "boolean") {
      throw new Error("Invalid transaction confirmation response");
    }
    if (!success) {
      throw new TransactionSubmissionError(
        `Transaction ${transactionHash} failed: ${committed.vm_status}`,
        { outcome: "reverted", transactionHash },
      );
    }
    return committed;
  } catch (error) {
    const failure = getTransactionSubmissionFailure(error);
    throw new TransactionSubmissionError(
      errorToMessage(error),
      {
        outcome: failure?.outcome ?? "unknown",
        transactionHash: failure?.transactionHash ?? transactionHash,
      },
      error,
    );
  }
}
