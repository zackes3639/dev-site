import { json, logInfo } from "@briefly/shared";
import { buildCampaignDraftFromPost, toCampaignSummary } from "../lib/campaignContent";
import { loadDetectorConfig } from "../lib/config";
import { toErrorResponse } from "../lib/errorResponse";
import { CampaignsRepository } from "../repositories/campaignsRepository";
import { LegacyPostsRepository } from "../repositories/legacyPostsRepository";

export const handler = async () => {
  try {
    const cfg = loadDetectorConfig();
    const postsRepository = new LegacyPostsRepository(cfg.legacyPostsTable);
    const campaignsRepository = new CampaignsRepository(cfg.campaignsTable);
    const posts = await postsRepository.scanPublishedPosts();
    const createdCampaigns = [];
    let skippedCount = 0;

    for (const post of posts) {
      const now = new Date().toISOString();
      const campaign = buildCampaignDraftFromPost(post, now, cfg.siteBaseUrl);
      const created = await campaignsRepository.putDraftIfAbsent(campaign);
      if (created) {
        createdCampaigns.push(toCampaignSummary(campaign));
      } else {
        skippedCount += 1;
      }
    }

    logInfo("newsletter_campaign_detection_completed", {
      scannedPosts: posts.length,
      createdCampaigns: createdCampaigns.length,
      skippedCampaigns: skippedCount
    });

    return json(200, {
      campaigns: createdCampaigns,
      created_count: createdCampaigns.length,
      skipped_count: skippedCount
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to detect newsletter campaigns");
  }
};
