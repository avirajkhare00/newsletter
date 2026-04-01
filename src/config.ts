import "dotenv/config";

const t = (v: string | undefined) => (v ?? "").trim();

/** Legacy AINews (smol.ai) archive; news.smol.ai has no first-party RSS. */
const DEFAULT_RSS_FEED_URLS = ["https://buttondown.com/ainews/rss"];

function parseUrlList(raw: string | undefined, fallback: string[]): string[] {
  if (raw === undefined) return [...fallback];
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const DISCORD_WEBHOOK_URL = t(process.env.DISCORD_WEBHOOK_URL);
export const MAX_MESSAGE_CHARS = Number(process.env.MAX_MESSAGE_CHARS ?? 1800);
export const DRY_RUN = ["1", "true", "yes"].includes(
  t(process.env.DRY_RUN).toLowerCase(),
);

/** OpenAI — used for two-agent curation (shortlist + writer). */
export const OPENAI_API_KEY = t(process.env.OPENAI_API_KEY);
export const OPENAI_MODEL = t(process.env.OPENAI_MODEL) || "gpt-4o-mini";

/** If set, the rendered digest is written here (parent dirs created as needed). */
export const NEWSLETTER_ARTIFACT_PATH = t(process.env.NEWSLETTER_ARTIFACT_PATH);

/**
 * Extra RSS/Atom feeds (comma or newline separated).
 * If env is unset, defaults to legacy AINews Buttondown RSS. Set to empty to disable.
 */
export const RSS_FEED_URLS = parseUrlList(
  process.env.RSS_FEED_URLS,
  DEFAULT_RSS_FEED_URLS,
);
