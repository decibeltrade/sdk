import { constructKnownQueryParams } from "../../utils";
import { BaseReader, BaseRequestArgs } from "../base-reader";
import {
  BorrowLendAccountRequestArgs,
  BorrowLendActivityRequestArgs,
  BorrowLendCollateralRequestArgs,
  BorrowLendPoolHistoryRequestArgs,
  BorrowLendRateHistoryRequestArgs,
  BorrowLendVaultLendingRequestArgs,
} from "./borrow-lend.args";
import {
  BorrowLendAccountSchema,
  BorrowLendActivityPageSchema,
  BorrowLendCollateralPageSchema,
  BorrowLendPoolHistoryPageSchema,
  BorrowLendPoolSchema,
  BorrowLendRateHistorySchema,
  VaultLendingPositionSchema,
} from "./borrow-lend.types";

const BASE_PATH = "/api/v1/borrow_lend";

/**
 * Every endpoint answers HTTP 503 (surfaced as a `FetchError` with `status: 503`)
 * when borrow/lend is disabled or not yet ready on the server.
 */
export class BorrowLendReader extends BaseReader {
  private url(path: string) {
    return `${this.deps.config.tradingHttpUrl}${BASE_PATH}/${path}`;
  }

  async getPool({ fetchOptions }: BaseRequestArgs = {}) {
    const response = await this.getRequest({
      schema: BorrowLendPoolSchema,
      url: this.url("pool"),
      options: fetchOptions,
    });
    return response.data;
  }

  async getAccount({ fetchOptions, account }: BorrowLendAccountRequestArgs) {
    const response = await this.getRequest({
      schema: BorrowLendAccountSchema,
      url: this.url("account"),
      queryParams: new URLSearchParams({ account }),
      options: fetchOptions,
    });
    return response.data;
  }

  async getCollateral({ fetchOptions, ...page }: BorrowLendCollateralRequestArgs = {}) {
    const queryParams = constructKnownQueryParams(page);

    const response = await this.getRequest({
      schema: BorrowLendCollateralPageSchema,
      url: this.url("collateral"),
      queryParams,
      options: fetchOptions,
    });
    return response.data;
  }

  async getVaultLending({ fetchOptions, vault }: BorrowLendVaultLendingRequestArgs) {
    const response = await this.getRequest({
      schema: VaultLendingPositionSchema,
      url: this.url("vault_lending"),
      queryParams: new URLSearchParams({ vault }),
      options: fetchOptions,
    });
    return response.data;
  }

  async getActivity(args: BorrowLendActivityRequestArgs) {
    return this.getAccountEventPage("activity", args);
  }

  async getLendingHistory(args: BorrowLendActivityRequestArgs) {
    return this.getAccountEventPage("lending_history", args);
  }

  async getPoolHistory({
    fetchOptions,
    startTimestamp,
    endTimestamp,
    cursor,
    limit,
  }: BorrowLendPoolHistoryRequestArgs) {
    const queryParams = constructKnownQueryParams({ cursor, limit });
    queryParams.set("start_timestamp", startTimestamp.toString());
    queryParams.set("end_timestamp", endTimestamp.toString());

    const response = await this.getRequest({
      schema: BorrowLendPoolHistoryPageSchema,
      url: this.url("pool_history"),
      queryParams,
      options: fetchOptions,
    });
    return response.data;
  }

  async getRateHistory({
    fetchOptions,
    startTimestamp,
    endTimestamp,
    interval,
  }: BorrowLendRateHistoryRequestArgs) {
    const queryParams = new URLSearchParams({
      start_timestamp: startTimestamp.toString(),
      end_timestamp: endTimestamp.toString(),
    });
    if (interval !== undefined) queryParams.set("interval", interval);

    const response = await this.getRequest({
      schema: BorrowLendRateHistorySchema,
      url: this.url("rate_history"),
      queryParams,
      options: fetchOptions,
    });
    return response.data;
  }

  private async getAccountEventPage(
    path: "activity" | "lending_history",
    { fetchOptions, account, cursor, limit, eventType, reason }: BorrowLendActivityRequestArgs,
  ) {
    const queryParams = constructKnownQueryParams({ cursor, limit });
    queryParams.set("account", account);
    if (eventType !== undefined) queryParams.set("event_type", eventType);
    if (reason !== undefined) queryParams.set("reason", reason);

    const response = await this.getRequest({
      schema: BorrowLendActivityPageSchema,
      url: this.url(path),
      queryParams,
      options: fetchOptions,
    });
    return response.data;
  }
}
