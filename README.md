# Mycelium

A personal knowledge graph that grows with your reading. Paste a URL — Mycelium reads the article, extracts its ideas, and connects them to everything you’ve read before. It surfaces reinforcements, contradictions, evolutions, and unexpected cross-domain links across your entire reading history.

**[Live demo →](https://debjyoti-samanta-ind.github.io/mycelium/)** *(read-only — shows my real knowledge graph)*

---

## What it does

1. **Ingests articles** — paste a URL, GitHub Actions fetches and processes it with Claude Haiku, extracts structured metadata: summary, central argument, key claims, tensions, domain, and stance
2. **Finds connections** — Claude Sonnet evaluates every new article against all existing ones using a four-test quality framework (specific claims, direct relationship, non-derivability, non-generality), looking for non-obvious cross-domain links
3. **Runs agents** — autonomous tool-use loops that surface things you’d miss:
   - **Reprise** — an old article that has become newly relevant because of what you just added
   - **Steelman** — the strongest possible counter-argument to your graph’s dominant consensus, built from your own articles
   - **Blind Spot** — the most important adjacent domain you’re systematically ignoring
4. **Visualises the graph** — an interactive force-directed map of your ideas and how they relate

---

## Architecture

- **Frontend:** React + Vite + Tailwind CSS — runs locally via `npm run dev`, no deployment needed for personal use
- **Data:** JSON flat files in `/data/` — articles, graph, digests, agent outputs. No database, no backend.
- **Agents:** GitHub Actions workflows triggered on each article push, weekly, and monthly
- **Models:** Claude Haiku for ingestion, Claude Sonnet for connection-finding and agent reasoning loops

All article data is bundled at build time via `import.meta.glob` — the frontend is a fully static site.

---

## Fork and run it yourself

### Prerequisites
- A GitHub account
- An [Anthropic API key](https://platform.anthropic.com)
- A Gmail account for email alerts (optional — only needed for the Reprise agent and weekly alerts)

### 1. Fork this repo

Click **Fork** on GitHub. Keep all files including `/data/` — you’ll replace the demo articles as you add your own.

### 2. Add GitHub Secrets

In your fork: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Description | Required |
|--------|-------------|----------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Yes |
| `GMAIL_USER` | Gmail address to send alerts from | For email features |
| `GMAIL_APP_PASSWORD` | Google Account → Security → App passwords | For email features |
| `GMAIL_RECIPIENT` | Email address to receive alerts and agent outputs | For email features |

### 3. Create a GitHub Personal Access Token

The local app writes to your repo to trigger ingestion workflows.

1. GitHub → **Settings → Developer settings → Fine-grained tokens → Generate new token**
2. Repository access: your fork only
3. Permissions → Repository permissions: **Contents** → Read and write
4. Copy the token — you won’t see it again

### 4. Set up local environment

```bash
npm install
```

Create `.env.local` in the project root (this file is gitignored):

```
VITE_GITHUB_TOKEN=your_token_here
VITE_GITHUB_REPO=your-username/your-fork-name
```

### 5. Run

```bash
npm run dev        # app at localhost:5174
npm run watch      # (optional, second terminal) auto-pulls remote changes every 5 min
```

### 6. Add your first article

Open `localhost:5174`, paste any article URL, and click Submit. GitHub Actions picks it up within ~1 minute. Pull the result with `git pull` or let `npm run watch` do it automatically.

---

## Agent status

| Agent | Status | What it does |
|-------|--------|-------------|
| Reprise | Live | After each new article, surfaces one older piece that now means something different |
| Steelman | Paused | Writes the strongest counter-argument to your graph’s dominant consensus |
| Blind Spot | Planned | Identifies the most important adjacent domain you’re systematically ignoring |

---

## Build phases

| Phase | Status | What it adds |
|-------|--------|-------------|
| 1 | Complete | URL intake, article processing, article list |
| 2 | Complete | Connection finding, interactive knowledge graph |
| 3 | Complete | Weekly surprise email alerts |
| 4 | Complete | Monthly digests (emailed + in-app), time-filtered graph |
| 5 | Parked | Books as anchor nodes |
| 6 | Complete | Dashboard with reading momentum tracking |
| 7 | In Progress | Autonomous learning agents (Reprise, Steelman, Blind Spot) |
| 8 | Parked | Standalone public demo repo |

---

## Cost

Target: ~$1–2/month at steady state (5 articles/week).
All agent jobs run on GitHub Actions free tier.
Claude API costs are kept low by passing article summaries and claims only — never full article text — to connection-finding and synthesis agents.
