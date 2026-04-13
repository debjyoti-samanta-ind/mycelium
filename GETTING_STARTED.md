# Getting started with Mycelium in Claude Code

## Before your first session

### 1. Create the private GitHub repo
- Go to github.com → New repository
- Name it `mycelium-private`
- Set it to **Private** — this is non-negotiable, your reading data lives here
- Do not initialise with a README (you already have one)
- Push this folder to it:
  ```
  git init
  git add .
  git commit -m "Initial Mycelium scaffold"
  git remote add origin https://github.com/YOUR_USERNAME/mycelium-private.git
  git push -u origin main
  ```

### 2. Add your Anthropic API key as a secret
- Go to your repo → Settings → Secrets and variables → Actions
- Add `ANTHROPIC_API_KEY` (get from platform.anthropic.com)
- Set a **$5/month spend limit** in the Anthropic console while you're there — go to platform.anthropic.com → Settings → Limits
- Gmail secrets come in Phase 3 — don't worry about them now

### 3. Install Node.js if you don't have it
- Check: `node --version` in your terminal
- If missing: download from nodejs.org (LTS version)
- **Do not run `npm install` yourself** — Claude Code will do this as part of Phase 1 scaffolding

### 4. Verify you are ready to start
- Confirm the repo exists at `github.com/debjyoti-samanta-ind/mycelium-private`
- Confirm `ANTHROPIC_API_KEY` is visible under repo Settings → Secrets and variables → Actions
- Confirm `node --version` returns a version number in your terminal
- **Do not run `npm install` or `npm run dev` yet** — Claude Code handles both during Phase 1 scaffolding

---

## Note on the two-repo strategy

Right now you only need the private repo. The public repo (`mycelium`) gets created manually at Phase 7, after Phases 1–4 are complete. At that point you copy `/src` across, seed it with fictional demo data, and deploy to GitHub Pages. Until then, ignore the public repo entirely.

The GitHub Actions agent workflows (ingestion, connections, opinions, alerts, digests) all run in the **private repo**. Your data never touches the public repo.

---

## Starting Claude Code

Open your terminal, navigate to the Mycelium folder, and run:
```
cd ~/Mycelium
claude
```

### Your first message to Claude Code

Copy and paste this exactly:

---

We are building Mycelium — a personal knowledge graph. Read CLAUDE.md fully before doing anything else.

We are starting Phase 1. The goal of Phase 1 is:
1. Scaffold a React + Vite + Tailwind app (light theme only, no dark mode, no GitHub Pages deployment)
2. The app runs locally via npm run dev — localhost:5174
3. Build a URL submission form that commits URLs to data/queue.json via the GitHub API
4. Build a GitHub Actions ingestion workflow that triggers on queue.json changes, fetches article text via r.jina.ai (auto-prepended — user always pastes raw URLs), calls Claude Haiku to extract structured data, and saves to data/articles/
5. Build an article list page showing all processed articles, reading from data/articles/

Before writing any code, summarise what you understand and ask me any clarifying questions. Do not start building until I confirm.

---

Claude Code will read CLAUDE.md, summarise its plan, and ask at least one question before touching any files.

---

## How to run each phase session

Start every new phase with:
```
We are continuing Mycelium. Read CLAUDE.md. We are now starting Phase [N].
[Paste the Phase N Claude Code prompt from the build plan]
Before writing any code, summarise your understanding and ask me any questions.
```

---

## Daily workflow once the app is built

1. Open terminal: `cd ~/Mycelium && git pull && npm run dev`
2. Open browser: `localhost:5174`
3. Paste a URL into the app
4. Close the browser when done — the GitHub Actions workflow processes it in the background
5. Next time you open the app, `git pull` first to get the latest processed articles

---

## Cost monitoring

Go to your GitHub repo → Actions → click any workflow run → expand the Claude API step.
You'll see input tokens, output tokens, and model used for every call.
Target: under $2/month total. Flag anything using Sonnet where Haiku should be used.

---

## Phases checklist

- [ ] Phase 1: URL intake + article list — **start here**
- [ ] Phase 2: Connection finding + D3 graph
- [ ] Phase 3: Opinion tracker + surprise email alerts
- [ ] Phase 4: Cadence digests + time-filtered graph
- [ ] Phase 5: Books (parked — return later)
- [ ] Phase 6: Dashboard + momentum tracking
- [ ] Phase 7: Public repo MVP export (after Phase 4 complete)
