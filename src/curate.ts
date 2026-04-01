import OpenAI from "openai";
import { OPENAI_API_KEY, OPENAI_MODEL } from "./config.js";
import type { Story } from "./models.js";
import { renderNewsletterFallback } from "./formatNewsletter.js";

const client = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

type ShortlistSchema = {
  fortnight_brief: string;
  themes: string[];
  picks: Array<{ url: string; editor_note: string }>;
};

function byUrl(stories: Story[]): Map<string, Story> {
  const m = new Map<string, Story>();
  for (const s of stories) {
    if (!m.has(s.url)) m.set(s.url, s);
  }
  return m;
}

function parseShortlistJson(raw: string): ShortlistSchema | null {
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const r = o as Record<string, unknown>;
    const fortnight_brief =
      typeof r.fortnight_brief === "string" ? r.fortnight_brief : "";
    const themes = Array.isArray(r.themes)
      ? r.themes.filter((x): x is string => typeof x === "string")
      : [];
    const picksRaw = Array.isArray(r.picks) ? r.picks : [];
    const picks: ShortlistSchema["picks"] = [];
    for (const p of picksRaw) {
      if (!p || typeof p !== "object") continue;
      const q = p as Record<string, unknown>;
      const url = typeof q.url === "string" ? q.url : "";
      const editor_note =
        typeof q.editor_note === "string" ? q.editor_note : "";
      if (url && editor_note) picks.push({ url, editor_note });
    }
    if (!fortnight_brief || picks.length === 0) return null;
    return { fortnight_brief, themes, picks };
  } catch {
    return null;
  }
}

async function agentShortlist(candidates: Story[]): Promise<ShortlistSchema | null> {
  if (!client) return null;
  const payload = candidates.map((s) => ({
    title: s.title,
    url: s.url,
    category: s.category,
    source: s.source,
  }));
  const user = [
    "Candidate stories for this edition (JSON array). Each url must appear verbatim if selected.",
    JSON.stringify(payload),
    "",
    'Return ONLY valid JSON with this shape:',
    '{"fortnight_brief":"2-4 sentences: what mattered in dev/tech this fortnight (no links).","themes":["short theme 1","theme 2"],"picks":[{"url":"exact url from input","editor_note":"one line why readers should care"}]}',
    "Rules: pick 8–14 items. Maximize diversity across categories; drop near-duplicates; prefer substantive engineering, research, or community signal over pure hype.",
  ].join("\n");

  const res = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are Agent 1: a senior editor shortlisting a bi-weekly developer newsletter. Output strict JSON only.",
      },
      { role: "user", content: user },
    ],
  });
  const text = res.choices[0]?.message?.content?.trim();
  if (!text) return null;
  return parseShortlistJson(text);
}

async function agentWriteNewsletter(
  shortlist: ShortlistSchema,
  storiesByUrl: Map<string, Story>,
): Promise<string | null> {
  if (!client) return null;
  const enriched = shortlist.picks.map((p) => {
    const s = storiesByUrl.get(p.url);
    return {
      url: p.url,
      title: s?.title ?? p.url,
      category: s?.category ?? "?",
      source: s?.source ?? "?",
      editor_note: p.editor_note,
    };
  });

  const user = [
    "Use this shortlisted JSON (with editor notes) to write the final newsletter body:",
    JSON.stringify({
      fortnight_brief: shortlist.fortnight_brief,
      themes: shortlist.themes,
      picks: enriched,
    }),
    "",
    "Formatting for Discord (markdown):",
    "- Start with one title line: **Bi-weekly dev digest — YYYY-MM-DD** (use today's UTC date).",
    "- ### From the editors — expand fortnight_brief slightly (still no new factual claims).",
    "- ### Themes — bullets from themes; you may merge or rephrase briefly.",
    "- ### Picks — for each pick: **[Title](url)** as a clickable heading (title text links to the EXACT url), then 1–2 sentences of hook (combine editor_note + your voice). Do NOT repeat the link after the hook.",
    "- Use ONLY urls from picks. No new links, no footnotes, no code blocks.",
    "- Keep total under 3500 characters if possible; tight prose.",
  ].join("\n");

  const res = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content:
          "You are Agent 2: newsletter writer. You turn a structured shortlist into a readable Discord markdown digest. Never invent URLs or facts not implied by the input.",
      },
      { role: "user", content: user },
    ],
  });
  const body = res.choices[0]?.message?.content?.trim();
  return body || null;
}

/**
 * Two-step curation: editor shortlist → writer. Falls back to formatted link list
 * if no API key or LLM output is invalid.
 */
export async function curateBiweeklyNewsletter(stories: Story[]): Promise<{
  body: string;
  mode: "curated" | "fallback";
  candidateCount: number;
}> {
  const candidateCount = stories.length;
  if (stories.length === 0) {
    return {
      body: renderNewsletterFallback([]),
      mode: "fallback",
      candidateCount: 0,
    };
  }

  if (!client) {
    console.warn(
      "[curation] OPENAI_API_KEY missing — using uncurated link digest.",
    );
    return {
      body: renderNewsletterFallback(stories),
      mode: "fallback",
      candidateCount,
    };
  }

  const shortlist = await agentShortlist(stories);
  if (!shortlist) {
    console.warn("[curation] shortlist parse failed — fallback.");
    return {
      body: renderNewsletterFallback(stories),
      mode: "fallback",
      candidateCount,
    };
  }

  const map = byUrl(stories);
  const filteredPicks = shortlist.picks.filter((p) => map.has(p.url));
  if (filteredPicks.length === 0) {
    console.warn("[curation] no valid urls in shortlist — fallback.");
    return {
      body: renderNewsletterFallback(stories),
      mode: "fallback",
      candidateCount,
    };
  }

  const safeShortlist: ShortlistSchema = {
    ...shortlist,
    picks: filteredPicks,
  };

  const body = await agentWriteNewsletter(safeShortlist, map);
  if (!body) {
    console.warn("[curation] writer empty — fallback.");
    return {
      body: renderNewsletterFallback(stories),
      mode: "fallback",
      candidateCount,
    };
  }

  return { body, mode: "curated", candidateCount };
}
