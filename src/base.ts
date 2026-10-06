import { GasStationClient, GasStationTransactionSubmitter } from "@aptos-labs/gas-station-client";
import {
  Account,
  AccountAddress,
  AccountAuthenticator,
  Aptos,
  AptosConfig,
  buildTransaction,
  CommittedTransactionResponse,
  generateTransactionPayload,
  InputEntryFunctionData,
  InputGenerateTransactionPayloadData,
  MIN_ENCRYPTED_TXN_GAS_UNIT_PRICE,
  MoveFunction,
  MoveFunctionId,
  PendingTransactionResponse,
  SimpleTransaction,
} from "@aptos-labs/ts-sdk";

import mainnetAbis from "./abi/json/mainnet.json";
import testnetAbis from "./abi/json/testnet.json";
import { ABIData } from "./abi/types";
import {
  DecibelConfig,
  GAS_STATION_MAX_GAS_AMOUNT,
  MAINNET_CONFIG,
  TESTNET_CONFIG,
} from "./constants";
import { GasPriceManager } from "./gas/gas-price-manager";
import { resolveMaxGasAmount } from "./gas/resolve-max-gas-amount";
import { classifyTxKind, type EncryptionFallbackReason, type TxKind } from "./order-functions";
import {
  getTransactionSubmissionFailure,
  submitAndWaitForTransaction,
  TransactionSubmissionError,
  type TransactionSubmissionFailure,
} from "./submission-error";
import { buildSimpleTransactionSync } from "./transaction-builder";
import {
  errorToMessage,
  generateRandomReplayProtectionNonce,
  getPrimarySubaccountAddr,
} from "./utils";

export interface Options {
  skipSimulate?: boolean;
  nodeApiKey?: string;
  gasPriceManager?: GasPriceManager;
  /**
   * Time delta in milliseconds to add to Date.now() for expiration timestamps.
   * Used to sync with server time when client clock is incorrect.
   */
  timeDeltaMs?: number;
  /**
   * When true, all front-run-sensitive write methods (placeOrder, cancelOrder,
   * etc.) submit encrypted by default. Per-call `encrypted` in
   * WriteSubmissionOpts overrides this for individual calls. Defaults to false.
   */
  defaultEncrypted?: boolean;
  /**
   * Optional telemetry callback invoked once per `sendTx`/`sendEncryptedTx`
   * call, after it commits or throws (including pre-submit build failures).
   * Lets a host app record gas, latency, and success-rate metrics split by
   * encrypted vs unencrypted, without coupling the SDK to any analytics
   * provider. Callback errors are swallowed.
   */
  onTransactionSettled?: (metrics: TransactionSettledMetrics) => void;
}

/** Per-transaction telemetry passed to `Options.onTransactionSettled`. */
export interface TransactionSettledMetrics {
  /** Whether the transaction was actually submitted encrypted (false on fallback). */
  encrypted: boolean;
  /** Whether the caller asked for encryption (`sendEncryptedTx`). */
  encryptionRequested: boolean;
  /** Why an encryption-requested transaction went plaintext. */
  fallbackReason?: EncryptionFallbackReason;
  /** On-chain success flag. False when the call threw. */
  success: boolean;
  /** Submission provenance when the call threw. */
  outcome?: TransactionSubmissionFailure["outcome"];
  /** Wall-clock milliseconds from call entry (incl. probe, build, simulate) to settle. */
  durationMs: number;
  /** On-chain transaction hash, when the submission was acknowledged. */
  hash?: string;
  /** Entry-function id, when the payload exposed one. */
  functionId?: string;
  /** Order classification of `functionId`; see `classifyTxKind`. */
  txKind: TxKind;
  gasUsed?: number;
  gasUnitPrice?: number;
  /** On-chain `vm_status`, when available. */
  vmStatus?: string;
  /** Error message when the call threw. */
  error?: string;
}

/** Submission-time concerns shared by every write call. */
export interface SendTxOpts {
  accountOverride?: Account;
}

/**
 * Whether a config permits encrypted submission at all, independent of the
 * fullnode's capability. An encrypted txn bakes the literal fee-payer address
 * into its AEAD associated data at build time, so a gas station without a known
 * address can't sponsor one — see `gasStationAddress` in constants.ts.
 *
 * Exported so a host app can show the user the same answer the submit path will
 * reach, instead of re-deriving the rule. `encryptionBlocker` is the SDK-side consumer.
 */
export function configSupportsEncryptedSubmission(
  config: Pick<DecibelConfig, "gasStationApiKey" | "gasStationAddress">,
): boolean {
  return !config.gasStationApiKey || !!config.gasStationAddress;
}

type ProbeState = "supported" | "unsupported" | "failed";

// Telemetry carried from call entry to the single settle emit.
interface SettleContext {
  encrypted: boolean;
  encryptionRequested: boolean;
  fallbackReason?: EncryptionFallbackReason;
  functionId?: string;
  start: number;
}

const chainIdToAbi: Record<number, ABIData> = {};
if (TESTNET_CONFIG.chainId) chainIdToAbi[TESTNET_CONFIG.chainId] = testnetAbis as ABIData;
if (MAINNET_CONFIG.chainId) chainIdToAbi[MAINNET_CONFIG.chainId] = mainnetAbis as ABIData;

export class BaseSDK {
  readonly aptos: Aptos;
  readonly skipSimulate: boolean;
  private readonly useGasStation: boolean;
  private readonly chainId: number | undefined;
  // Bundled ABIs for the network we're pointed at, when one ships with the SDK.
  // ABI keys are fully address-qualified (`0xpkg::module::fn`), so a different
  // network's ABIs can never match — networks without a bundled set (localnet,
  // docker) leave this undefined and fall back to fetching per transaction.
  private readonly abi: ABIData | undefined;
  private readonly gasPriceManager: GasPriceManager | undefined;
  private readonly onTransactionSettled: Options["onTransactionSettled"];
  // Memoized probe result. We cache the Promise so concurrent first-time
  // callers share a single getLedgerInfo round-trip. A settled answer is kept
  // for the SDK's lifetime; a failed probe is uncached so the next call retries
  // instead of stranding the SDK in unencrypted mode.
  private nodeSupportsEncryptionPromise: Promise<ProbeState> | undefined;
  /**
   * Time delta in milliseconds to add to Date.now() for expiration timestamps.
   */
  public timeDeltaMs: number;

  constructor(
    readonly config: DecibelConfig,
    /**
     * The main account
     */
    readonly account: Account,
    opts?: Options,
  ) {
    this.abi = config.chainId ? chainIdToAbi[config.chainId] : undefined;

    this.useGasStation = !!config.gasStationApiKey;

    const pluginSettings =
      this.useGasStation && config.gasStationApiKey
        ? {
            TRANSACTION_SUBMITTER: new GasStationTransactionSubmitter(
              new GasStationClient({
                network: config.network,
                apiKey: config.gasStationApiKey,
                // Use gasStationUrl as base URL for custom networks like localnet
                ...(config.gasStationUrl && { baseUrl: config.gasStationUrl }),
              }),
            ),
          }
        : undefined;

    const aptosConfig = new AptosConfig({
      network: config.network,
      fullnode: config.fullnodeUrl,
      clientConfig: config.additionalHeaders
        ? { HEADERS: config.additionalHeaders }
        : { API_KEY: opts?.nodeApiKey },
      pluginSettings,
      // ts-sdk v7's DEFAULT_MAX_GAS_AMOUNT jumped to 2_000_000, which the
      // Geomi gas station rejects (cap is 250_000). Override so every code
      // path through the SDK falls back to a gas-station-friendly value.
      transactionGenerationConfig: {
        defaultMaxGasAmount: GAS_STATION_MAX_GAS_AMOUNT,
      },
    });

    this.aptos = new Aptos(aptosConfig);
    this.skipSimulate = opts?.skipSimulate ?? false;
    this.chainId = config.chainId;
    this.gasPriceManager = opts?.gasPriceManager;
    this.timeDeltaMs = opts?.timeDeltaMs ?? 0;
    this.onTransactionSettled = opts?.onTransactionSettled;
  }

  private getABI(functionId: MoveFunctionId): MoveFunction | null {
    return this.abi?.abis[functionId] ?? null;
  }

  // Whether the connected fullnode exposes an `encryption_key`. On probe failure
  // we log, uncache, and resolve "failed" — so a transient ledger-info blip
  // degrades safely for the current submission while the next call retries.
  private nodeSupportsEncryption(): Promise<ProbeState> {
    if (!this.nodeSupportsEncryptionPromise) {
      const safe = this.aptos
        .getLedgerInfo()
        .then((info): ProbeState => (info.encryption_key ? "supported" : "unsupported"))
        .catch((err: unknown): ProbeState => {
          console.warn("[decibel-sdk] encryption-support probe failed:", err);
          // Identity-guard so a slow rejection can't clobber a fresh probe
          // that started after this one's cache entry was overwritten.
          if (this.nodeSupportsEncryptionPromise === safe) {
            this.nodeSupportsEncryptionPromise = undefined;
          }
          return "failed";
        });
      this.nodeSupportsEncryptionPromise = safe;
    }
    return this.nodeSupportsEncryptionPromise;
  }

  // Single source of truth for "may we encrypt the next transaction?". Two gates:
  //   1. a gas station, if active, must have a known fee-payer address
  //      (`configSupportsEncryptedSubmission`), and
  //   2. the fullnode must expose an encryption key.
  // Resolves undefined when both pass, else the reason the caller falls back to
  // the plaintext path (which the gas-station plugin handles correctly).
  private async encryptionBlocker(): Promise<EncryptionFallbackReason | undefined> {
    if (!configSupportsEncryptedSubmission(this.config)) return "gas_station_unconfigured";
    const state = await this.nodeSupportsEncryption();
    if (state === "supported") return undefined;
    return state === "unsupported" ? "node_unsupported" : "probe_failed";
  }

  public async submitTx(
    transaction: SimpleTransaction,
    senderAuthenticator: AccountAuthenticator,
  ): Promise<PendingTransactionResponse> {
    // When gasStationApiKey is set, the GasStationTransactionSubmitter plugin
    // handles fee payer signing automatically. Otherwise, submits directly (self-pay).
    return await this.aptos.transaction.submit.simple({
      transaction,
      senderAuthenticator,
    });
  }

  public async buildTx(
    {
      maxGasAmount,
      gasUnitPrice,
      ...payload
    }: InputGenerateTransactionPayloadData & { maxGasAmount?: number; gasUnitPrice?: number },
    sender: AccountAddress,
  ) {
    const functionAbi = "function" in payload ? this.getABI(payload.function) : undefined;
    const withFeePayer = this.useGasStation;

    const replayProtectionNonce = generateRandomReplayProtectionNonce();

    // This should never happen, but just in case
    if (!replayProtectionNonce) {
      throw new Error("Unable to generate replayProtectionNonce");
    }

    let transaction: SimpleTransaction;

    if (functionAbi && this.chainId) {
      // If we have functionAbi and chainId, we can use the sync function to generate the transaction
      // This is faster than the async function
      if (gasUnitPrice === undefined && this.gasPriceManager) {
        // 1. Try getting from cache
        // 2. If not available, try fetching from gasmanager, this also sets the gas price in the cache for future use
        gasUnitPrice =
          this.gasPriceManager.getGasPrice() ?? (await this.gasPriceManager.fetchAndSetGasPrice());
      } else {
        // 1. Fetch from network, this is a fallback, should only happen if gasPriceManager is not set
        gasUnitPrice = (await this.aptos.getGasPriceEstimation()).gas_estimate;
      }

      transaction = buildSimpleTransactionSync({
        aptosConfig: this.aptos.config,
        sender,
        data: payload as InputEntryFunctionData,
        withFeePayer,
        replayProtectionNonce,
        abi: functionAbi,
        chainId: this.chainId,
        gasUnitPrice,
        timeDeltaMs: this.timeDeltaMs,
        maxGasAmount,
      });
    } else {
      // This is a fallback, should not happen, but works if due to any issues, functionAbi or chainId is not present
      // @Todo: Pass in Abi ideally, once we update aptos-ts-sdk to not refetch abi if abi is passed in payload
      transaction = await this.aptos.transaction.build.simple({
        sender,
        data: payload,
        withFeePayer,
        options: {
          replayProtectionNonce,
          maxGasAmount,
          gasUnitPrice,
        },
      });
    }

    return transaction;
  }

  // Build path for encrypted transactions. Diverges from `buildTx` because the
  // sync fast path uses AccountAddress.ZERO as a fee-payer placeholder, which
  // can't be mixed into the encrypted payload's AEAD associated data — the
  // literal fee-payer address must be known at build time. A gas station is
  // therefore usable for encryption only when both `gasStationApiKey` and
  // `gasStationAddress` are configured; `encryptionBlocker` enforces that, so by the
  // time we get here the txn is sponsored when a gas station is active and
  // sender-paid otherwise.
  private async buildEncryptedTx(
    payload: InputGenerateTransactionPayloadData,
    sender: AccountAddress,
  ) {
    const replayProtectionNonce = generateRandomReplayProtectionNonce();
    if (!replayProtectionNonce) {
      throw new Error("Unable to generate replayProtectionNonce");
    }
    const txnPayload = await generateTransactionPayload({
      aptosConfig: this.aptos.config,
      ...(payload as InputEntryFunctionData),
    });
    return await buildTransaction({
      aptosConfig: this.aptos.config,
      sender,
      payload: txnPayload,
      feePayerAddress: this.config.gasStationAddress
        ? AccountAddress.from(this.config.gasStationAddress)
        : undefined,
      options: {
        encrypted: true,
        replayProtectionNonce,
        gasUnitPrice: MIN_ENCRYPTED_TXN_GAS_UNIT_PRICE,
      },
    });
  }

  private async signAndSubmit(
    signer: Account,
    transaction: SimpleTransaction,
    ctx: SettleContext,
  ): Promise<CommittedTransactionResponse> {
    try {
      const senderAuthenticator = this.aptos.transaction.sign({ signer, transaction });
      const committed = await submitAndWaitForTransaction(this.aptos, () =>
        this.submitTx(transaction, senderAuthenticator),
      );
      this.emitTransactionSettled(ctx, { response: committed });
      return committed;
    } catch (err) {
      const error =
        err instanceof TransactionSubmissionError
          ? err
          : new TransactionSubmissionError(errorToMessage(err), { outcome: "not-submitted" }, err);
      this.emitTransactionSettled(ctx, { error });
      throw error;
    }
  }

  // Wrap a pre-submit failure, report it, and hand it back for the caller to throw.
  private notSubmitted(ctx: SettleContext, cause: unknown): TransactionSubmissionError {
    const error = new TransactionSubmissionError(
      errorToMessage(cause),
      { outcome: "not-submitted" },
      cause,
    );
    this.emitTransactionSettled(ctx, { error });
    return error;
  }

  // Fire the optional telemetry callback. Never throws into the submit path:
  // analytics must not be able to break a transaction.
  private emitTransactionSettled(
    ctx: SettleContext,
    result: { response?: CommittedTransactionResponse; error?: unknown },
  ): void {
    if (!this.onTransactionSettled) return;
    try {
      const r = result.response as
        | (CommittedTransactionResponse & {
            success?: boolean;
            hash?: string;
            gas_used?: string;
            gas_unit_price?: string;
            vm_status?: string;
          })
        | undefined;
      const failure = getTransactionSubmissionFailure(result.error);
      this.onTransactionSettled({
        encrypted: ctx.encrypted,
        encryptionRequested: ctx.encryptionRequested,
        fallbackReason: ctx.fallbackReason,
        success: result.error ? false : (r?.success ?? false),
        outcome: failure?.outcome,
        durationMs: Date.now() - ctx.start,
        hash: r?.hash ?? failure?.transactionHash,
        functionId: ctx.functionId,
        txKind: classifyTxKind(ctx.functionId),
        gasUsed: r?.gas_used !== undefined ? Number(r.gas_used) : undefined,
        gasUnitPrice: r?.gas_unit_price !== undefined ? Number(r.gas_unit_price) : undefined,
        vmStatus: r?.vm_status,
        error: result.error === undefined ? undefined : errorToMessage(result.error),
      });
    } catch {
      // Swallow — telemetry is best-effort.
    }
  }

  private extractFunctionId(payload: InputGenerateTransactionPayloadData): string | undefined {
    return "function" in payload ? payload.function : undefined;
  }

  protected async sendTx(payload: InputGenerateTransactionPayloadData, opts: SendTxOpts = {}) {
    return this.sendTxInternal(payload, opts, {
      encrypted: false,
      encryptionRequested: false,
      functionId: this.extractFunctionId(payload),
      start: Date.now(),
    });
  }

  private async sendTxInternal(
    payload: InputGenerateTransactionPayloadData,
    { accountOverride }: SendTxOpts,
    ctx: SettleContext,
  ) {
    const signer = accountOverride ?? this.account;
    const sender = signer.accountAddress;

    let transaction: SimpleTransaction;
    try {
      transaction = await this.buildTx(payload, sender);

      if (!this.skipSimulate) {
        const [sim] = await this.aptos.transaction.simulate.simple({
          transaction,
          options: {
            estimateMaxGasAmount: true,
            estimateGasUnitPrice: true,
          },
        });

        if (typeof sim === "undefined") {
          throw new Error("Transaction simulation returned no results");
        }

        if (!sim.max_gas_amount || !sim.gas_unit_price) {
          throw new Error("Transaction simulation returned no results");
        }

        const simulatedMaxGas = Number(sim.max_gas_amount);
        const simulatedGasPrice = Number(sim.gas_unit_price);
        const defaultMaxGasAmount = this.aptos.config.getDefaultMaxGasAmount();

        // 2x buffer over simulation with the default as a floor, then clamped to
        // the gas-station ceiling when sponsored (see resolveMaxGasAmount).
        const maxGasAmount = resolveMaxGasAmount({
          simulatedMaxGas,
          defaultMaxGasAmount,
          useGasStation: this.useGasStation,
        });

        const gasUnitPrice = Math.max(simulatedGasPrice, 1);

        transaction = await this.buildTx({ ...payload, maxGasAmount, gasUnitPrice }, sender);
      }
    } catch (error) {
      throw this.notSubmitted(ctx, error);
    }
    return this.signAndSubmit(signer, transaction, ctx);
  }

  // Submit a front-run-sensitive transaction. Falls back to plain unencrypted
  // submission with simulation when `encryptionBlocker` reports a reason.
  // Whether the encrypted txn is sponsored or sender-paid is decided by
  // `buildEncryptedTx` based on whether a gas station is configured. Simulation
  // is skipped on the encrypted path because the payload is opaque to
  // `simulate.simple`; the build-side gas-price floor covers the minimum.
  protected async sendEncryptedTx(
    payload: InputGenerateTransactionPayloadData,
    { accountOverride }: SendTxOpts = {},
  ) {
    const ctx: SettleContext = {
      encrypted: false,
      encryptionRequested: true,
      functionId: this.extractFunctionId(payload),
      start: Date.now(),
    };
    const fallbackReason = await this.encryptionBlocker();
    if (fallbackReason) {
      return this.sendTxInternal(payload, { accountOverride }, { ...ctx, fallbackReason });
    }
    const encryptedCtx: SettleContext = { ...ctx, encrypted: true };
    const signer = accountOverride ?? this.account;
    let transaction: SimpleTransaction;
    try {
      transaction = await this.buildEncryptedTx(payload, signer.accountAddress);
    } catch (error) {
      throw this.notSubmitted(encryptedCtx, error);
    }
    return this.signAndSubmit(signer, transaction, encryptedCtx);
  }

  public getPrimarySubaccountAddress(addr: AccountAddress | string) {
    return getPrimarySubaccountAddr(
      addr,
      this.config.compatVersion,
      this.config.deployment.package,
    );
  }
}
