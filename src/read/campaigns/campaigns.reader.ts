import { DecibelReaderDeps } from "../../constants";
import {
  CampaignViewSchema,
  ClaimViewSchema,
  GetCampaignArgs,
  GetUserCampaignClaimsArgs,
} from "./campaigns.types";

export class CampaignsReader {
  constructor(private readonly deps: DecibelReaderDeps) {}

  private get campaignPackage() {
    return this.deps.config.deployment.campaignPackage;
  }

  async getCampaign({ campaignAddress }: GetCampaignArgs) {
    const [result] = await this.deps.aptos.view<[Record<string, unknown>]>({
      payload: {
        function: `${this.campaignPackage}::campaign_manager::get_campaign`,
        typeArguments: [],
        functionArguments: [campaignAddress],
      },
    });
    return CampaignViewSchema.parse(result);
  }

  async getUserCampaignClaims({ userAddress, campaignIds }: GetUserCampaignClaimsArgs) {
    const [result] = await this.deps.aptos.view<[Array<Record<string, unknown>>]>({
      payload: {
        function: `${this.campaignPackage}::campaign_manager::get_user_campaign_claims`,
        typeArguments: [],
        functionArguments: [userAddress, campaignIds],
      },
    });
    return result.map((item) => ClaimViewSchema.parse(item));
  }
}
