const trimEnv = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const requireEnv = (name: string): string => {
  const value = trimEnv(process.env[name]);
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
};

const requireAnyEnv = (names: string[]): string => {
  for (const name of names) {
    const value = trimEnv(process.env[name]);
    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required env var: ${names.join(" or ")}`);
};

const siteBaseUrl = (): string => {
  return (trimEnv(process.env.NEWSLETTER_SITE_BASE_URL) ?? "https://zacksimon.dev").replace(/\/+$/, "");
};

const replyToEmail = (): string | undefined => {
  return trimEnv(process.env.NEWSLETTER_REPLY_TO_EMAIL) ?? trimEnv(process.env.NEWSLETTER_REPLY_TO);
};

const fromEmailAddress = (): string => {
  const email = requireEnv("NEWSLETTER_FROM_EMAIL");
  const name = trimEnv(process.env.NEWSLETTER_FROM_NAME);

  return name ? `${name} <${email}>` : email;
};

export interface NewsletterCampaignsConfig {
  campaignsTable: string;
  siteBaseUrl: string;
}

export interface NewsletterDetectorConfig extends NewsletterCampaignsConfig {
  legacyPostsTable: string;
}

export interface NewsletterEmailConfig extends NewsletterCampaignsConfig {
  fromEmail: string;
  replyToEmail?: string;
}

export interface NewsletterTestSendConfig extends NewsletterEmailConfig {
  testRecipient: string;
}

export interface NewsletterPublicSendConfig extends NewsletterEmailConfig {
  deliveriesTable: string;
  subscribersTable: string;
  publicSendsEnabled: boolean;
}

export interface NewsletterPublicSendGateConfig extends NewsletterCampaignsConfig {
  publicSendsEnabled: boolean;
}

export const loadCampaignsConfig = (): NewsletterCampaignsConfig => ({
  campaignsTable: requireEnv("NEWSLETTER_CAMPAIGNS_TABLE"),
  siteBaseUrl: siteBaseUrl()
});

export const loadDetectorConfig = (): NewsletterDetectorConfig => ({
  ...loadCampaignsConfig(),
  legacyPostsTable: requireAnyEnv(["NEWSLETTER_POSTS_TABLE", "LEGACY_BLOG_POSTS_TABLE"])
});

const loadEmailConfig = (): NewsletterEmailConfig => {
  const base = {
    ...loadCampaignsConfig(),
    fromEmail: fromEmailAddress()
  };
  const replyTo = replyToEmail();

  return replyTo ? { ...base, replyToEmail: replyTo } : base;
};

export const loadTestSendConfig = (): NewsletterTestSendConfig => ({
  ...loadEmailConfig(),
  testRecipient: requireEnv("NEWSLETTER_TEST_RECIPIENT")
});

export const loadPublicSendGateConfig = (): NewsletterPublicSendGateConfig => ({
  ...loadCampaignsConfig(),
  publicSendsEnabled: String(process.env.NEWSLETTER_PUBLIC_SENDS_ENABLED ?? "").toLowerCase() === "true"
});

export const loadPublicSendConfig = (): NewsletterPublicSendConfig => {
  const gate = loadPublicSendGateConfig();

  return {
    ...loadEmailConfig(),
    deliveriesTable: requireEnv("NEWSLETTER_DELIVERIES_TABLE"),
    subscribersTable: requireEnv("NEWSLETTER_SUBSCRIBERS_TABLE"),
    publicSendsEnabled: gate.publicSendsEnabled
  };
};
