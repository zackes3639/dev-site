import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { GetNewsletterCampaignResponse } from "@briefly/contracts";
import { json } from "@briefly/shared";
import { requireIdentity } from "../lib/auth";
import { loadCampaignsConfig } from "../lib/config";
import { NotFoundError } from "../lib/errors";
import { toErrorResponse } from "../lib/errorResponse";
import { validateCampaignIdPathParam } from "../lib/validators";
import { CampaignsRepository } from "../repositories/campaignsRepository";

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    requireIdentity(event);
    const campaignId = validateCampaignIdPathParam(event);
    const cfg = loadCampaignsConfig();
    const campaignsRepository = new CampaignsRepository(cfg.campaignsTable);
    const campaign = await campaignsRepository.getById(campaignId);
    if (!campaign) {
      throw new NotFoundError("Campaign not found", { campaign_id: campaignId });
    }

    const response: GetNewsletterCampaignResponse = {
      campaign
    };

    return json(200, response);
  } catch (error) {
    return toErrorResponse(error, "Failed to get newsletter campaign");
  }
};
