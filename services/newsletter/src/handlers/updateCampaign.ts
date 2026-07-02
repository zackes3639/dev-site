import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { UpdateNewsletterCampaignResponse } from "@briefly/contracts";
import { json, logInfo } from "@briefly/shared";
import { requireIdentity } from "../lib/auth";
import { parseJsonBody } from "../lib/body";
import { loadCampaignsConfig } from "../lib/config";
import { toErrorResponse } from "../lib/errorResponse";
import { validateCampaignIdPathParam, validateUpdateNewsletterCampaign } from "../lib/validators";
import { CampaignsRepository } from "../repositories/campaignsRepository";

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const identity = requireIdentity(event);
    const campaignId = validateCampaignIdPathParam(event);
    const payload = validateUpdateNewsletterCampaign(parseJsonBody<unknown>(event));
    const cfg = loadCampaignsConfig();
    const campaignsRepository = new CampaignsRepository(cfg.campaignsTable);
    const campaign = await campaignsRepository.updateEditable({
      campaign_id: campaignId,
      expected_version: payload.expected_version,
      patch: {
        ...(typeof payload.subject === "string" ? { subject: payload.subject } : {}),
        ...(typeof payload.body === "string" ? { body: payload.body } : {})
      },
      updated_by: identity.userId,
      updated_at: new Date().toISOString()
    });

    logInfo("newsletter_campaign_updated", {
      campaignId,
      reviewer: identity.userId,
      version: campaign.version
    });

    const response: UpdateNewsletterCampaignResponse = {
      campaign
    };

    return json(200, response);
  } catch (error) {
    return toErrorResponse(error, "Failed to update newsletter campaign");
  }
};
