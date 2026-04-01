import Parser from "rss-parser";
import { RSS_FEED_URLS } from "./config.js";
import type { Story } from "./models.js";
import { Category } from "./models.js";

const UA = { "User-Agent": "weekly-dev-newsletter/0.1 (discord digest)" };
const HN_TOP = "https://hacker-news.firebaseio.com/v0/topstories.json";
const HN_ITEM = (id: number) =>
  `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
const GITHUB_SEARCH = "https://api.github.com/search/repositories";
const DEVTO = "https://dev.to/api/articles";
/** daily.dev public RSS URLs change; we try a few community feeds. */
const DEV_FEED_RSS_URLS = [
  "https://daily.dev/rss.xml",
  "https://lobste.rs/rss",
];

const rss = new Parser();

function rssNoiseTitle(title: string): boolean {
  return /we have moved|please help us move/i.test(title);
}

function feedSourceLabel(feedUrl: string, feedTitle?: string): string {
  try {
    return new URL(feedUrl).hostname.replace(/^www\./, "");
  } catch {
    return (feedTitle ?? "rss").replace(/\s+/g, " ").slice(0, 48);
  }
}

/** Fetches configured RSS/Atom feeds (see RSS_FEED_URLS in config). */
export async function fetchConfiguredRssFeeds(
  urls: string[],
  perFeed = 5,
): Promise<Story[]> {
  if (!urls.length) return [];
  const out: Story[] = [];
  for (const feedUrl of urls) {
    const r = await fetch(feedUrl, { headers: UA });
    if (!r.ok) throw new Error(`${feedUrl}: ${r.status}`);
    const text = await r.text();
    const feed = await rss.parseString(text);
    const source = feedSourceLabel(feedUrl, feed.title);
    let n = 0;
    for (const e of feed.items) {
      if (n >= perFeed) break;
      const title = (e.title ?? "").replace(/\n/g, " ").trim();
      let link = (e.link ?? "").trim();
      if (Array.isArray(e.links) && e.links[0]?.href)
        link = String(e.links[0].href).trim() || link;
      if (!title || !link || rssNoiseTitle(title)) continue;
      out.push({
        title,
        url: link,
        category: Category.RSS_FEEDS,
        source,
      });
      n++;
    }
  }
  return out;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { ...UA, ...init?.headers } });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json() as Promise<T>;
}

export async function fetchHackerNews(limit = 8): Promise<Story[]> {
  const ids = (await fetchJson<number[]>(HN_TOP)).slice(0, limit);
  const out: Story[] = [];
  for (const id of ids) {
    const item = await fetchJson<{
      type?: string;
      title?: string;
      url?: string;
    }>(HN_ITEM(id));
    if (item.type !== "story") continue;
    const title = (item.title ?? "").trim();
    const url =
      item.url?.trim() || `https://news.ycombinator.com/item?id=${id}`;
    if (title)
      out.push({
        title,
        url,
        category: Category.HACKER_NEWS,
        source: "news.ycombinator.com",
      });
  }
  return out;
}

export async function fetchArxiv(limit = 5): Promise<Story[]> {
  const q = encodeURIComponent("(cat:cs.AI OR cat:cs.LG OR cat:cs.CL)");
  const base = `https://export.arxiv.org/api/query`;
  const url = `${base}?search_query=${q}&sortBy=submittedDate&sortOrder=descending&max_results=${limit}`;
  let r: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    r = await fetch(url, { headers: UA });
    if (r.ok) break;
    if (r.status !== 429 && r.status !== 503) break;
    await new Promise((res) => setTimeout(res, 5000 * (attempt + 1)));
  }
  if (!r?.ok) throw new Error(`arxiv: ${r?.status ?? "no response"}`);
  const text = await r.text();
  const feed = await rss.parseString(text);
  const out: Story[] = [];
  for (const e of feed.items.slice(0, limit)) {
    const title = (e.title ?? "").replace(/\n/g, " ").trim();
    const link = (e.link ?? "").trim();
    if (title && link)
      out.push({
        title,
        url: link,
        category: Category.RESEARCH,
        source: "arxiv.org",
      });
  }
  return out;
}

export async function fetchGithubTrending(limit = 6): Promise<Story[]> {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const q = encodeURIComponent(`created:>${since}`);
  const url = `${GITHUB_SEARCH}?q=${q}&sort=stars&order=desc&per_page=${limit}`;
  const data = await fetchJson<{
    items?: Array<{ full_name?: string; html_url?: string; description?: string }>;
  }>(url);
  const out: Story[] = [];
  for (const repo of data.items ?? []) {
    const name = repo.full_name ?? "";
    const htmlUrl = repo.html_url ?? "";
    const desc = (repo.description ?? "").trim();
    let title = name + (desc ? ` — ${desc}` : "");
    if (title.length > 300) title = title.slice(0, 297) + "…";
    if (name && htmlUrl)
      out.push({
        title,
        url: htmlUrl,
        category: Category.OPEN_SOURCE,
        source: "github.com",
      });
  }
  return out;
}

export async function fetchDevTo(limit = 6): Promise<Story[]> {
  const url = `${DEVTO}?top=7&per_page=${limit}`;
  const rows = await fetchJson<
    Array<{ title?: string; url?: string }>
  >(url, { headers: { Accept: "application/json" } });
  const out: Story[] = [];
  for (const a of rows.slice(0, limit)) {
    const title = (a.title ?? "").trim();
    const u = (a.url ?? "").trim();
    if (title && u)
      out.push({
        title,
        url: u,
        category: Category.DEV_COMMUNITY,
        source: "dev.to",
      });
  }
  return out;
}

export async function fetchDevFeedRss(limit = 4): Promise<Story[]> {
  let lastErr: unknown;
  for (const feedUrl of DEV_FEED_RSS_URLS) {
    try {
      const r = await fetch(feedUrl, { headers: UA });
      if (!r.ok) throw new Error(`${feedUrl}: ${r.status}`);
      const text = await r.text();
      const feed = await rss.parseString(text);
      const out: Story[] = [];
      const source =
        feedUrl.includes("daily.dev") ? "daily.dev" : "lobste.rs";
      for (const e of feed.items.slice(0, limit)) {
        const title = (e.title ?? "").trim();
        const link = (e.link ?? "").trim();
        if (title && link)
          out.push({
            title,
            url: link,
            category: Category.DEV_COMMUNITY,
            source,
          });
      }
      if (out.length) return out;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("dev feed rss: all fallbacks failed");
}

async function safe(
  label: string,
  fn: () => Promise<Story[]>,
): Promise<Story[]> {
  try {
    return await fn();
  } catch (e) {
    console.warn(`[${label}] skipped:`, e instanceof Error ? e.message : e);
    return [];
  }
}

export async function gatherAll(): Promise<Story[]> {
  const [hn, gh, dev, daily, rssExtra] = await Promise.all([
    safe("hacker_news", fetchHackerNews),
    safe("github", fetchGithubTrending),
    safe("dev_to", fetchDevTo),
    safe("dev_feed_rss", fetchDevFeedRss),
    safe("rss_feeds", () => fetchConfiguredRssFeeds(RSS_FEED_URLS)),
  ]);
  // arXiv rate-limits bursty parallel traffic; run after other fetches.
  await new Promise((r) => setTimeout(r, 2500));
  const ax = await safe("arxiv", fetchArxiv);
  return [...hn, ...daily, ...dev, ...rssExtra, ...gh, ...ax];
}
