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
import netnaAbis from "./abi/json/netna.json";
import testnetAbis from "./abi/json/testnet.json";
import { ABIData } from "./abi/types";
import {
  DecibelConfig,
  GAS_STATION_MAX_GAS_AMOUNT,
  MAINNET_CONFIG,
  NETNA_CONFIG,
  TESTNET_CONFIG,
} from "./constants";
import { GasPriceManager } from "./gas/gas-price-manager";
import { resolveMaxGasAmount } from "./gas/resolve-max-gas-amount";
import { buildSimpleTransactionSync } from "./transaction-builder";
import { generateRandomReplayProtectionNonce, getPrimarySubaccountAddr } from "./utils";

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
   * Optional telemetry callback invoked once per submitted transaction, after
   * it commits (or throws). Lets a host app record gas, latency, and
   * success-rate metrics split by encrypted vs unencrypted, without coupling
   * the SDK to any analytics provider. Never throws into the submit path —
   * callback errors are swallowed.
   */
  onTransactionSettled?: (metrics: TransactionSettledMetrics) => void;
}

/** Per-transaction telemetry passed to `Options.onTransactionSettled`. */
export interface TransactionSettledMetrics {
  /** Whether the transaction was actually submitted encrypted (false on fallback). */
  encrypted: boolean;
  /** On-chain success flag. False when the submission threw before/at commit. */
  success: boolean;
  /** Wall-clock milliseconds for sign + submit + wait-for-commit. */
  durationMs: number;
  /** On-chain transaction hash, when the submission reached commit. */
  hash?: string;
  /** Entry-function id, when the payload exposed one. */
  functionId?: string;
  gasUsed?: number;
  gasUnitPrice?: number;
  /** On-chain `vm_status`, when available. */
  vmStatus?: string;
  /** Error message when the submission threw. */
  error?: string;
}

/** Submission-time concerns shared by every write call. */
export interface SendTxOpts {
  accountOverride?: Account;
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

const chainIdToAbi: Record<number, ABIData> = {};
if (NETNA_CONFIG.chainId) chainIdToAbi[NETNA_CONFIG.chainId] = netnaAbis as ABIData;
if (TESTNET_CONFIG.chainId) chainIdToAbi[TESTNET_CONFIG.chainId] = testnetAbis as ABIData;
if (MAINNET_CONFIG.chainId) chainIdToAbi[MAINNET_CONFIG.chainId] = mainnetAbis as ABIData;

export class BaseSDK {
  readonly aptos: Aptos;
  readonly skipSimulate: boolean;
  private readonly useGasStation: boolean;
  private readonly chainId: number | undefined;
  private readonly abi = netnaAbis as ABIData;
  private readonly gasPriceManager: GasPriceManager | undefined;
  private readonly onTransactionSettled: Options["onTransactionSettled"];
  // Memoized probe result. We cache the Promise (not the boolean) so concurrent
  // first-time callers share a single getLedgerInfo round-trip. A successful
  // result is kept for the SDK's lifetime; a rejected probe is uncached so the
  // next call retries instead of stranding the SDK in unencrypted mode.
  private nodeSupportsEncryptionPromise: Promise<boolean> | undefined;
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
    const abi = config.chainId ? chainIdToAbi[config.chainId] : null;
    if (abi) {
      this.abi = abi;
    } else {
      this.abi = netnaAbis as ABIData;
      console.warn(
        "Using NETNA ABI for unsupported chain id, this might cause issues with the transaction builder",
      );
    }

    this.useGasStation = !!config.gasStationApiKey;

    const pluginSettings =
      this.useGasStation && config.gasStationApiKey
        ? {
            TRANSACTION_SUBMITTER: new GasStationTransactionSubmitter(
              new GasStationClient({
                network: config.network,
                apiKey: config.gasStationApiKey,
                // Use gasStationUrl as base URL for custom networks like netna
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
    return this.abi.abis[functionId] ?? null;
  }

  // Returns whether the connected fullnode exposes an `encryption_key` (i.e.
  // supports encrypted transactions). On probe failure we log, uncache, and
  // return false — so a transient ledger-info blip degrades safely for the
  // current submission while the next call retries fresh.
  private nodeSupportsEncryption(): Promise<boolean> {
    if (!this.nodeSupportsEncryptionPromise) {
      const safe = this.aptos
        .getLedgerInfo()
        .then((info) => !!info.encryption_key)
        .catch((err: unknown) => {
          console.warn("[decibel-sdk] encryption-support probe failed:", err);
          // Identity-guard so a slow rejection can't clobber a fresh probe
          // that started after this one's cache entry was overwritten.
          if (this.nodeSupportsEncryptionPromise === safe) {
            this.nodeSupportsEncryptionPromise = undefined;
          }
          return false;
        });
      this.nodeSupportsEncryptionPromise = safe;
    }
    return this.nodeSupportsEncryptionPromise;
  }

  // Single source of truth for "may we encrypt the next transaction?". Two gates:
  //   1. the fullnode must expose an encryption key, and
  //   2. a gas station, if active, must have a known fee-payer address.
  // Unlike `buildTx` (which uses AccountAddress.ZERO as a fee-payer placeholder
  // and lets the gas-station plugin fill it in at submit), an encrypted txn must
  // bake the literal fee-payer address into its AEAD associated data at build
  // time. So when a gas station is active but `gasStationAddress` is unset, we
  // can't build a properly-sponsored encrypted txn — return false and let the
  // caller fall back to the plaintext path, which the plugin handles correctly.
  private async canEncrypt(): Promise<boolean> {
    if (this.useGasStation && !this.config.gasStationAddress) return false;
    return this.nodeSupportsEncryption();
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
  // `gasStationAddress` are configured; `canEncrypt` enforces that, so by the
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
    telemetry: { encrypted: boolean; functionId?: string },
  ): Promise<CommittedTransactionResponse> {
    const start = Date.now();
    try {
      const senderAuthenticator = this.aptos.transaction.sign({ signer, transaction });
      const pendingTransaction = await this.submitTx(transaction, senderAuthenticator);
      const committed = await this.aptos.waitForTransaction({
        transactionHash: pendingTransaction.hash,
      });
      this.emitTransactionSettled({
        ...telemetry,
        response: committed,
        durationMs: Date.now() - start,
      });
      return committed;
    } catch (err) {
      this.emitTransactionSettled({ ...telemetry, error: err, durationMs: Date.now() - start });
      throw err;
    }
  }

  // Fire the optional telemetry callback. Never throws into the submit path:
  // analytics must not be able to break a transaction.
  private emitTransactionSettled(args: {
    encrypted: boolean;
    functionId?: string;
    durationMs: number;
    response?: CommittedTransactionResponse;
    error?: unknown;
  }): void {
    if (!this.onTransactionSettled) return;
    try {
      const r = args.response as
        | (CommittedTransactionResponse & {
            success?: boolean;
            hash?: string;
            gas_used?: string;
            gas_unit_price?: string;
            vm_status?: string;
          })
        | undefined;
      this.onTransactionSettled({
        encrypted: args.encrypted,
        success: args.error ? false : (r?.success ?? false),
        durationMs: args.durationMs,
        hash: r?.hash,
        functionId: args.functionId,
        gasUsed: r?.gas_used !== undefined ? Number(r.gas_used) : undefined,
        gasUnitPrice: r?.gas_unit_price !== undefined ? Number(r.gas_unit_price) : undefined,
        vmStatus: r?.vm_status,
        error: args.error === undefined ? undefined : errorToMessage(args.error),
      });
    } catch {
      // Swallow — telemetry is best-effort.
    }
  }

  private extractFunctionId(payload: InputGenerateTransactionPayloadData): string | undefined {
    return "function" in payload ? payload.function : undefined;
  }

  protected async sendTx(
    payload: InputGenerateTransactionPayloadData,
    { accountOverride }: SendTxOpts = {},
  ) {
    const signer = accountOverride ?? this.account;
    const sender = signer.accountAddress;

    let transaction = await this.buildTx(payload, sender);

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

    return this.signAndSubmit(signer, transaction, {
      encrypted: false,
      functionId: this.extractFunctionId(payload),
    });
  }

  // Submit a front-run-sensitive transaction. Falls back to `sendTx` (plain
  // unencrypted submission with simulation) only when the fullnode doesn't
  // expose an encryption key. Whether the encrypted txn is sponsored or
  // sender-paid is decided by `buildEncryptedTx` based on whether a gas
  // station is configured. Simulation is skipped on the encrypted path because
  // the payload is opaque to `simulate.simple`; the build-side gas-price floor
  // covers the minimum.
  protected async sendEncryptedTx(
    payload: InputGenerateTransactionPayloadData,
    { accountOverride }: SendTxOpts = {},
  ) {
    if (!(await this.canEncrypt())) {
      return this.sendTx(payload, { accountOverride });
    }
    const signer = accountOverride ?? this.account;
    const transaction = await this.buildEncryptedTx(payload, signer.accountAddress);
    return this.signAndSubmit(signer, transaction, {
      encrypted: true,
      functionId: this.extractFunctionId(payload),
    });
  }

  public getPrimarySubaccountAddress(addr: AccountAddress | string) {
    return getPrimarySubaccountAddr(
      addr,
      this.config.compatVersion,
      this.config.deployment.package,
    );
  }
}
