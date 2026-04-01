# Bi-weekly dev newsletter

Gathers developer-facing links (Hacker News, dev feeds, **RSS/Atom newsletters**, trending GitHub repos, arXiv CS), optionally **curates** them with two OpenAI steps (shortlist + writer), then:

- **Discord** — posts to a channel via webhook (optional).
- **GitHub Releases** — creates a release with the digest as the **release body** and a **`digest.md`** attachment (always, in CI).

Runs on a schedule in GitHub Actions (1st and 15th of each month, 09:00 UTC) or manually.

## Requirements

- Node **20+** (CI uses 22).
- A GitHub repository with **Actions** enabled (for automation).

## Local quick start

```bash
cp .env.example .env
# Edit .env — see sections below

npm install
DRY_RUN=1 npm run dry-run    # preview in terminal only
npm start                    # needs real env if you want Discord or artifact
```

## RSS feeds

Default feeds (when `RSS_FEED_URLS` is **unset**):

| Source | URL |
|--------|-----|
| Hugging Face Blog | `https://huggingface.co/blog/feed.xml` |
| Google AI Blog | `https://blog.google/technology/ai/rss/` |
| MIT Technology Review | `https://www.technologyreview.com/feed/` |

- **`RSS_FEED_URLS`** — comma- or newline-separated list of feed URLs. Set it in `.env` to add or replace feeds:

  ```bash
  RSS_FEED_URLS=https://huggingface.co/blog/feed.xml,https://openai.com/blog/rss/
  ```

- To **disable** RSS ingestion, set an **empty** value:

  ```bash
  RSS_FEED_URLS=
  ```

Noise titles (e.g. "subscribe now") are skipped.

## Discord setup

You do **not** need a Discord “application” or bot token to post. A **channel webhook** is enough.

1. Open your **Discord server**.
2. Open the **channel** where the newsletter should appear.
3. Click the **channel name** (or gear) → **Edit Channel** → **Integrations** → **Webhooks** → **New Webhook** (or **Create Webhook**).
4. Name it (e.g. “Newsletter”), optionally pick an avatar, then **Copy Webhook URL**.
5. Put that URL in **`DISCORD_WEBHOOK_URL`**:
   - **Local:** in `.env` (see `.env.example`).
   - **CI:** repository **Settings → Secrets and variables → Actions → New repository secret** named `DISCORD_WEBHOOK_URL`.

**Omit the webhook** if you only want GitHub Releases and no Discord message; the workflow still completes.

### Permissions and limits

- The webhook only posts to **that channel**. If you need posting in multiple channels, create one webhook per channel and either extend the code or run separate configs.
- Discord truncates very long messages; the app splits content into multiple webhook payloads when needed (`MAX_MESSAGE_CHARS`, default 1800).

## GitHub Actions (CI)

Enable **Workflow permissions** so releases can be created:

**Settings → Actions → General → Workflow permissions** — choose **Read and write permissions** (needed for creating releases from `GITHUB_TOKEN`).

### Secrets

| Name | Required | Purpose |
|------|----------|---------|
| `DISCORD_WEBHOOK_URL` | No | Post digest to Discord; skip for release-only |
| `OPENAI_API_KEY` | No | Curated newsletter; without it, link-only fallback |

### Variables (optional)

| Name | Purpose |
|------|---------|
| `OPENAI_MODEL` | Override model (default in app: `gpt-4.1-mini`) |
| `RSS_FEED_URLS` | Optional override; blank value disables RSS (see **RSS feeds** above) |

### Triggers

- **Schedule:** `0 9 1,15 * *` (UTC) — 1st and 15th of each month.
- **Manual:** **Actions → Bi-weekly Discord newsletter → Run workflow**.

Each run writes `newsletter/digest.md` on the runner and publishes a **Release** with that content as the description and attachment.

## OpenAI curation

With **`OPENAI_API_KEY`** set, the pipeline runs:

1. **Shortlist** — JSON: brief, themes, 8–14 picks with URLs that must come from the fetched list.
2. **Writer** — Turns that into Discord-friendly markdown (no invented links).

Without the key, you get the **uncurated** grouped link digest (still valid for Discord and Releases).

## Forking: make it yours

After you **fork** this repository on GitHub, everything below applies to **your fork**, not the original.

1. **Clone your fork** (replace with your user and repo name):

   ```bash
   git clone git@github.com:YOUR_USER/YOUR_REPO.git
   cd YOUR_REPO
   ```

2. **Optional — detach old `origin` naming:** your fork’s default remote is already your repo. To add the original as upstream (for pulling updates):

   ```bash
   git remote add upstream https://github.com/avirajkhare00/newsletter.git
   git fetch upstream
   ```

   You only need `upstream` if you want to sync fixes from the original.

3. **Enable Actions** on the fork: **Settings → Actions → General** — allow workflows and **read/write** as above.

4. **Add your secrets** on the fork (**Settings → Secrets and variables → Actions**):

   - Your own **`DISCORD_WEBHOOK_URL`** (from *your* Discord server).
   - Your own **`OPENAI_API_KEY`** if you want curation.

   Secrets do **not** copy when you fork; you must create them on your repository.

5. **Releases and runs** — scheduled and manual runs operate on **your** default branch and create **Releases on your fork**. They are independent of the upstream repo.

6. **Customize** — change sources in `src/fetchers.ts`, prompts in `src/curate.ts`, cadence in `.github/workflows/biweekly-newsletter.yml`, or package metadata in `package.json`.
