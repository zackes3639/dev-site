import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { NewsletterCampaignSendResponse } from "@briefly/contracts";
import { json, logInfo } from "@briefly/shared";
import { requireIdentity } from "../lib/auth";
import { parseJsonBody } from "../lib/body";
import { buildUnsubscribeUrl, renderCampaignBody } from "../lib/campaignContent";
import { loadTestSendConfig } from "../lib/config";
import { NewsletterEmailSender } from "../lib/email";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors";
import { toErrorResponse } from "../lib/errorResponse";
import { validateCampaignIdPathParam } from "../lib/validators";
import { CampaignsRepository } from "../repositories/campaignsRepository";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const resolveTestRecipient = (event: APIGatewayProxyEventV2, fallbackRecipient: string): string => {
  const payload = parseJsonBody<Record<string, unknown>>(event, { allowEmpty: true });
  const requestedRecipient = payload.recipient_email;
  if (typeof requestedRecipient === "undefined" || requestedRecipient === null || requestedRecipient === "") {
    return fallbackRecipient;
  }

  if (typeof requestedRecipient !== "string") {
    throw new ValidationError("recipient_email must be a string");
  }

  const recipient = requestedRecipient.trim().toLowerCase();
  if (!EMAIL_RE.test(recipient)) {
    throw new ValidationError("recipient_email must be a valid email");
  }

  return recipient;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const identity = requireIdentity(event);
    const campaignId = validateCampaignIdPathParam(event);
    const cfg = loadTestSendConfig();
    const testRecipient = resolveTestRecipient(event, cfg.testRecipient);
    const campaignsRepository = new CampaignsRepository(cfg.campaignsTable);
    const campaign = await campaignsRepository.getById(campaignId);
    if (!campaign) {
      throw new NotFoundError("Campaign not found", { campaign_id: campaignId });
    }

    if (campaign.status === "sending" || campaign.status === "sent") {
      throw new ConflictError("Campaign cannot receive a test send in its current status", {
        campaign_id: campaignId,
        status: campaign.status
      });
    }

    const unsubscribeUrl = buildUnsubscribeUrl(cfg.siteBaseUrl, testRecipient, "test-send");
    const body = renderCampaignBody(campaign.body, unsubscribeUrl);
    const sender = new NewsletterEmailSender();
    const sendParams = {
      fromEmail: cfg.fromEmail,
      toEmail: testRecipient,
      subject: campaign.subject,
      body
    };

    await sender.send(cfg.replyToEmail ? { ...sendParams, replyToEmail: cfg.replyToEmail } : sendParams);

    const sentAt = new Date().toISOString();
    const updatedCampaign = await campaignsRepository.markTestSent(
      campaign.campaign_id,
      campaign.version,
      testRecipient,
      sentAt
    );

    logInfo("newsletter_campaign_test_sent", {
      campaignId,
      recipient: testRecipient,
      reviewer: identity.userId
    });

    const response: NewsletterCampaignSendResponse = {
      campaign: updatedCampaign,
      message: `Test email sent to ${testRecipient}`
    };

    return json(200, response);
  } catch (error) {
    return toErrorResponse(error, "Failed to send newsletter test campaign");
  }
};
