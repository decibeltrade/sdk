# @decibeltrade/sdk

TypeScript SDK for interacting with Decibel, a fully on-chain trading engine built on Aptos.

**📚 [View Full Documentation →](https://docs.decibel.trade)**

## Overview

The Decibel TypeScript SDK provides a clean, typed interface to interact with Decibel on Aptos:

- **Read operations** (`DecibelReadDex`) — Query markets, depth, prices, trades, positions, orders, subaccounts, vaults
- **Write operations** (`DecibelWriteDex`) — Place/cancel orders, manage positions and subaccounts, vault operations, delegation

## Installation

```bash
npm install @decibeltrade/sdk @aptos-labs/ts-sdk zod
```

```bash
yarn add @decibeltrade/sdk @aptos-labs/ts-sdk zod
```

```bash
pnpm add @decibeltrade/sdk @aptos-labs/ts-sdk zod
```

For TypeScript in Node.js environments, you may also want:

```bash
npm install -D @types/ws
```

## Quick Start

### Read: Market and Account Data

```typescript
import { DecibelReadDex, NETNA_CONFIG } from "@decibeltrade/sdk";

const read = new DecibelReadDex(NETNA_CONFIG, {
  nodeApiKey: process.env.APTOS_NODE_API_KEY, // required
  onWsError: (error) => console.error("WebSocket error:", error), // optional
});

// Get all markets
const markets = await read.markets.getAll();

// Get account overview
const account = await read.accountOverview.getByAddr("0x...account");

// Get market prices
const prices = await read.marketPrices.getAll();

// Get order book depth
const depth = await read.marketDepth.getBySymbol("BTC-PERP", { depth: 10 });
```

### Write: Submit Transactions

```typescript
import { DecibelWriteDex, NETNA_CONFIG } from "@decibeltrade/sdk";
import { Ed25519Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const account = new Ed25519Account({
  privateKey: new Ed25519PrivateKey(process.env.PRIVATE_KEY!),
});

const write = new DecibelWriteDex(NETNA_CONFIG, account, {
  nodeApiKey: process.env.APTOS_NODE_API_KEY, // optional
});

// Place an order
const order = await write.placeOrder({
  subaccountAddr: "0x...",
  marketAddr: "0x...",
  price: 5670000000, // 5.67 with 9 decimals
  size: 1000000000, // 1.0 with 9 decimals
  isBuy: true,
  timeInForce: 0, // GoodTillCanceled
});
```

## Documentation

### Getting Started

- [SDK Overview](https://docs.decibel.trade/typescript-sdk/overview) - Introduction to the TypeScript SDK
- [Installation](https://docs.decibel.trade/typescript-sdk/installation) - Install and configure the SDK
- [Configuration](https://docs.decibel.trade/typescript-sdk/configuration) - Network configuration and presets

### Read SDK

- [Read SDK Guide](https://docs.decibel.trade/typescript-sdk/read-sdk) - Query market data and account information
  - Market data (prices, depth, trades, candlesticks)
  - Account overview and positions
  - Order history and open orders
  - Subaccounts and delegations
  - Vault information

### Write SDK

- [Write SDK Guide](https://docs.decibel.trade/typescript-sdk/write-sdk) - Build and submit transactions
  - Place and cancel orders
  - TWAP and bulk orders
  - Position management (TP/SL)
  - Subaccount management
  - Vault operations
  - Delegation

### Advanced

- [Advanced Usage](https://docs.decibel.trade/typescript-sdk/advanced) - Advanced SDK features and patterns

## Configuration

The SDK supports multiple network configurations:

```typescript
import { NETNA_CONFIG, TESTNET_CONFIG, LOCAL_CONFIG, DOCKER_CONFIG } from "@decibeltrade/sdk";

// Netna (devnet)
const read = new DecibelReadDex(NETNA_CONFIG);

// Testnet
const read = new DecibelReadDex(TESTNET_CONFIG);

// Local development
const read = new DecibelReadDex(LOCAL_CONFIG);

// Docker environment
const read = new DecibelReadDex(DOCKER_CONFIG);
```

### Custom Configuration

```typescript
import { DecibelConfig } from "@decibeltrade/sdk";
import { Network } from "@aptos-labs/ts-sdk";

const customConfig: DecibelConfig = {
  network: Network.CUSTOM,
  fullnodeUrl: "https://api.testnet.aptoslabs.com/v1",
  tradingHttpUrl: "https://api.testnet.aptoslabs.com/decibel",
  tradingWsUrl: "wss://api.testnet.aptoslabs.com/decibel/ws",
  gasStationUrl: "https://your-fee-payer.com",
  deployment: {
    package: "0x...",
    usdc: "0x...",
    testc: "0x...",
    perpEngineGlobal: "0x...",
  },
};
```

## When to Use Which

- **Use `DecibelReadDex`** when you need market data, order/position history, or account state. No private keys required.
- **Use `DecibelWriteDex`** for on-chain actions and trading. In browsers, avoid embedding private keys — prefer session keys or a wallet and pass `accountOverride` for specific calls.

## Read Operations API

### DecibelReadDex

The main read client providing access to all market data and account information.

#### Constructor

```typescript
new DecibelReadDex(config: DecibelConfig, opts?: {
  nodeApiKey?: string;
  onWsError?: (error: ErrorEvent) => void;
})
```

#### Global Methods

```typescript
// Get global perpetual engine state
await readDex.globalPerpEngineState();

// Get collateral balance decimals
await readDex.collateralBalanceDecimals();

// Get USDC decimals (cached)
await readDex.usdcDecimals();

// Get USDC balance for an address
await readDex.usdcBalance("0x123...");

// Get account balance
await readDex.accountBalance("0x123...");

// Get position size
await readDex.positionSize("0x123...", "metadata_address");

// Get crossed position
await readDex.getCrossedPosition("0x123...");
```

### Markets

Access market information and configuration.

```typescript
// Get all available markets
const markets = await readDex.markets.getAll();

// Get specific market by name
const market = await readDex.markets.getByName("BTC-USD");

// Get market by symbol
const market = await readDex.markets.getBySymbol("BTC-PERP");

// List all market addresses
const addresses = await readDex.markets.listMarketAddresses();

// Get market name by address
const name = await readDex.markets.marketNameByAddress("0x123...");
```

### Account Overview

Get comprehensive account information including balances and positions.

```typescript
// Get account overview
const overview = await readDex.accountOverview.getByAddr("subaccount_address", "30d"); // volume_window = "30d"

// Subscribe to real-time account updates
const unsubscribe = readDex.accountOverview.subscribeByAddr("subaccount_address", (data) =>
  console.log("Account update:", data),
);

// Later, unsubscribe
unsubscribe();
```

### User Positions

Query user positions across markets.

```typescript
// Get all positions for a user
const positions = await readDex.userPositions.getByAddr({
  subAddr: "subaccount_address",
  includeDeleted: false,
  limit: 10,
});

// Get positions for specific market
const marketPositions = await readDex.userPositions.getByAddr({
  subAddr: "subaccount_address",
  marketAddr: "market_address",
  limit: 10,
});

// Subscribe to position updates
const unsubscribe = readDex.userPositions.subscribeByAddr("subaccount_address", (data) =>
  console.log("Position update:", data),
);
```

### User Orders

Query open orders and order history.

#### Open Orders

```typescript
// Get open orders
const openOrders = await readDex.userOpenOrders.getByAddr("subaccount_address");

// Subscribe to open orders updates
const unsubscribe = readDex.userOpenOrders.subscribeByAddr("subaccount_address", (data) =>
  console.log("Orders update:", data),
);
```

#### Order History

```typescript
// Get order history
const orderHistory = await readDex.userOrderHistory.getByAddr({
  subAddr: "subaccount_address",
  marketAddr: "market_address", // optional
  limit: 50,
});

// Subscribe to order history updates
const unsubscribe = readDex.userOrderHistory.subscribeByAddr("subaccount_address", (data) =>
  console.log("Order history update:", data),
);
```

### Market Data

#### Market Depth (Order Book)

```typescript
// Get market depth
const depth = await readDex.marketDepth.getByName("BTC-USD", 100); // limit = 100
const depth = await readDex.marketDepth.getBySymbol("BTC-PERP", { depth: 100 });

// Subscribe to depth updates
const unsubscribe = readDex.marketDepth.subscribeByName("BTC-USD", (data) =>
  console.log("Depth update:", data),
);

// Reset subscription (clear cached data)
readDex.marketDepth.resetSubscriptionByName("BTC-USD");
```

#### Market Prices

```typescript
// Get current prices
const prices = await readDex.marketPrices.getByName("BTC-USD");
const prices = await readDex.marketPrices.getAll();

// Subscribe to price updates
const unsubscribe = readDex.marketPrices.subscribeByName("BTC-USD", (data) =>
  console.log("Price update:", data),
);
```

#### Market Trades

```typescript
// Get recent trades
const trades = await readDex.marketTrades.getByName("BTC-USD", 50); // limit = 50

// Subscribe to trade updates
const unsubscribe = readDex.marketTrades.subscribeByName("BTC-USD", (data) =>
  console.log("Trade update:", data),
);
```

#### Candlesticks

```typescript
import { CandlestickInterval } from "@decibeltrade/sdk";

// Get historical candlestick data
const candlesticks = await readDex.candlesticks.getByName(
  "BTC-USD",
  CandlestickInterval.MINUTE_1,
  startTimestamp,
  endTimestamp,
);

// Subscribe to candlestick updates
const unsubscribe = readDex.candlesticks.subscribeByName(
  "BTC-USD",
  CandlestickInterval.MINUTE_1,
  (data) => console.log("Candlestick update:", data),
);
```

### Market Contexts

Get additional market metadata and context.

```typescript
// Get market contexts
const contexts = await readDex.marketContexts.getAll();

// Subscribe to market context updates
const unsubscribe = readDex.marketContexts.subscribeAll((data) =>
  console.log("Market contexts update:", data),
);
```

### User Trade History

Query historical trade data for a user.

```typescript
// Get trade history
const trades = await readDex.userTradeHistory.getByAddr({
  subAddr: "subaccount_address",
  marketAddr: "market_address", // optional
  limit: 100,
});

// Subscribe to trade history updates
const unsubscribe = readDex.userTradeHistory.subscribeByAddr("subaccount_address", (data) =>
  console.log("Trade history update:", data),
);
```

### User Funding History

Query funding payment history.

```typescript
// Get funding history
const funding = await readDex.userFundingHistory.getByAddr({
  subAddr: "subaccount_address",
  marketAddr: "market_address", // optional
  limit: 50,
});

// Subscribe to funding history updates
const unsubscribe = readDex.userFundingHistory.subscribeByAddr("subaccount_address", (data) =>
  console.log("Funding history update:", data),
);
```

### User Subaccounts

```typescript
// Get all subaccounts for a user
const subaccounts = await readDex.userSubaccounts.getByAddr("account_address");
```

### Vaults

```typescript
// Get user vault positions
const userVaults = await readDex.userVaults.getByAddr("account_address");

// Get public vault information
const vaults = await readDex.vaults.getAll();
```

## Write Operations API

### DecibelWriteDex

The main write client for executing trades and managing account operations.

#### Constructor

```typescript
import { Ed25519Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const account = new Ed25519Account({
  privateKey: new Ed25519PrivateKey("your-private-key"),
});

const writeDex = new DecibelWriteDex(config, account, opts?: {
  nodeApiKey?: string;
  sponsorAccount?: Ed25519Account;
  maxGasAmount?: number;
  gasUnitPrice?: number;
});
```

### Account Management

#### Subaccount Operations

```typescript
// Create a new subaccount
await writeDex.createSubaccount();

// Deposit collateral to primary subaccount
await writeDex.deposit(1000000); // amount in smallest unit

// Deposit to specific subaccount
await writeDex.deposit(1000000, "subaccount_address");

// Withdraw from subaccount
await writeDex.withdraw(500000, "subaccount_address");
```

#### Trading Delegation

```typescript
// Delegate trading permissions
await writeDex.delegateTradingTo({
  subaccountAddr: "your_subaccount",
  accountToDelegateTo: "delegate_account_address",
});

// Revoke delegation
await writeDex.revokeDelegation({
  subaccountAddr: "your_subaccount",
  accountToRevoke: "delegate_account_address",
});
```

#### Market Configuration

```typescript
// Configure user settings for a market
await writeDex.configureUserSettingsForMarket({
  marketAddr: "market_address",
  subaccountAddr: "subaccount_address",
  isCross: true, // cross-margin mode
  userLeverage: 1000, // 10x leverage (basis points)
});
```

### Order Management

#### Place Orders

```typescript
import { TimeInForce } from "@decibeltrade/sdk";

// Place a limit order
const result = await writeDex.placeOrder({
  marketName: "BTC-USD",
  price: 45000,
  size: 1.5,
  isBuy: true,
  timeInForce: TimeInForce.GoodTillCanceled,
  isReduceOnly: false,
  clientOrderId: "12345", // optional
  subaccountAddr: "subaccount_address", // optional
});

// Place a post-only order
await writeDex.placeOrder({
  marketName: "ETH-USD",
  price: 3000,
  size: 2.0,
  isBuy: false,
  timeInForce: TimeInForce.PostOnly,
  isReduceOnly: false,
});

// Place an IOC (Immediate or Cancel) order
await writeDex.placeOrder({
  marketName: "SOL-USD",
  price: 100,
  size: 10,
  isBuy: true,
  timeInForce: TimeInForce.ImmediateOrCancel,
  isReduceOnly: true,
});
```

#### Advanced Order Types

```typescript
// Place order with stop-loss and take-profit
await writeDex.placeOrder({
  marketName: "BTC-USD",
  price: 45000,
  size: 1.0,
  isBuy: true,
  timeInForce: TimeInForce.GoodTillCanceled,
  isReduceOnly: false,
  stopPrice: 44000, // stop-loss trigger
  tpTriggerPrice: 46000, // take-profit trigger
  tpLimitPrice: 45900, // take-profit limit price
  slTriggerPrice: 44000, // stop-loss trigger
  slLimitPrice: 44100, // stop-loss limit price
});

// Place order with builder fee
await writeDex.placeOrder({
  marketName: "BTC-USD",
  price: 45000,
  size: 1.0,
  isBuy: true,
  timeInForce: TimeInForce.GoodTillCanceled,
  isReduceOnly: false,
  builderAddr: "builder_account_address",
  builderFee: 100, // fee in basis points
});
```

#### TWAP Orders

```typescript
// Place a Time-Weighted Average Price order
await writeDex.placeTwapOrder({
  marketName: "BTC-USD",
  size: 10.0,
  isBuy: true,
  isReduceOnly: false,
  twapFrequencySeconds: 60, // execute every 60 seconds
  twapDurationSeconds: 3600, // over 1 hour period
  subaccountAddr: "subaccount_address", // optional
});
```

#### Cancel Orders

```typescript
// Cancel order by ID and market name
await writeDex.cancelOrder({
  orderId: 12345,
  marketName: "BTC-USD",
  subaccountAddr: "subaccount_address", // optional
});

// Cancel order by ID and market address
await writeDex.cancelOrder({
  orderId: 12345,
  marketAddr: "market_address",
  subaccountAddr: "subaccount_address", // optional
});

// Cancel order by client order ID
await writeDex.cancelClientOrder({
  clientOrderId: "54321",
  marketName: "BTC-USD",
  subaccountAddr: "subaccount_address", // optional
});

// Cancel TWAP order
await writeDex.cancelTwapOrder({
  orderId: "twap_order_id",
  subaccountAddr: "subaccount_address", // optional
});

// Cancel bulk orders
await writeDex.cancelBulkOrder({
  orderIds: [12345, 12346, 12347],
  marketName: "BTC-USD",
  subaccountAddr: "subaccount_address", // optional
});
```

### Position Management

#### Take-Profit / Stop-Loss Orders

```typescript
// Place TP/SL order for existing position
await writeDex.placeTpSlOrderForPosition({
  marketAddr: "market_address",
  tpTriggerPrice: 46000,
  tpLimitPrice: 45900,
  tpSize: 0.5, // partial position size
  slTriggerPrice: 44000,
  slLimitPrice: 44100,
  slSize: 1.0, // full position size
  subaccountAddr: "subaccount_address", // optional
});

// Update existing TP/SL order
await writeDex.updateTpSlOrderForPosition({
  marketAddr: "market_address",
  prevOrderId: "previous_order_id",
  tpTriggerPrice: 47000, // new TP trigger
  tpLimitPrice: 46900,
  tpSize: 0.75,
  // ... other parameters
});

// Cancel TP/SL order
await writeDex.cancelTpSlOrderForPosition({
  marketName: "BTC-USD",
  orderId: 12345,
  subaccountAddr: "subaccount_address", // optional
});
```

### Session Accounts

You can override the default account for specific transactions using session accounts:

```typescript
import { Ed25519Account } from "@aptos-labs/ts-sdk";

const sessionAccount = Ed25519Account.generate();

// Use session account for this transaction
await writeDex.placeOrder({
  marketName: "BTC-USD",
  price: 45000,
  size: 1.0,
  isBuy: true,
  timeInForce: TimeInForce.GoodTillCanceled,
  isReduceOnly: false,
  accountOverride: sessionAccount,
});
```

### Error Handling

All write operations return transaction results. For order placement, you get a structured result:

```typescript
interface PlaceOrderResult {
  success: boolean;
  orderId?: string;
  transactionHash: string;
  error?: string;
}

const result = await writeDex.placeOrder({
  // ... order parameters
});

if (result.success) {
  console.log("Order placed successfully:", result.orderId);
  console.log("Transaction:", result.transactionHash);
} else {
  console.error("Order failed:", result.error);
}
```

## Constants and Enums

### Time in Force

```typescript
export const TimeInForce = {
  GoodTillCanceled: 0,
  PostOnly: 1,
  ImmediateOrCancel: 2,
} as const;
```

### Candlestick Intervals

```typescript
export enum CandlestickInterval {
  MINUTE_1 = "1m",
  MINUTE_5 = "5m",
  MINUTE_15 = "15m",
  HOUR_1 = "1h",
  HOUR_4 = "4h",
  DAY_1 = "1d",
}
```

## Utilities

### Address Utilities

```typescript
import { getPrimarySubaccountAddr, getMarketAddr } from "@decibeltrade/sdk";

// Get primary subaccount address for an account
const subaccountAddr = getPrimarySubaccountAddr("account_address");

// Get market address from name
const marketAddr = getMarketAddr("BTC-USD", "perp_engine_global_address");
```

## WebSocket Subscriptions

All read operations that support real-time updates return an unsubscribe function:

```typescript
// Subscribe to multiple streams
const unsubscribeDepth = readDex.marketDepth.subscribeByName("BTC-USD", handleDepth);
const unsubscribePrices = readDex.marketPrices.subscribeByName("BTC-USD", handlePrices);
const unsubscribeOrders = readDex.userOpenOrders.subscribeByAddr("subaccount", handleOrders);

// Clean up subscriptions
function cleanup() {
  unsubscribeDepth();
  unsubscribePrices();
  unsubscribeOrders();
}

// Handle errors
const readDex = new DecibelReadDex(NETNA_CONFIG, {
  onWsError: (error) => {
    console.error("WebSocket error:", error);
    // Implement reconnection logic
  },
});
```

## TypeScript Types

The SDK is fully typed with Zod schemas for runtime validation. Import types for better development experience:

```typescript
import type {
  DecibelConfig,
  PerpMarket,
  UserPosition,
  MarketDepth,
  CandlestickData,
  AccountOverview,
  PlaceOrderResult,
} from "@decibeltrade/sdk";
```

## Best Practices

1. **Connection Management**: Reuse SDK instances where possible to maintain WebSocket connections.

2. **Error Handling**: Always wrap SDK calls in try-catch blocks and handle errors appropriately.

3. **Subscription Cleanup**: Always call unsubscribe functions to prevent memory leaks.

4. **Rate Limiting**: Be mindful of API rate limits when making frequent requests.

5. **Account Security**: Never expose private keys in client-side code. Use environment variables or secure key management.

6. **Precision**: Be careful with number precision for prices and sizes. The SDK handles decimal precision internally.

## Complete Trading Bot Example

```typescript
import { DecibelReadDex, DecibelWriteDex, NETNA_CONFIG, TimeInForce } from "@decibeltrade/sdk";
import { Ed25519Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

class TradingBot {
  private readDex: DecibelReadDex;
  private writeDex: DecibelWriteDex;
  private subaccountAddr: string;

  constructor(privateKey: string, subaccountAddr: string) {
    this.readDex = new DecibelReadDex(NETNA_CONFIG, {
      nodeApiKey: process.env.APTOS_NODE_API_KEY,
    });

    const account = new Ed25519Account({
      privateKey: new Ed25519PrivateKey(privateKey),
    });
    this.writeDex = new DecibelWriteDex(NETNA_CONFIG, account, {
      nodeApiKey: process.env.APTOS_NODE_API_KEY,
    });
    this.subaccountAddr = subaccountAddr;
  }

  async start() {
    // Subscribe to market data
    this.readDex.marketPrices.subscribeByName("BTC-USD", this.handlePriceUpdate.bind(this));
    this.readDex.marketDepth.subscribeByName("BTC-USD", this.handleDepthUpdate.bind(this));

    // Subscribe to account updates
    this.readDex.userPositions.subscribeByAddr(
      this.subaccountAddr,
      this.handlePositionUpdate.bind(this),
    );
  }

  private async handlePriceUpdate(priceData: any) {
    // Implement your trading logic here
    console.log("Price update:", priceData);
  }

  private async handleDepthUpdate(depthData: any) {
    // Analyze order book for trading opportunities
    console.log("Depth update:", depthData);
  }

  private async handlePositionUpdate(positionData: any) {
    // Monitor positions and manage risk
    console.log("Position update:", positionData);
  }

  async placeMarketBuyOrder(size: number) {
    try {
      const result = await this.writeDex.placeOrder({
        marketName: "BTC-USD",
        price: 0, // Market order (implementation may vary)
        size,
        isBuy: true,
        timeInForce: TimeInForce.ImmediateOrCancel,
        isReduceOnly: false,
        subaccountAddr: this.subaccountAddr,
      });

      if (result.success) {
        console.log(`Market buy order placed: ${result.orderId}`);
      } else {
        console.error(`Order failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Error placing order:", error);
    }
  }
}

// Usage
const bot = new TradingBot("your-private-key", "your-subaccount-address");
bot.start();
```

## Smart Contract Transactions

For developers who need direct access to Decibel's smart contracts, this section shows how to build and submit transactions directly using the Aptos SDK.

### Core Transaction Infrastructure

#### Base Transaction Manager

```typescript
import {
  Account,
  AccountAddress,
  AccountAuthenticator,
  Aptos,
  AptosConfig,
  CommittedTransactionResponse,
  InputGenerateTransactionPayloadData,
  MoveString,
  Network,
  PendingTransactionResponse,
  SimpleTransaction,
  createObjectAddress,
} from "@aptos-labs/ts-sdk";

class DecibelTransactionManager {
  private aptos: Aptos;
  private config: DecibelConfig;
  private skipSimulate: boolean;
  private noFeePayer: boolean;

  constructor(
    config: DecibelConfig,
    private account: Account,
    options?: {
      skipSimulate?: boolean;
      noFeePayer?: boolean;
      nodeApiKey?: string;
    },
  ) {
    this.config = config;
    this.skipSimulate = options?.skipSimulate ?? false;
    this.noFeePayer = options?.noFeePayer ?? false;

    const aptosConfig = new AptosConfig({
      network: config.network,
      fullnode: config.fullnodeUrl,
      clientConfig: { API_KEY: options?.nodeApiKey },
    });
    this.aptos = new Aptos(aptosConfig);
  }

  private async getSimulatedTransaction(
    payload: InputGenerateTransactionPayloadData,
    sender: AccountAddress,
  ): Promise<SimpleTransaction> {
    const transaction = await this.aptos.transaction.build.simple({
      sender,
      data: payload,
    });

    const [simulationResult] = await this.aptos.transaction.simulate.simple({
      transaction,
      options: {
        estimateMaxGasAmount: true,
        estimateGasUnitPrice: true,
      },
    });

    if (!simulationResult?.max_gas_amount || !simulationResult?.gas_unit_price) {
      throw new Error("Transaction simulation failed - no gas estimates returned");
    }

    return await this.aptos.transaction.build.simple({
      sender,
      data: payload,
      options: {
        maxGasAmount: Number(simulationResult.max_gas_amount),
        gasUnitPrice: Number(simulationResult.gas_unit_price),
      },
    });
  }

  private async submitTransaction(
    transaction: SimpleTransaction,
    senderAuthenticator: AccountAuthenticator,
  ): Promise<PendingTransactionResponse> {
    if (this.noFeePayer) {
      return await this.aptos.transaction.submit.simple({
        transaction,
        senderAuthenticator,
      });
    } else {
      return await this.submitFeePaidTransaction(transaction, senderAuthenticator);
    }
  }

  private async submitFeePaidTransaction(
    transaction: SimpleTransaction,
    senderAuthenticator: AccountAuthenticator,
  ): Promise<PendingTransactionResponse> {
    const signatureBcs = Array.from(senderAuthenticator.bcsToBytes());
    const transactionBcs = Array.from(transaction.rawTransaction.bcsToBytes());

    const response = await fetch(this.config.gasStationUrl + "/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        signature: signatureBcs,
        transaction: transactionBcs,
      }),
    });

    if (!response.ok) {
      throw new Error(`Fee payer service error: ${response.status}`);
    }

    return (await response.json()) as PendingTransactionResponse;
  }

  async sendTransaction(
    payload: InputGenerateTransactionPayloadData,
    accountOverride?: Account,
  ): Promise<CommittedTransactionResponse> {
    const signer = accountOverride ?? this.account;
    const sender = signer.accountAddress;

    let transaction: SimpleTransaction;

    if (!this.skipSimulate) {
      transaction = await this.getSimulatedTransaction(payload, sender);
    } else {
      const withFeePayer = !this.noFeePayer;
      transaction = await this.aptos.transaction.build.simple({
        sender,
        data: payload,
        withFeePayer,
      });
    }

    const senderAuthenticator = this.aptos.transaction.sign({
      signer,
      transaction,
    });

    const pendingTransaction = await this.submitTransaction(transaction, senderAuthenticator);
    return await this.aptos.waitForTransaction({
      transactionHash: pendingTransaction.hash,
    });
  }
}
```

### Utility Functions

```typescript
/**
 * Get market address from market name
 */
function getMarketAddress(marketName: string, perpEngineGlobalAddr: string): AccountAddress {
  const marketNameBytes = new MoveString(marketName).bcsToBytes();
  return createObjectAddress(AccountAddress.fromString(perpEngineGlobalAddr), marketNameBytes);
}

/**
 * Get primary subaccount address for a user account
 */
function getPrimarySubaccountAddress(userAddress: AccountAddress): string {
  const seed = new TextEncoder().encode("decibel_dex_primary");
  return createObjectAddress(userAddress, seed).toString();
}

/**
 * Extract order ID from transaction events
 */
function extractOrderIdFromTransaction(
  txResponse: CommittedTransactionResponse,
  subaccountAddr: string,
): string | null {
  try {
    if ("events" in txResponse && Array.isArray(txResponse.events)) {
      for (const event of txResponse.events) {
        if (event.type.includes("::market_types::OrderEvent")) {
          const orderEvent = event.data as any;
          if (orderEvent.user === subaccountAddr) {
            return orderEvent.order_id;
          }
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Error extracting order ID:", error);
    return null;
  }
}
```

### Account Management Transactions

#### Create Subaccount

```typescript
async function createSubaccount(
  transactionManager: DecibelTransactionManager,
  config: DecibelConfig,
): Promise<CommittedTransactionResponse> {
  return await transactionManager.sendTransaction({
    function: `${config.deployment.package}::dex_accounts::create_new_subaccount`,
    typeArguments: [],
    functionArguments: [],
  });
}
```

#### Deposit Collateral

```typescript
async function depositCollateral(
  transactionManager: DecibelTransactionManager,
  config: DecibelConfig,
  amount: number,
  subaccountAddr: string,
): Promise<CommittedTransactionResponse> {
  return await transactionManager.sendTransaction({
    function: `${config.deployment.package}::dex_accounts::deposit_to_subaccount_at`,
    typeArguments: [],
    functionArguments: [subaccountAddr, config.deployment.usdc, amount],
  });
}
```

#### Withdraw Collateral

```typescript
async function withdrawCollateral(
  transactionManager: DecibelTransactionManager,
  config: DecibelConfig,
  amount: number,
  subaccountAddr?: string,
): Promise<CommittedTransactionResponse> {
  const subaccount =
    subaccountAddr ?? getPrimarySubaccountAddress(transactionManager.account.accountAddress);

  return await transactionManager.sendTransaction({
    function: `${config.deployment.package}::dex_accounts::withdraw_from_subaccount`,
    typeArguments: [],
    functionArguments: [subaccount, config.deployment.usdc, amount],
  });
}
```

#### Configure Market Settings

```typescript
async function configureMarketSettings(
  transactionManager: DecibelTransactionManager,
  config: DecibelConfig,
  marketAddr: string,
  subaccountAddr: string,
  isCross: boolean,
  userLeverage: number,
): Promise<CommittedTransactionResponse> {
  return await transactionManager.sendTransaction({
    function: `${config.deployment.package}::dex_accounts::configure_user_settings_for_market`,
    typeArguments: [],
    functionArguments: [subaccountAddr, marketAddr, isCross, userLeverage],
  });
}
```

### Order Management Transactions

#### Place Order

```typescript
interface PlaceOrderResult {
  success: boolean;
  orderId?: string;
  transactionHash: string | null;
  error?: string;
}

async function placeOrder(
  transactionManager: DecibelTransactionManager,
  config: DecibelConfig,
  params: {
    marketName: string;
    price: number;
    size: number;
    isBuy: boolean;
    timeInForce: number;
    isReduceOnly: boolean;
    clientOrderId?: number;
    stopPrice?: number;
    tpTriggerPrice?: number;
    tpLimitPrice?: number;
    slTriggerPrice?: number;
    slLimitPrice?: number;
    builderAddr?: string;
    builderFee?: number;
    subaccountAddr?: string;
    accountOverride?: Account;
  },
): Promise<PlaceOrderResult> {
  try {
    const marketAddr = getMarketAddress(params.marketName, config.deployment.perpEngineGlobal);
    const subaccountAddr =
      params.subaccountAddr ??
      getPrimarySubaccountAddress(transactionManager.account.accountAddress);

    const txResponse = await transactionManager.sendTransaction(
      {
        function: `${config.deployment.package}::dex_accounts::place_order_to_subaccount`,
        typeArguments: [],
        functionArguments: [
          subaccountAddr,
          marketAddr.toString(),
          params.price,
          params.size,
          params.isBuy,
          params.timeInForce,
          params.isReduceOnly,
          params.clientOrderId,
          params.stopPrice,
          params.tpTriggerPrice,
          params.tpLimitPrice,
          params.slTriggerPrice,
          params.slLimitPrice,
          params.builderAddr,
          params.builderFee,
        ],
      },
      params.accountOverride,
    );

    const orderId = extractOrderIdFromTransaction(txResponse, subaccountAddr);

    return {
      success: true,
      orderId: orderId || undefined,
      transactionHash: txResponse.hash,
    };
  } catch (error) {
    return {
      success: false,
      transactionHash: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

#### Cancel Order

```typescript
async function cancelOrder(
  transactionManager: DecibelTransactionManager,
  config: DecibelConfig,
  params: {
    orderId: number;
    marketName?: string;
    marketAddr?: string;
    subaccountAddr?: string;
    accountOverride?: Account;
  },
): Promise<CommittedTransactionResponse> {
  const marketAddr =
    params.marketAddr ??
    (params.marketName
      ? getMarketAddress(params.marketName, config.deployment.perpEngineGlobal).toString()
      : "");

  if (!marketAddr) {
    throw new Error("Either marketName or marketAddr must be provided");
  }

  const subaccountAddr =
    params.subaccountAddr ?? getPrimarySubaccountAddress(transactionManager.account.accountAddress);

  return await transactionManager.sendTransaction(
    {
      function: `${config.deployment.package}::dex_accounts::cancel_order_to_subaccount`,
      typeArguments: [],
      functionArguments: [subaccountAddr, params.orderId, marketAddr],
    },
    params.accountOverride,
  );
}
```

#### Place TWAP Order

```typescript
async function placeTwapOrder(
  transactionManager: DecibelTransactionManager,
  config: DecibelConfig,
  params: {
    marketName: string;
    size: number;
    isBuy: boolean;
    isReduceOnly: boolean;
    twapFrequencySeconds: number;
    twapDurationSeconds: number;
    subaccountAddr?: string;
    accountOverride?: Account;
  },
): Promise<CommittedTransactionResponse> {
  const marketAddr = getMarketAddress(params.marketName, config.deployment.perpEngineGlobal);
  const subaccountAddr =
    params.subaccountAddr ?? getPrimarySubaccountAddress(transactionManager.account.accountAddress);

  return await transactionManager.sendTransaction(
    {
      function: `${config.deployment.package}::dex_accounts::place_twap_order_to_subaccount`,
      typeArguments: [],
      functionArguments: [
        subaccountAddr,
        marketAddr.toString(),
        params.size,
        params.isBuy,
        params.isReduceOnly,
        params.twapFrequencySeconds,
        params.twapDurationSeconds,
      ],
    },
    params.accountOverride,
  );
}
```

### Position Management Transactions

#### Place TP/SL Order

```typescript
async function placeTpSlOrderForPosition(
  transactionManager: DecibelTransactionManager,
  config: DecibelConfig,
  params: {
    marketAddr: string;
    tpTriggerPrice?: number;
    tpLimitPrice?: number;
    tpSize?: number;
    slTriggerPrice?: number;
    slLimitPrice?: number;
    slSize?: number;
    subaccountAddr?: string;
    accountOverride?: Account;
  },
): Promise<CommittedTransactionResponse> {
  const subaccountAddr =
    params.subaccountAddr ?? getPrimarySubaccountAddress(transactionManager.account.accountAddress);

  return await transactionManager.sendTransaction(
    {
      function: `${config.deployment.package}::dex_accounts::place_tp_sl_order_for_position`,
      typeArguments: [],
      functionArguments: [
        subaccountAddr,
        params.marketAddr,
        params.tpTriggerPrice,
        params.tpLimitPrice,
        params.tpSize,
        params.slTriggerPrice,
        params.slLimitPrice,
        params.slSize,
      ],
    },
    params.accountOverride,
  );
}
```

### Trading Delegation

#### Delegate Trading

```typescript
async function delegateTradingTo(
  transactionManager: DecibelTransactionManager,
  config: DecibelConfig,
  params: {
    accountToDelegateTo: string;
    subaccountAddr?: string;
  },
): Promise<CommittedTransactionResponse> {
  const subaccountAddr =
    params.subaccountAddr ?? getPrimarySubaccountAddress(transactionManager.account.accountAddress);

  return await transactionManager.sendTransaction({
    function: `${config.deployment.package}::dex_accounts::delegate_trading_to_for_subaccount`,
    typeArguments: [],
    functionArguments: [subaccountAddr, params.accountToDelegateTo],
  });
}
```

#### Revoke Delegation

```typescript
async function revokeDelegation(
  transactionManager: DecibelTransactionManager,
  config: DecibelConfig,
  params: {
    accountToRevoke: string;
    subaccountAddr?: string;
  },
): Promise<CommittedTransactionResponse> {
  const subaccountAddr =
    params.subaccountAddr ?? getPrimarySubaccountAddress(transactionManager.account.accountAddress);

  return await transactionManager.sendTransaction({
    function: `${config.deployment.package}::dex_accounts::revoke_delegation`,
    typeArguments: [],
    functionArguments: [subaccountAddr, params.accountToRevoke],
  });
}
```

### Complete Working Example

```typescript
import { Account } from "@aptos-labs/ts-sdk";

async function basicTradingExample() {
  const privateKey = "your-private-key-here";
  const account = Account.fromPrivateKey({ privateKey });
  const transactionManager = new DecibelTransactionManager(NETNA_CONFIG, account, {
    skipSimulate: false,
    noFeePayer: false,
  });

  try {
    // Create a subaccount
    console.log("Creating subaccount...");
    const createTx = await createSubaccount(transactionManager, NETNA_CONFIG);
    console.log("Subaccount created:", createTx.hash);

    // Get the primary subaccount address
    const subaccountAddr = getPrimarySubaccountAddress(account.accountAddress);
    console.log("Primary subaccount address:", subaccountAddr);

    // Deposit collateral (1000 USDC = 1000000000 if 6 decimals)
    console.log("Depositing collateral...");
    const depositTx = await depositCollateral(
      transactionManager,
      NETNA_CONFIG,
      1000000000,
      subaccountAddr,
    );
    console.log("Deposit successful:", depositTx.hash);

    // Configure market settings for BTC-USD
    const btcMarketAddr = getMarketAddress("BTC-USD", NETNA_CONFIG.deployment.perpEngineGlobal);
    console.log("Configuring market settings...");
    const configTx = await configureMarketSettings(
      transactionManager,
      NETNA_CONFIG,
      btcMarketAddr.toString(),
      subaccountAddr,
      true, // Use cross-margin
      1000, // 10x leverage (1000 basis points)
    );
    console.log("Market configured:", configTx.hash);

    // Place a limit buy order for 0.1 BTC at $45,000
    console.log("Placing buy order...");
    const orderResult = await placeOrder(transactionManager, NETNA_CONFIG, {
      marketName: "BTC-USD",
      price: 45000,
      size: 0.1,
      isBuy: true,
      timeInForce: TimeInForce.GoodTillCanceled,
      isReduceOnly: false,
      subaccountAddr,
    });

    if (orderResult.success) {
      console.log("Order placed successfully!");
      console.log("Order ID:", orderResult.orderId);
      console.log("Transaction:", orderResult.transactionHash);

      // Cancel the order
      if (orderResult.orderId) {
        console.log("Canceling order...");
        const cancelTx = await cancelOrder(transactionManager, NETNA_CONFIG, {
          orderId: parseInt(orderResult.orderId),
          marketName: "BTC-USD",
          subaccountAddr,
        });
        console.log("Order canceled:", cancelTx.hash);
      }
    } else {
      console.error("Order failed:", orderResult.error);
    }
  } catch (error) {
    console.error("Error in trading example:", error);
  }
}
```

### Best Practices

1. **Error Handling**: Always wrap transaction calls in try-catch blocks and handle different types of errors appropriately.

2. **Gas Management**: Use `skipSimulate: false` for gas estimation in production. Set appropriate gas limits for complex transactions.

3. **Subaccount Management**: Use primary subaccount for simple use cases. Create separate subaccounts for different strategies. Always verify subaccount addresses before transactions.

4. **Market Address Handling**: Cache market addresses to avoid repeated calculations. Verify market names are correct before generating addresses.

5. **Order Management**: Store order IDs for later cancellation. Use client order IDs for easier tracking. Implement proper order status monitoring.

## Resources

- 📚 [Full Documentation](https://docs.decibel.trade) - Complete API and transaction documentation
- 🔌 [REST API](https://docs.decibel.trade/api-reference/user/get-account-overview) - REST API reference
- 🔌 [WebSocket API](https://docs.decibel.trade/api-reference/websockets/bulkorderfills) - WebSocket API reference
- 💬 [Discord](https://discord.gg/decibel) - Join our community for support
- 🌐 [Trading Platform](https://app.decibel.trade) - Access the Decibel trading platform
