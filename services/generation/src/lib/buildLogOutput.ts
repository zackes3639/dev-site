const HYPE_PATTERNS = [
  /revolutionary/i,
  /game[-\s]?changing/i,
  /best[-\s]?in[-\s]?class/i,
  /world[-\s]?class/i,
  /cutting[-\s]?edge/i,
  /disrupt(?:ive|ing)?/i,
  /10x/i
];

const STARTUP_SPEAK_PATTERNS = [
  /unlock(?:ing)? value/i,
  /leverage(?:d|s|ing)?/i,
  /synerg(?:y|ies)/i,
  /north star/i,
  /move fast/i,
  /paradigm(?: shift)?/i
];

const MATURITY_OVERSTATE_PATTERNS = [
  /production[-\s]?ready/i,
  /enterprise[-\s]?ready/i,
  /fully automated/i,
  /fully scalable/i,
  /battle[-\s]?tested/i,
  /zero[-\s]?downtime/i,
  /guarantee(?:d)?/i
];

const UNSUPPORTED_CLAIM_TERMS = [
  "customers",
  "users",
  "revenue",
  "arr",
  "mrr",
  "general availability",
  "ga",
  "sla",
  "soc 2",
  "compliance",
  "enterprise"
] as const;

const REQUIRED_SECTION_HEADINGS = ["## What Changed", "## Technical Notes", "## Risks and Next Steps"] as const;

export interface ParsedBuildLogOutput {
  title: string;
  summary: string;
  slug?: string;
  body_markdown: string;
}

export interface NormalizedBuildLogOutput {
  title: string;
  summary: string;
  slug: string;
  bodyMarkdown: string;
}

const ensurePeriod = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const stripCodeFences = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```") || !trimmed.endsWith("```")) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
};

const extractJsonSlice = (raw: string): string | null => {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) {
    return null;
  }

  return raw.slice(start, end + 1);
};

const tryParseObject = (candidate: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
};

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeSummary = (value: string): string => {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= 320) {
    return ensurePeriod(compact);
  }

  return ensurePeriod(compact.slice(0, 317).trim())
    .replace(/\.\.$/, ".")
    .slice(0, 320);
};

const buildTitleFromBullets = (bullets: string[]): string => {
  const first = bullets[0] ?? "Daily Build Log";
  const cleaned = first
    .replace(/^[\-\*\d\.\)\s]+/, "")
    .replace(/[:;,.!?]+$/g, "")
    .trim();

  if (cleaned.length === 0) {
    return "Daily Build Log Update";
  }

  const words = cleaned.split(/\s+/).slice(0, 8);
  const title = words.join(" ");
  return title.charAt(0).toUpperCase() + title.slice(1);
};

const buildSummaryFromBullets = (bullets: string[]): string => {
  const [a, b, c] = bullets.map((bullet) => bullet.replace(/\s+/g, " ").trim());
  return normalizeSummary(
    `Today focused on ${a || "core implementation work"}. Additional progress covered ${b || "supporting updates"} and ${c || "review preparation"}.`
  );
};

const toSlug = (title: string): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return slug.length > 0 ? slug.slice(0, 120) : "build-log-update";
};

const ensureSectionedBody = (bodyMarkdown: string, bullets: string[]): string => {
  const normalized = bodyMarkdown.replace(/\r\n/g, "\n").trim();
  const hasAllSections = REQUIRED_SECTION_HEADINGS.every((heading) => normalized.includes(heading));
  if (normalized.length > 0 && hasAllSections) {
    return normalized;
  }

  const bulletLines = bullets.map((bullet) => `- ${ensurePeriod(bullet)}`).join("\n");
  return [
    "## What Changed",
    bulletLines,
    "",
    "## Technical Notes",
    "These updates are based only on today's three input bullets. Additional implementation details were not specified in the input.",
    "",
    "## Risks and Next Steps",
    "Potential risks and unknowns were not specified in today's input. Next step is to review this draft and fill any missing operational detail before publishing."
  ].join("\n");
};

const matchesPattern = (text: string, patterns: RegExp[]): boolean => {
  return patterns.some((pattern) => pattern.test(text));
};

export const collectGuardrailIssues = (output: NormalizedBuildLogOutput, bullets: string[]): string[] => {
  const issues: string[] = [];
  const combined = `${output.title}\n${output.summary}\n${output.bodyMarkdown}`;
  const combinedLower = combined.toLowerCase();
  const bulletsLower = bullets.join("\n").toLowerCase();

  if (matchesPattern(combined, HYPE_PATTERNS)) {
    issues.push("hype_language");
  }

  if (matchesPattern(combined, STARTUP_SPEAK_PATTERNS)) {
    issues.push("vague_startup_speak");
  }

  if (matchesPattern(combined, MATURITY_OVERSTATE_PATTERNS)) {
    issues.push("maturity_overstatement");
  }

  const unsupportedClaims = UNSUPPORTED_CLAIM_TERMS.filter(
    (term) => combinedLower.includes(term) && !bulletsLower.includes(term)
  );
  if (unsupportedClaims.length > 0) {
    issues.push(`unsupported_claim_terms:${unsupportedClaims.join(",")}`);
  }

  return Array.from(new Set(issues));
};

export const parseBuildLogStructuredOutput = (rawText: string): ParsedBuildLogOutput => {
  const candidates = [rawText, stripCodeFences(rawText)];
  const sliced = extractJsonSlice(stripCodeFences(rawText));
  if (sliced) {
    candidates.push(sliced);
  }

  for (const candidate of candidates) {
    const parsed = tryParseObject(candidate);
    if (!parsed) {
      continue;
    }

    const title = normalizeText(parsed.title);
    const summary = normalizeText(parsed.summary);
    const slug = normalizeText(parsed.slug);
    const body =
      normalizeText(parsed.body_markdown) ??
      normalizeText(parsed.body_md) ??
      normalizeText(parsed.content_md);

    if (title && summary && body) {
      return {
        title,
        summary,
        ...(slug ? { slug } : {}),
        body_markdown: body
      };
    }
  }

  throw new Error("Model output is not valid structured Build Log JSON");
};

export const normalizeBuildLogOutput = (
  parsed: ParsedBuildLogOutput,
  bullets: string[],
  targetWordCount: number
): NormalizedBuildLogOutput => {
  const fallbackTitle = buildTitleFromBullets(bullets);
  const title = parsed.title.trim().length >= 8 ? parsed.title.trim().slice(0, 140) : fallbackTitle;

  const fallbackSummary = buildSummaryFromBullets(bullets);
  const summary = parsed.summary.trim().length >= 40 ? normalizeSummary(parsed.summary) : fallbackSummary;

  const bodySource = parsed.body_markdown.trim().length >= Math.max(180, Math.floor(targetWordCount * 0.35))
    ? parsed.body_markdown
    : ensureSectionedBody("", bullets);

  const bodyMarkdown = ensureSectionedBody(bodySource, bullets);
  const slug = parsed.slug ? toSlug(parsed.slug) : toSlug(title);

  return {
    title,
    summary,
    slug,
    bodyMarkdown
  };
};

export const buildFallbackBuildLogOutput = (bullets: string[]): NormalizedBuildLogOutput => {
  const title = buildTitleFromBullets(bullets);
  const summary = buildSummaryFromBullets(bullets);
  const bodyMarkdown = ensureSectionedBody("", bullets);

  return {
    title,
    summary,
    slug: toSlug(title),
    bodyMarkdown
  };
};
