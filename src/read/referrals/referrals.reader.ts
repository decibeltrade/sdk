import { BaseReader, BaseRequestArgs } from "../base-reader";
import {
  AccountReferralSchema,
  AffiliateCodesResponseSchema,
  AffiliateEarningsResponseSchema,
  RedeemReferralResponseSchema,
  ReferralCodeValidationSchema,
  ReferrerStatsSchema,
  UserReferralsRequestArgs,
  UserReferralsResponseSchema,
} from "./referrals.types";

export class ReferralsReader extends BaseReader {
  /**
   * Validate a referral code (check existence and active status).
   */
  async validateCode(code: string, { fetchOptions }: BaseRequestArgs = {}) {
    const response = await this.getRequest({
      schema: ReferralCodeValidationSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/referrals/code/${encodeURIComponent(code)}`,
      options: fetchOptions,
    });
    return response.data;
  }

  /**
   * Get referral information for a specific account.
   */
  async getAccountReferral(account: string, { fetchOptions }: BaseRequestArgs = {}) {
    const response = await this.getRequest({
      schema: AccountReferralSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/referrals/account/${account}`,
      options: fetchOptions,
    });
    return response.data;
  }

  /**
   * Redeem a referral code for an account.
   */
  async redeemCode(
    args: { referralCode: string; account: string },
    { fetchOptions }: BaseRequestArgs = {},
  ) {
    const response = await this.postRequest({
      schema: RedeemReferralResponseSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/referrals/redeem`,
      body: { referral_code: args.referralCode, account: args.account },
      options: fetchOptions,
    });
    return response.data;
  }

  /**
   * Get aggregate referral statistics for a referrer.
   */
  async getReferrerStats(account: string, { fetchOptions }: BaseRequestArgs = {}) {
    const response = await this.getRequest({
      schema: ReferrerStatsSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/referrals/stats/${account}`,
      options: fetchOptions,
    });
    return response.data;
  }

  /**
   * Get paginated list of users referred by a referrer.
   */
  async getUserReferrals({
    referrerAccount,
    limit,
    offset,
    fetchOptions,
  }: UserReferralsRequestArgs) {
    const queryParams = new URLSearchParams({ referrer_account: referrerAccount });
    if (limit !== undefined) {
      queryParams.set("limit", limit.toString());
    }
    if (offset !== undefined) {
      queryParams.set("offset", offset.toString());
    }

    const response = await this.getRequest({
      schema: UserReferralsResponseSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/referrals/users`,
      queryParams,
      options: fetchOptions,
    });

    return response.data;
  }

  /**
   * Get all referral codes owned by an account with per-code usage stats.
   */
  async getAffiliateCodes(account: string, { fetchOptions }: BaseRequestArgs = {}) {
    const response = await this.getRequest({
      schema: AffiliateCodesResponseSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/affiliates/codes/${account}`,
      options: fetchOptions,
    });
    return response.data;
  }

  /**
   * Get affiliate earnings breakdown and referred users for an account.
   */
  async getAffiliateEarnings(account: string, { fetchOptions }: BaseRequestArgs = {}) {
    const queryParams = new URLSearchParams({ limit: "1000" });
    const response = await this.getRequest({
      schema: AffiliateEarningsResponseSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/affiliates/earnings/${account}`,
      queryParams,
      options: fetchOptions,
    });
    return response.data;
  }
}
