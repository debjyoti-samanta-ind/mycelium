# Mycelium

A personal knowledge graph that grows itself. Drop a URL, and Mycelium reads the article, extracts the ideas, and connects them to everything you've read before — surfacing reinforcements, contradictions, evolutions, and unexpected cross-domain links.

## Required Secrets

Add these in your GitHub repo under Settings → Secrets and variables → Actions:

| Secret name | What it is | When needed |
|-------------|-----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key from platform.anthropic.com | Phase 1 |
| `GMAIL_USER` | Your Gmail address | Phase 3 |
| `GMAIL_APP_PASSWORD` | Gmail app password (Google Account → Security → App passwords) | Phase 3 |

## Setup

1. Clone this repo locally
2. Run `npm install`
3. Run `npm run dev` to start the app at localhost:5173
4. Add secrets to GitHub repo settings (see Required Secrets above)
5. Push to main — GitHub Actions agent workflows will run automatically from here

Note: this is a **private repo**. The app runs locally only. There is no public deployment during active development phases. A separate public repo (`mycelium`) will be created manually at Phase 7 as a one-time MVP snapshot with demo data.

## How to add an article

Paste the raw URL into the URL input field in the app. That's it. The system auto-prepends `r.jina.ai/` and handles fetching, reading, summarising, and connecting.

For paywalled articles: paste the article text directly into the text field instead.

## Daily workflow

```
cd ~/Mycelium
git pull          # get latest processed articles from GitHub Actions
npm run dev       # open app at localhost:5173
```

## Build phases

| Phase | What it adds |
|-------|-------------|
| 1 | URL intake, article processing, article list view |
| 2 | Connection finding, interactive knowledge graph |
| 3 | Opinion tracker, surprise email alerts |
| 4 | Weekly/monthly digests, time-filtered graph |
| 5 | Books (parked) |
| 6 | Dashboard with momentum tracking |
| 7 | Public repo MVP export with demo data (after Phase 4) |

## Cost

Target: ~$1–2/month at steady state (5 articles/week).
All agent jobs run on GitHub Actions (free on GitHub Pro education plan).
Claude API costs are minimised by passing summaries only — never full article text — to connection and synthesis agents.
