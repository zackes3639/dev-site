import type {
  NewsletterCampaignItem,
  NewsletterCampaignSourcePost,
  NewsletterCampaignSummary
} from "@briefly/contracts";

export const UNSUBSCRIBE_URL_PLACEHOLDER = "{{unsubscribe_url}}";

const trimBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, "");

export const buildPostUrl = (siteBaseUrl: string, slug: string): string => {
  return `${trimBaseUrl(siteBaseUrl)}/blog/post/?slug=${encodeURIComponent(slug)}`;
};

export const buildUnsubscribeUrl = (siteBaseUrl: string, email: string, token: string): string => {
  return `${trimBaseUrl(siteBaseUrl)}/unsubscribe/?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
};

export const buildDefaultCampaignSubject = (title: string): string => {
  return `The Build Log: ${title}`;
};

export const buildDefaultCampaignBody = (post: NewsletterCampaignSourcePost, sourceUrl: string): string => {
  return [
    post.summary,
    "",
    "Read the full post:",
    sourceUrl,
    "",
    "You are receiving this because you subscribed to The Build Log.",
    "",
    "Unsubscribe:",
    UNSUBSCRIBE_URL_PLACEHOLDER
  ].join("\n");
};

export const buildCampaignDraftFromPost = (
  post: NewsletterCampaignSourcePost,
  now: string,
  siteBaseUrl: string
): NewsletterCampaignItem => {
  const sourceUrl = buildPostUrl(siteBaseUrl, post.slug);
  const campaign: NewsletterCampaignItem = {
    campaign_id: `post#${post.post_id}`,
    source: "legacy_post",
    source_post_id: post.post_id,
    source_slug: post.slug,
    source_title: post.title,
    source_summary: post.summary,
    source_content: post.content,
    source_url: sourceUrl,
    subject: buildDefaultCampaignSubject(post.title),
    body: buildDefaultCampaignBody(post, sourceUrl),
    status: "draft",
    version: 1,
    detected_at: now,
    created_at: now,
    updated_at: now
  };

  return campaign;
};

export const renderCampaignBody = (body: string, unsubscribeUrl: string): string => {
  if (body.includes(UNSUBSCRIBE_URL_PLACEHOLDER)) {
    return body.replaceAll(UNSUBSCRIBE_URL_PLACEHOLDER, unsubscribeUrl);
  }

  return [body.trimEnd(), "", "Unsubscribe:", unsubscribeUrl].join("\n");
};

export const toCampaignSummary = (campaign: NewsletterCampaignItem): NewsletterCampaignSummary => {
  const summary: NewsletterCampaignSummary = {
    campaign_id: campaign.campaign_id,
    source_post_id: campaign.source_post_id,
    source_slug: campaign.source_slug,
    source_title: campaign.source_title,
    source_summary: campaign.source_summary,
    source_url: campaign.source_url,
    subject: campaign.subject,
    status: campaign.status,
    version: campaign.version,
    created_at: campaign.created_at,
    updated_at: campaign.updated_at
  };

  if (campaign.test_sent_at) {
    summary.test_sent_at = campaign.test_sent_at;
  }
  if (campaign.sent_at) {
    summary.sent_at = campaign.sent_at;
  }
  if (campaign.failed_at) {
    summary.failed_at = campaign.failed_at;
  }
  if (typeof campaign.total_recipients === "number") {
    summary.total_recipients = campaign.total_recipients;
  }
  if (typeof campaign.delivered_count === "number") {
    summary.delivered_count = campaign.delivered_count;
  }
  if (typeof campaign.failed_count === "number") {
    summary.failed_count = campaign.failed_count;
  }
  if (typeof campaign.skipped_count === "number") {
    summary.skipped_count = campaign.skipped_count;
  }

  return summary;
};
