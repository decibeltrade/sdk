import {
  Account,
  AccountAddress,
  AccountAuthenticator,
  Aptos,
  AptosConfig,
  InputEntryFunctionData,
  InputGenerateTransactionPayloadData,
  MoveFunction,
  MoveFunctionId,
  PendingTransactionResponse,
  SimpleTransaction,
} from "@aptos-labs/ts-sdk";

import netnaAbis from "./abi/json/netna.json";
import testnetAbis from "./abi/json/testnet.json";
import { ABIData } from "./abi/types";
import { DecibelConfig, NETNA_CONFIG, TESTNET_CONFIG } from "./constants";
import { submitFeePaidTransaction } from "./fee-pay";
import { GasPriceManager } from "./gas/gas-price-manager";
import { buildSimpleTransactionSync } from "./transaction-builder";
import { generateRandomReplayProtectionNonce } from "./utils";

export interface Options {
  skipSimulate?: boolean;
  noFeePayer?: boolean;
  nodeApiKey?: string;
  gasPriceManager?: GasPriceManager;
  /**
   * Time delta in milliseconds to add to Date.now() for expiration timestamps.
   * Used to sync with server time when client clock is incorrect.
   */
  timeDeltaMs?: number;
}

const chainIdToAbi: Record<number, ABIData> = {};
if (NETNA_CONFIG.chainId) chainIdToAbi[NETNA_CONFIG.chainId] = netnaAbis as ABIData;
if (TESTNET_CONFIG.chainId) chainIdToAbi[TESTNET_CONFIG.chainId] = testnetAbis as ABIData;

export class BaseSDK {
  readonly aptos: Aptos;
  readonly skipSimulate: boolean;
  readonly noFeePayer: boolean;
  private readonly chainId: number | undefined;
  private readonly abi = netnaAbis as ABIData;
  private readonly gasPriceManager: GasPriceManager | undefined;
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

    const aptosConfig = new AptosConfig({
      network: config.network,
      fullnode: config.fullnodeUrl,
      clientConfig: { API_KEY: opts?.nodeApiKey },
    });
    this.aptos = new Aptos(aptosConfig);
    this.skipSimulate = opts?.skipSimulate ?? false;
    this.noFeePayer = opts?.noFeePayer ?? false;
    this.chainId = config.chainId;
    this.gasPriceManager = opts?.gasPriceManager;
    this.timeDeltaMs = opts?.timeDeltaMs ?? 0;
  }

  private getABI(functionId: MoveFunctionId): MoveFunction | null {
    return this.abi.abis[functionId] ?? null;
  }

  private async getSimulatedTx(
    payload: InputGenerateTransactionPayloadData,
    sender: AccountAddress,
  ) {
    const transaction = await this.aptos.transaction.build.simple({
      sender,
      data: payload,
    });
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

    return await this.aptos.transaction.build.simple({
      sender,
      data: payload,
      options: {
        maxGasAmount: Number(sim.max_gas_amount),
        gasUnitPrice: Number(sim.gas_unit_price),
      },
    });
  }

  public async submitTx(
    transaction: SimpleTransaction,
    senderAuthenticator: AccountAuthenticator,
  ): Promise<PendingTransactionResponse> {
    if (this.noFeePayer) {
      return await this.aptos.transaction.submit.simple({
        transaction,
        senderAuthenticator,
      });
    } else {
      return await submitFeePaidTransaction(this.config, transaction, senderAuthenticator);
    }
  }

  public async buildTx(payload: InputGenerateTransactionPayloadData, sender: AccountAddress) {
    const functionAbi = "function" in payload ? this.getABI(payload.function) : undefined;
    const withFeePayer = !this.noFeePayer;

    const replayProtectionNonce = generateRandomReplayProtectionNonce();

    // This should never happen, but just in case
    if (!replayProtectionNonce) {
      throw new Error("Unable to generate replayProtectionNonce");
    }

    let transaction: SimpleTransaction;

    // If we have functionAbi and chainId, we can use the sync function to generate the transaction
    // This is faster than the async function
    if (functionAbi && this.chainId) {
      let gasUnitPrice: number;

      if (this.gasPriceManager) {
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
        },
      });
    }

    return transaction;
  }

  protected async sendTx(payload: InputGenerateTransactionPayloadData, accountOverride?: Account) {
    const signer = accountOverride ?? this.account;
    const sender = signer.accountAddress;
    if (!this.skipSimulate) {
      const transaction = await this.getSimulatedTx(payload, sender);
      const senderAuthenticator = this.aptos.transaction.sign({
        signer,
        transaction,
      });
      const pendingTransaction = await this.submitTx(transaction, senderAuthenticator);
      return await this.aptos.waitForTransaction({
        transactionHash: pendingTransaction.hash,
      });
    } else {
      const transaction = await this.buildTx(payload, sender);

      const senderAuthenticator = this.aptos.transaction.sign({
        signer,
        transaction,
      });

      const pendingTransaction = await this.submitTx(transaction, senderAuthenticator);

      return await this.aptos.waitForTransaction({
        transactionHash: pendingTransaction.hash,
      });
    }
  }
}
