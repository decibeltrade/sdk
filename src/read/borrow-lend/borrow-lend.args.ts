import { BaseRequestArgs } from "../base-reader";
import { CursorPageParams, PageParams } from "../pagination.types";
import type { BorrowLendRateInterval } from "./borrow-lend.types";

export interface BorrowLendAccountRequestArgs extends BaseRequestArgs {
  account: string;
}

/** `offset` 0-10000; `limit` 1-200, server default 10. */
export type BorrowLendCollateralRequestArgs = BaseRequestArgs & PageParams;

export interface BorrowLendVaultLendingRequestArgs extends BaseRequestArgs {
  vault: string;
}

/** `cursor` is `next_cursor` from the previous page; `limit` is 1-200, server default 50. */
export interface BorrowLendActivityRequestArgs extends BaseRequestArgs, CursorPageParams {
  account: string;
  /** Exact, case-sensitive match, e.g. `Debt`. */
  eventType?: string;
  /** Exact, case-sensitive match, e.g. `FillBorrow`. An empty string matches rows without a reason. */
  reason?: string;
}

export interface BorrowLendPoolHistoryRequestArgs extends BaseRequestArgs, CursorPageParams {
  /** Unix milliseconds. The range must not exceed 180 days. */
  startTimestamp: number;
  /** Unix milliseconds. Must be >= `startTimestamp`. */
  endTimestamp: number;
}

export interface BorrowLendRateHistoryRequestArgs extends BaseRequestArgs {
  /** Unix milliseconds, inclusive. Aligned down to the interval boundary by the server. */
  startTimestamp: number;
  /** Unix milliseconds, exclusive. Must be >= `startTimestamp`. */
  endTimestamp: number;
  /** Bucket size, server default `1h`. Ranges spanning more than 1000 buckets are rejected with 400. */
  interval?: BorrowLendRateInterval;
}
