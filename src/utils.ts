import {
  AccountAddress,
  CommittedTransactionResponse,
  createObjectAddress,
  MoveString,
} from "@aptos-labs/ts-sdk";
import { z, ZodError } from "zod/v4";

import { QUERY_PARAM_KEYS } from "./constants";
import { PageParams, SearchTermParams, SortParams } from "./read";

export function getMarketAddr(name: string, perpEngineGlobalAddr: string) {
  const marketNameBytes = new MoveString(name).bcsToBytes();
  return createObjectAddress(AccountAddress.fromString(perpEngineGlobalAddr), marketNameBytes);
}

export type FetchOptions = Omit<RequestInit, "method" | "body">;

export interface PostRequestArgs<TResponseData> {
  schema: z.ZodType<TResponseData>;
  url: string;
  body?: unknown;
  options?: FetchOptions;
  apiKey?: string;
}

export async function postRequest<TResponseData>({
  schema,
  url,
  body,
  options = {},
  apiKey,
}: PostRequestArgs<TResponseData>) {
  return baseRequest({
    schema,
    url,
    method: "POST",
    body,
    options,
    setJsonContentType: true,
    apiKey,
  });
}

export interface PatchRequestArgs<TResponseData> {
  schema: z.ZodType<TResponseData>;
  url: string;
  body?: unknown;
  options?: FetchOptions;
  apiKey?: string;
}

export async function patchRequest<TResponseData>({
  schema,
  url,
  body,
  options = {},
  apiKey,
}: PatchRequestArgs<TResponseData>) {
  return baseRequest({
    schema,
    url,
    method: "PATCH",
    body,
    options,
    setJsonContentType: true,
    apiKey,
  });
}

export interface GetRequestArgs<TResponseData> {
  schema: z.ZodType<TResponseData>;
  url: string;
  queryParams?: ConstructorParameters<typeof URLSearchParams>[0];
  options?: FetchOptions;
  apiKey?: string;
}

export async function getRequest<TResponseData>({
  schema,
  url,
  queryParams,
  options = {},
  apiKey,
}: GetRequestArgs<TResponseData>) {
  return baseRequest({
    schema,
    url,
    method: "GET",
    queryParams,
    options,
    apiKey,
  });
}

interface BaseRequestArgs<TResponseData> {
  schema: z.ZodType<TResponseData>;
  url: string;
  method: "GET" | "POST" | "PATCH";
  options?: FetchOptions;
  body?: unknown;
  queryParams?: ConstructorParameters<typeof URLSearchParams>[0];
  setJsonContentType?: boolean;
  apiKey?: string;
}

async function baseRequest<TResponseData>({
  schema,
  url,
  method,
  options = {},
  body,
  queryParams,
  setJsonContentType = false,
  apiKey,
}: BaseRequestArgs<TResponseData>) {
  const { headers: argHeaders, credentials, ...restOptions } = options;

  const headers = new Headers(argHeaders);
  if (setJsonContentType) {
    headers.set("Content-Type", "application/json");
  }
  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }

  const queryString = queryParams ? `?${new URLSearchParams(queryParams).toString()}` : "";
  const fullUrl = `${url}${queryString}`;

  const fetchInit: RequestInit = {
    method,
    headers,
    credentials,
    ...restOptions,
  };

  if (body !== undefined) {
    fetchInit.body = JSON.stringify(body);
  }

  const response = await fetch(fullUrl, fetchInit);
  const { status, statusText } = response;

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`HTTP Error ${status} (${statusText}): ${message}`);
  }

  const textData = await response.text();
  try {
    const data = schema.parse(JSON.parse(textData, bigIntReviver));
    return { data, status, statusText };
  } catch (e) {
    throw prettifyMaybeZodError(e);
  }
}

export function prettifyMaybeZodError(e: unknown) {
  if (e instanceof ZodError) {
    return new Error(z.prettifyError(e), { cause: e });
  }
  return e;
}

export function bigIntReviver(key: string, value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "$bigint" in value &&
    typeof value.$bigint === "string"
  ) {
    return BigInt(value.$bigint);
  }
  return value;
}

export function getPrimarySubaccountAddr(
  addr: AccountAddress | string,
  variant: "v1" | "v2" = "v2",
) {
  const account = typeof addr === "string" ? AccountAddress.fromString(addr) : addr;
  const seed = new TextEncoder().encode(
    variant === "v1" ? "decibel_dex_primary" : "decibel_dex_primary_v2",
  );
  return createObjectAddress(account, seed).toString();
}

export function getTradingCompetitionSubaccountAddr(addr: AccountAddress | string) {
  const account = typeof addr === "string" ? AccountAddress.fromString(addr) : addr;
  const seed = new TextEncoder().encode("trading_competition");
  return createObjectAddress(account, seed).toString();
}

export function getVaultShareAddress(vaultAddress: string) {
  const seed = new TextEncoder().encode("vault_share_asset");
  return createObjectAddress(AccountAddress.fromString(vaultAddress), seed).toString();
}

type KnownQueryParams = Partial<PageParams & SearchTermParams & SortParams<string>>;

export const PARAM_MAP: Record<keyof KnownQueryParams, string> = {
  limit: QUERY_PARAM_KEYS.limit,
  offset: QUERY_PARAM_KEYS.offset,
  sortKey: QUERY_PARAM_KEYS.sortKey,
  sortDir: QUERY_PARAM_KEYS.sortDir,
  searchTerm: QUERY_PARAM_KEYS.searchTerm,
};

/**
 * Construct query params from an args object, supporting optional PageParams, SearchTermParams, and generic SortParams.
 * @param args - The argument object, which may include page, search, and sort params.
 * @returns URLSearchParams instance with the constructed query parameters.
 */
export function constructKnownQueryParams(args: KnownQueryParams): URLSearchParams {
  const queryParams = new URLSearchParams();

  Object.keys(args).forEach((_argKey) => {
    const argKey = _argKey as keyof KnownQueryParams;

    const value = args[argKey];

    const paramKey = PARAM_MAP[argKey];

    if (paramKey && value !== undefined && !(typeof value === "string" && value.trim() === "")) {
      queryParams.set(paramKey, String(value));
    }
  });

  return queryParams;
}

export function generateRandomReplayProtectionNonce() {
  const buf = new Uint32Array(2);

  crypto.getRandomValues(buf);

  const valueAtIndex0 = buf[0];

  const valueAtIndex1 = buf[1];

  if (!valueAtIndex0 || !valueAtIndex1) return null;

  // combine two 32-bit parts into a single 64-bit bigint
  return (BigInt(valueAtIndex0) << BigInt(32)) | BigInt(valueAtIndex1);
}

/**
 * Round price to valid tick size.
 * Prices must be multiples of tickSize in chain units.
 */
export function roundToTickSize(
  price: number,
  tickSize: number,
  pxDecimals: number,
  roundUp: boolean,
): number {
  if (price === 0) return 0;
  const denormalized = price * 10 ** pxDecimals;
  const rounded = roundUp
    ? Math.ceil(denormalized / tickSize) * tickSize
    : Math.floor(denormalized / tickSize) * tickSize;
  return Number((rounded / 10 ** pxDecimals).toFixed(pxDecimals));
}

export const extractVaultAddressFromCreateTx = (createVaultTx: CommittedTransactionResponse) => {
  // Extract vault address from transaction events
  let vaultAddress: string | { inner: string } | null = null;
  if ("events" in createVaultTx && Array.isArray(createVaultTx.events)) {
    for (const event of createVaultTx.events) {
      if (event.type.includes("::vault::VaultCreatedEvent")) {
        const eventData = event.data as { vault: string | { inner: string } };
        vaultAddress = eventData.vault;
        break;
      }
    }
  }

  if (!vaultAddress) throw new Error("Unable to extract vault address from transaction");

  vaultAddress =
    typeof vaultAddress === "object" && "inner" in vaultAddress ? vaultAddress.inner : vaultAddress;

  return vaultAddress;
};
