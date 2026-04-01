import type { Story } from "./models.js";
import { Category } from "./models.js";

function lineForDiscord(s: Story, idx: number): string {
  let safe = s.title.replace(/\n/g, " ");
  if (safe.length > 200) safe = safe.slice(0, 197) + "…";
  return `\`${idx}.\` [${safe}](${s.url})`;
}

const ORDER: string[] = [
  Category.HACKER_NEWS,
  Category.DEV_COMMUNITY,
  Category.RSS_FEEDS,
  Category.OPEN_SOURCE,
  Category.RESEARCH,
];

/** Uncurated fallback when LLM is off or fails. */
export function renderNewsletterFallback(stories: Story[]): string {
  if (stories.length === 0)
    return "**Bi-weekly digest**\n_No stories fetched this run._";

  const week = new Date().toISOString().slice(0, 10);
  const lines: string[] = [
    `**Bi-weekly dev digest — ${week}** _(uncurated)_`,
    "",
  ];
  const byCat = new Map<string, Story[]>();
  for (const s of stories) {
    const list = byCat.get(s.category) ?? [];
    list.push(s);
    byCat.set(s.category, list);
  }
  for (const cat of ORDER) {
    const items = byCat.get(cat);
    if (!items?.length) continue;
    lines.push(`**${cat}**`);
    items.forEach((s, i) => lines.push(lineForDiscord(s, i + 1)));
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
