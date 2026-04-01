import "dotenv/config";

const t = (v: string | undefined) => (v ?? "").trim();

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
