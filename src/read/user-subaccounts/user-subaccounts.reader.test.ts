import { Aptos, AptosApiError, AptosApiType, Network } from "@aptos-labs/ts-sdk";
import { describe, expect, it, vi } from "vitest";

import { DecibelConfig, DecibelReaderDeps } from "../../constants";
import { DEFAULT_COMPAT_VERSION } from "../../release-config";
import { DecibelWsSubscription } from "../ws-subscription";
import { UserSubaccountsReader } from "./user-subaccounts.reader";

const PACKAGE = "0x0000000000000000000000000000000000000000000000000000000000000123";
const ADDRESS = "0x00000000000000000000000000000000000000000000000000000000000000aa";

function createReader(getAccountResource: ReturnType<typeof vi.fn>) {
  const config: DecibelConfig = {
    network: Network.TESTNET,
    fullnodeUrl: "https://testnet.aptoslabs.com/v1",
    tradingHttpUrl: "https://api.testnet.example.com",
    tradingWsUrl: "wss://ws.testnet.example.com",
    deployment: {
      package: PACKAGE,
      predepositPackage: "0x0000000000000000000000000000000000000000000000000000000000000456",
      campaignPackage: "0x0000000000000000000000000000000000000000000000000000000000004e110",
      usdc: "0x0000000000000000000000000000000000000000000000000000000000000789",
      testc: "0x0000000000000000000000000000000000000000000000000000000000000abc",
      perpEngineGlobal: "0x0000000000000000000000000000000000000000000000000000000000000def",
      dlpVault: "0x0000000000000000000000000000000000000000000000000000000000000ghi",
      dlpShare: "0x0000000000000000000000000000000000000000000000000000000000000jkl",
    },
    compatVersion: DEFAULT_COMPAT_VERSION,
  };
  const deps: DecibelReaderDeps = {
    aptos: { getAccountResource } as unknown as Aptos,
    ws: {} as unknown as DecibelWsSubscription,
    config,
    apiKey: "test-api-key",
  };
  return new UserSubaccountsReader(deps);
}

function fullnodeError(status: number, data: unknown) {
  return new AptosApiError({
    apiType: AptosApiType.FULLNODE,
    aptosRequest: { url: "https://testnet.aptoslabs.com/v1", method: "GET" },
    aptosResponse: {
      status,
      statusText: "",
      data,
      url: "https://testnet.aptoslabs.com/v1",
      headers: {},
    },
  });
}

describe("UserSubaccountsReader.isSubaccount", () => {
  it("returns true and reads the Subaccount resource when it exists", async () => {
    const getAccountResource = vi.fn().mockResolvedValue({});
    const reader = createReader(getAccountResource);

    await expect(reader.isSubaccount(ADDRESS)).resolves.toBe(true);
    expect(getAccountResource).toHaveBeenCalledWith({
      accountAddress: ADDRESS,
      resourceType: `${PACKAGE}::dex_accounts::Subaccount`,
    });
  });

  it("returns false when the fullnode answers resource_not_found", async () => {
    const getAccountResource = vi
      .fn()
      .mockRejectedValue(
        fullnodeError(404, { message: "Resource not found", error_code: "resource_not_found" }),
      );

    await expect(createReader(getAccountResource).isSubaccount(ADDRESS)).resolves.toBe(false);
  });

  it("rejects with the fullnode error on a 500", async () => {
    const error = fullnodeError(500, { message: "Internal Server Error" });
    const getAccountResource = vi.fn().mockRejectedValue(error);

    await expect(createReader(getAccountResource).isSubaccount(ADDRESS)).rejects.toBe(error);
  });

  it("rejects when the request never reaches the fullnode", async () => {
    const error = new TypeError("fetch failed");
    const getAccountResource = vi.fn().mockRejectedValue(error);

    await expect(createReader(getAccountResource).isSubaccount(ADDRESS)).rejects.toBe(error);
  });

  it("rejects on a 404 that is not resource_not_found", async () => {
    const error = fullnodeError(404, {
      message: "Module not found",
      error_code: "module_not_found",
    });
    const getAccountResource = vi.fn().mockRejectedValue(error);

    await expect(createReader(getAccountResource).isSubaccount(ADDRESS)).rejects.toBe(error);
  });
});
