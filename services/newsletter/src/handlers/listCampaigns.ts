import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { ListNewsletterCampaignsResponse } from "@briefly/contracts";
import { json } from "@briefly/shared";
import { requireIdentity } from "../lib/auth";
import { toCampaignSummary } from "../lib/campaignContent";
import { loadCampaignsConfig } from "../lib/config";
import { toErrorResponse } from "../lib/errorResponse";
import { CampaignsRepository } from "../repositories/campaignsRepository";

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    requireIdentity(event);
    const cfg = loadCampaignsConfig();
    const campaignsRepository = new CampaignsRepository(cfg.campaignsTable);
    const campaigns = (await campaignsRepository.listAll())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(toCampaignSummary);

    const response: ListNewsletterCampaignsResponse = {
      campaigns
    };

    return json(200, response);
  } catch (error) {
    return toErrorResponse(error, "Failed to list newsletter campaigns");
  }
};
