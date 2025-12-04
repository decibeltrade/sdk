import { Aptos, AptosConfig } from "@aptos-labs/ts-sdk";

import { DecibelConfig } from "../constants";

export interface GasPriceInfo {
  gasEstimate: number;
  timestamp: number;
}

export interface GasPriceManagerOptions {
  nodeApiKey?: string;
  multiplier: number;
  refreshIntervalMs: number;
}

export class GasPriceManager {
  private gasPrice: GasPriceInfo | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly aptos: Aptos;
  private readonly refreshIntervalMs: number;
  private isInitialized = false;
  private readonly multiplier: number;

  constructor(config: DecibelConfig, opts?: GasPriceManagerOptions) {
    this.aptos = new Aptos(
      new AptosConfig({
        network: config.network,
        fullnode: config.fullnodeUrl,
        clientConfig: { API_KEY: opts?.nodeApiKey },
      }),
    );
    this.refreshIntervalMs = opts?.refreshIntervalMs ?? 60_000; // default to 1 minute
    this.multiplier = opts?.multiplier ?? 2; // default to 2x multilier to ensure we have enough gas for the transactipon
  }

  getGasPrice(): number | undefined {
    const estimatedGasPrice = this.gasPrice?.gasEstimate;
    if (!estimatedGasPrice) {
      return undefined;
    }
    return estimatedGasPrice;
  }

  /**
   * Initialize the gas price manager and start fetching gas prices
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      // Fetch initial gas price
      await this.fetchAndSetGasPrice();

      // Set up interval to refresh gas price
      this.intervalId = setInterval(async () => {
        try {
          await this.fetchAndSetGasPrice();
        } catch (error) {
          console.warn("Failed to fetch gas price:", error);
        }
      }, this.refreshIntervalMs);

      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize gas price manager:", error);
    }
  }

  refresh() {
    void this.fetchAndSetGasPrice();
  }

  /**
   * Stop the gas price manager and clear the interval
   */
  destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isInitialized = false;
    this.gasPrice = null; // Clear cached data
  }

  async fetchGasPriceEstimation(): Promise<number> {
    return this.aptos.getGasPriceEstimation().then((gasEstimation) => {
      return gasEstimation.gas_estimate * this.multiplier; // Multiplier is applied here to ensure we have enough gas for the transaction
    });
  }

  /**
   * Fetch gas price from the network
   */
  async fetchAndSetGasPrice(): Promise<number> {
    try {
      const gasEstimate = await this.fetchGasPriceEstimation();

      if (!gasEstimate) {
        throw new Error("Gas estimation returned no gas estimate");
      }

      this.gasPrice = {
        gasEstimate,
        timestamp: Date.now(),
      };

      return gasEstimate;
    } catch (error) {
      console.error("Failed to fetch gas price:", error);
      throw error;
    }
  }
}
