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
    /** The committed response, when the failure came from a confirmed transaction. */
    public readonly transaction?: CommittedTransactionResponse,
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

/**
 * Whether an encrypted txn committed as `failed_decryption`: it was encrypted to
 * a rotated epoch key and executed nothing. Walks `cause` chains, and accepts an
 * order result flagged `failedDecryption`, so wrapped app errors still match.
 */
export function isFailedDecryptionError(error: unknown): boolean {
  return findFailedDecryption(error) !== undefined;
}

/**
 * Key epoch the failed txn was encrypted to; pass it to `refreshEncryptionKey`
 * so a later build at the new key can't mask whether this one would still fail.
 */
export function getFailedDecryptionEpoch(error: unknown): bigint | undefined {
  return findFailedDecryption(error)?.epoch;
}

export function failedDecryptionFlags(error: unknown) {
  const found = findFailedDecryption(error);
  return found ? { failedDecryption: true as const, encryptionEpoch: found.epoch?.toString() } : {};
}

const parseEpoch = (raw: unknown) =>
  typeof raw === "string" && /^\d+$/.test(raw) ? BigInt(raw) : undefined;

function failedDecryptionPayload(committed: unknown): { epoch?: bigint } | undefined {
  const payload: unknown =
    typeof committed === "object" && committed !== null && "payload" in committed
      ? committed.payload
      : undefined;
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("encrypted_state" in payload) ||
    payload.encrypted_state !== "failed_decryption"
  ) {
    return undefined;
  }
  return {
    epoch: parseEpoch("encryption_epoch" in payload ? payload.encryption_epoch : undefined),
  };
}

function findFailedDecryption(error: unknown): { epoch?: bigint } | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 10 && typeof current === "object" && current !== null; depth++) {
    if ("failedDecryption" in current && current.failedDecryption === true) {
      return {
        epoch: parseEpoch("encryptionEpoch" in current ? current.encryptionEpoch : undefined),
      };
    }
    const committed =
      current instanceof TransactionSubmissionError ? current.transaction : undefined;
    const found = failedDecryptionPayload(committed);
    if (found) return found;
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
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
        undefined,
        committed,
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
      error instanceof TransactionSubmissionError ? error.transaction : undefined,
    );
  }
}
