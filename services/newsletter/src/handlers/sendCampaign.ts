import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { NewsletterCampaignItem, NewsletterCampaignSendResponse } from "@briefly/contracts";
import { json, logError, logInfo } from "@briefly/shared";
import { requireIdentity } from "../lib/auth";
import { buildUnsubscribeUrl, renderCampaignBody } from "../lib/campaignContent";
import { loadPublicSendConfig, loadPublicSendGateConfig } from "../lib/config";
import { NewsletterEmailSender } from "../lib/email";
import { ConflictError, NotFoundError } from "../lib/errors";
import { toErrorResponse } from "../lib/errorResponse";
import { validateCampaignIdPathParam } from "../lib/validators";
import { CampaignsRepository } from "../repositories/campaignsRepository";
import { DeliveriesRepository } from "../repositories/deliveriesRepository";
import { SubscribersRepository } from "../repositories/subscribersRepository";

const errorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const campaignId = event.pathParameters?.campaignId ?? event.pathParameters?.campaign_id ?? "";
  let campaignsRepository: CampaignsRepository | null = null;
  let sendingCampaign: NewsletterCampaignItem | null = null;

  try {
    const identity = requireIdentity(event);
    const validatedCampaignId = validateCampaignIdPathParam(event);
    const gateCfg = loadPublicSendGateConfig();
    campaignsRepository = new CampaignsRepository(gateCfg.campaignsTable);
    const campaign = await campaignsRepository.getById(validatedCampaignId);
    if (!campaign) {
      throw new NotFoundError("Campaign not found", { campaign_id: validatedCampaignId });
    }

    if (!gateCfg.publicSendsEnabled) {
      throw new ConflictError("Public newsletter sends are disabled", {
        campaign_id: validatedCampaignId
      }, "public_sends_disabled");
    }

    if (campaign.status === "sent") {
      throw new ConflictError("Campaign has already been sent", {
        campaign_id: validatedCampaignId,
        status: campaign.status
      }, "campaign_already_sent");
    }

    if (campaign.status === "sending") {
      throw new ConflictError("Campaign is already sending", {
        campaign_id: validatedCampaignId,
        status: campaign.status
      }, "campaign_already_sending");
    }

    if (campaign.status !== "test_sent") {
      throw new ConflictError("Campaign requires a successful test send before subscriber send", {
        campaign_id: validatedCampaignId,
        status: campaign.status
      }, "test_send_required");
    }

    const cfg = loadPublicSendConfig();
    const deliveriesRepository = new DeliveriesRepository(cfg.deliveriesTable);
    const subscribersRepository = new SubscribersRepository(cfg.subscribersTable);
    sendingCampaign = await campaignsRepository.markSending(validatedCampaignId, new Date().toISOString());
    const subscribers = await subscribersRepository.scanActiveSubscribers();
    const sender = new NewsletterEmailSender();
    let deliveredCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let lastError: string | undefined;

    for (const subscriber of subscribers) {
      let deliveryKey: { campaign_id: string; subscriber_id: string } | undefined;
      try {
        const now = new Date().toISOString();
        const token = await subscribersRepository.ensureUnsubscribeToken(subscriber, now);
        const delivery = await deliveriesRepository.createQueuedIfAbsent({
          campaign_id: sendingCampaign.campaign_id,
          subscriber_id: subscriber.subscriber_id,
          email: subscriber.email,
          created_at: now
        });

        if (!delivery) {
          skippedCount += 1;
          continue;
        }

        deliveryKey = {
          campaign_id: delivery.campaign_id,
          subscriber_id: delivery.subscriber_id
        };
        const unsubscribeUrl = buildUnsubscribeUrl(cfg.siteBaseUrl, subscriber.email, token);
        const body = renderCampaignBody(sendingCampaign.body, unsubscribeUrl);
        const sendParams = {
          fromEmail: cfg.fromEmail,
          toEmail: subscriber.email,
          subject: sendingCampaign.subject,
          body
        };
        const result = await sender.send(cfg.replyToEmail ? { ...sendParams, replyToEmail: cfg.replyToEmail } : sendParams);
        await deliveriesRepository.markSent(
          delivery.campaign_id,
          delivery.subscriber_id,
          result.messageId,
          new Date().toISOString()
        );
        deliveredCount += 1;
      } catch (error) {
        failedCount += 1;
        lastError = errorMessage(error);
        if (deliveryKey) {
          try {
            await deliveriesRepository.markFailed(
              deliveryKey.campaign_id,
              deliveryKey.subscriber_id,
              lastError,
              new Date().toISOString()
            );
          } catch (markError) {
            logError("newsletter_delivery_mark_failed_error", {
              campaignId: validatedCampaignId,
              subscriberId: deliveryKey.subscriber_id,
              error: errorMessage(markError)
            });
          }
        }
      }
    }

    const finalStatus = failedCount > 0 ? "failed" : "sent";
    const completedCampaign = await campaignsRepository.completeSend({
      campaign_id: sendingCampaign.campaign_id,
      status: finalStatus,
      updated_at: new Date().toISOString(),
      total_recipients: subscribers.length,
      delivered_count: deliveredCount,
      failed_count: failedCount,
      skipped_count: skippedCount,
      ...(lastError ? { last_error: lastError } : {})
    });

    logInfo("newsletter_campaign_send_completed", {
      campaignId: validatedCampaignId,
      reviewer: identity.userId,
      status: finalStatus,
      totalRecipients: subscribers.length,
      deliveredCount,
      failedCount,
      skippedCount
    });

    const response: NewsletterCampaignSendResponse = {
      campaign: completedCampaign,
      message:
        finalStatus === "sent"
          ? `Campaign sent to ${deliveredCount} subscribers`
          : `Campaign finished with ${failedCount} failed deliveries`
    };

    return json(200, response);
  } catch (error) {
    if (campaignsRepository && sendingCampaign) {
      try {
        await campaignsRepository.completeSend({
          campaign_id: sendingCampaign.campaign_id,
          status: "failed",
          updated_at: new Date().toISOString(),
          total_recipients: 0,
          delivered_count: 0,
          failed_count: 0,
          skipped_count: 0,
          last_error: errorMessage(error)
        });
      } catch (markError) {
        logError("newsletter_campaign_mark_failed_error", {
          campaignId,
          error: errorMessage(markError)
        });
      }
    }

    return toErrorResponse(error, "Failed to send newsletter campaign");
  }
};
