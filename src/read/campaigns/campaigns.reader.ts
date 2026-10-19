import { FetchOptions } from "../../utils";
import { BaseReader } from "../base-reader";
import {
  ActiveCampaignsSchema,
  CampaignSummarySchema,
  GetActiveCampaignsArgs,
  GetCampaignSummaryArgs,
} from "./campaigns.types";

// Without the opt-in the API withholds campaign types added after SDK 0.8.2.
function withEnumOptIn(options?: FetchOptions): FetchOptions {
  return {
    ...options,
    headers: {
      Prefer: "include-unknown-enum-members",
      ...(options?.headers as Record<string, string> | undefined),
    },
  };
}

export class CampaignsReader extends BaseReader {
  async getActive({ fetchOptions }: GetActiveCampaignsArgs = {}) {
    const response = await this.getRequest({
      schema: ActiveCampaignsSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/campaigns/active`,
      options: withEnumOptIn(fetchOptions),
    });
    return response.data;
  }

  async getSummary({ accountAddress, limit, offset, fetchOptions }: GetCampaignSummaryArgs) {
    const queryParams = new URLSearchParams({ account: accountAddress });
    if (limit !== undefined) queryParams.set("limit", String(limit));
    if (offset !== undefined) queryParams.set("offset", String(offset));
    const response = await this.getRequest({
      schema: CampaignSummarySchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/campaigns/account`,
      queryParams,
      options: withEnumOptIn(fetchOptions),
    });
    return response.data;
  }
}
