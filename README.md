# Mycelium

A personal knowledge graph that grows itself. Drop a URL, and Mycelium reads the article, extracts the ideas, and connects them to everything you've read before — surfacing reinforcements, contradictions, evolutions, and unexpected cross-domain links.

---

## First-time setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a GitHub Personal Access Token (PAT)

The app needs permission to write to your repo when you submit a URL. This is a one-time step.

1. Go to **github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Click **Generate new token**
3. Set a name (e.g. `mycelium-local`) and an expiry (1 year is fine)
4. Under **Repository access**, choose **Only select repositories** and pick `mycelium-private`
5. Under **Permissions → Repository permissions**, set **Contents** to **Read and write**
6. Click **Generate token** and copy it — you won't see it again

### 3. Create your `.env.local` file

In the project root, create a file called `.env.local` (not committed to git):

```
VITE_GITHUB_TOKEN=your_token_here
VITE_GITHUB_REPO=debjyoti-samanta-ind/mycelium-private
```

Replace `your_token_here` with the token you just generated.

### 4. Add the Anthropic API key to GitHub Secrets

The ingestion workflow needs this to call Claude Haiku.

1. Go to your repo on GitHub → **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `ANTHROPIC_API_KEY` — Value: your key from platform.anthropic.com

### 5. Run the app

```bash
npm run dev
```

Open **localhost:5174** in your browser.

---

## Daily workflow

```bash
git pull          # pull any articles processed overnight by GitHub Actions
npm run dev       # open app at localhost:5174
```

---

## How to add an article

1. Open the app at localhost:5174
2. Paste the raw article URL into the input field and click **Submit**
3. GitHub Actions will process it automatically (usually within 1–2 minutes)
4. Run `git pull` then restart the dev server — the article appears in the Articles list

**If the URL is paywalled or r.jina.ai fails:** click the small link below the URL input and paste the article text directly instead.

---

## Required Secrets

Add these in your GitHub repo under **Settings → Secrets and variables → Actions**:

| Secret name | What it is | When needed |
|-------------|-----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key from platform.anthropic.com | Phase 1 |
| `GMAIL_USER` | Gmail address used to send alerts | Phase 3 |
| `GMAIL_APP_PASSWORD` | Gmail app password (Google Account → Security → App passwords) | Phase 3 |
| `GMAIL_RECIPIENT` | Email address where you want to receive alerts (can be different from sender) | Phase 3 |

---

## Build phases

| Phase | What it adds |
|-------|-------------|
| 1 | URL intake, article processing, article list view |
| 2 | Connection finding, interactive knowledge graph |
| 3 | Opinion tracker, surprise email alerts |
| 4 | Monthly digests (emailed + in-app), time-filtered graph |
| 5 | Books (parked) |
| 6 | Dashboard with momentum tracking |
| 7 | Public repo MVP export with demo data (after Phases 1–6 complete) |

---

## Cost

Target: ~$1–2/month at steady state (5 articles/week).
All agent jobs run on GitHub Actions (free tier).
Claude API costs are minimised by passing summaries only — never full article text — to connection and synthesis agents.
