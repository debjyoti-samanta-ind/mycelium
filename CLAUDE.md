# Mycelium — Claude Code Instructions

## What is Mycelium?
Mycelium is a personal knowledge graph. It ingests articles (via URL) and builds a living map of connections between ideas over time. It surfaces reinforcements, contradictions, evolutions, and unexpected cross-domain links across everything the user has read. It is a genuine learning tool, not a showpiece.

The user is Debjyoti. He is building this for himself. Every decision should optimise for: genuine usefulness over visual impressiveness, low cost (target ~$1–2/month total), and long-term maintainability by a solo developer.

---

## Two-repo strategy

### Private repo — `mycelium-private` (build everything here)
- Contains all real article data, graph, opinions, alerts, digests
- Contains all GitHub Actions agent workflows
- Contains the full React frontend
- **Never made public**
- This is where all development happens across all phases
- GitHub Actions runs all agent jobs here (ingestion, connections, opinions, alerts, digests)
- Frontend runs locally via `npm run dev` — not deployed to GitHub Pages
- Debjyoti accesses the app at `localhost:5174` on his machine

### Public repo — `mycelium` (created only when Phases 1–4 are complete)
- Contains only the React frontend code copied from `/src` of the private repo
- Contains a `/data` folder with fictional demo articles — **never real data**
- Deployed to GitHub Pages as a live public demo
- Treated as a **point-in-time MVP snapshot** — not a live mirror
- Updated manually and infrequently when Debjyoti decides the public demo needs refreshing
- No agent workflows — it is a static frontend only
- No automated sync between private and public repos — updates are deliberate, not automatic

### What this means for Claude Code
- **Always build in the private repo context**
- **Never reference, sync to, or assume the existence of the public repo** during any phase build
- Phase 7 (future, not yet planned) will handle the one-time export to the public repo
- When building the frontend, do not add any GitHub Pages deployment workflow — the app runs locally only during active development phases

---

## How Claude Code must behave in this project

### 1. Brainstorm before building
**Never jump straight into writing code for a new feature.**
Before implementing anything non-trivial, Claude Code must:
- Summarise its understanding of what is being asked
- Identify 2–3 design decisions or tradeoffs worth discussing
- Ask Debjyoti at least one clarifying question using the Ask User Questions tool
- Wait for confirmation before proceeding

This rule applies to: new components, new GitHub Actions workflows, new agent logic, schema changes, and any feature that touches more than one file.

It does NOT apply to: fixing a specific named bug, renaming a variable, updating copy/text, or other single-file cosmetic changes.

### 2. Validate your own work before presenting it
After writing any code, Claude Code must run a self-validation checklist before saying it's done:

**For any code:**
- [ ] Does it actually do what was asked?
- [ ] Are there any obvious bugs or edge cases unhandled?
- [ ] Are hardcoded values that should be configurable called out?
- [ ] Is error handling present for external calls (API, fetch)?
- [ ] Are there any unused imports? (Caught: `import sys`, `from calendar import monthrange` in digest scripts)
- [ ] Do all tooltip texts, comments, and UI descriptions precisely match the code's *actual* behaviour — not the intended behaviour? (Caught: tooltip said "3+ domains" but code used a 60% threshold)

**For GitHub Actions workflows:**
- [ ] Are all required secrets named and documented?
- [ ] Is the trigger condition correct?
- [ ] Does the workflow handle failure gracefully (not silently)?
- [ ] Would this workflow run unnecessarily or too frequently?

**For React components:**
- [ ] Light theme only — no dark mode classes or dark: prefixes
- [ ] No hardcoded colours — use Tailwind's standard palette
- [ ] Mobile-readable (min font size 14px, no overflow)
- [ ] Loading and empty states handled

**For Claude API calls:**
- [ ] Is the correct model being used? (Haiku for ingestion/connections, Sonnet for synthesis/opinions/digests)
- [ ] Is only the minimum necessary context being passed? (summaries and claims only — never full article text after ingestion)
- [ ] Is the prompt asking for structured output (JSON) with a clear schema?
- [ ] Is there a fallback if the API call fails?

### 3. Explain before committing
Before writing any file to disk, Claude Code must show Debjyoti:
- What file(s) will be created or modified
- A brief summary of what the change does
- Any irreversible actions (schema changes, file deletions)

### 4. Token efficiency is a first-class concern
This is a personal project with a target cost of ~$1–2/month. Every Claude API call in the workflows must be scrutinised:
- Pass enriched article fields to Claude — summary, central_argument, key_claims, key_tensions, domain, stance, key_entities — never full article text after initial ingestion
- Use Haiku for: ingestion, connection-finding, book processing, dashboard computation
- Use Sonnet for: opinion synthesis, surprise detection, weekly/monthly digests
- Never call Claude when the answer can be computed from existing JSON data

### 5. One phase at a time
The project is built in 6 phases. Claude Code must not implement features from a later phase while working on an earlier one. If a future-phase feature is relevant to a current decision, note it as a comment or a TODO — do not build it.

Current phase is always stated at the top of the session. If it isn't stated, ask.

### 6. Phase completion gate — validate before closing a phase
Before declaring any phase complete and before Debjyoti moves to the next phase, Claude Code must run a full phase-level validation. This is distinct from the per-feature checklist in rule 2 — it is a holistic end-of-phase review.

Claude Code must explicitly work through the following and report the result to Debjyoti:

**Functional check**
- [ ] Every deliverable listed for this phase in the phases reference section is built and working
- [ ] The app runs without errors at localhost:5174 (`npm run dev`)
- [ ] Any GitHub Actions workflows introduced in this phase have been tested with a real trigger (not just written)
- [ ] No placeholder logic, hardcoded test data, or TODO stubs remain in phase-critical code paths

**Integration check**
- [ ] New code reads from and writes to the correct JSON files in /data/
- [ ] New workflows commit back to the repo correctly and the local app reflects the result after `git pull`
- [ ] No phase 1 assumptions are broken by new phase code (e.g. article schema still valid)

**Cost check**
- [ ] Token usage per workflow run has been logged and reviewed
- [ ] No Sonnet calls exist where Haiku was specified
- [ ] No new Claude calls were added beyond what was planned for this phase

**Handoff summary**
Claude Code must write a short handoff note to Debjyoti covering:
- What was built this phase (2–3 sentences)
- Any known limitations or edge cases to be aware of
- Any decisions made that deviate from the original plan, and why
- What the first step of the next phase will touch

Claude Code must not say a phase is complete until it has explicitly confirmed every item above with Debjyoti. If any item fails, fix it before closing the phase.

---

## Project architecture

### Stack
- **Frontend:** React + Vite + Tailwind CSS (light theme only, no dark mode)
- **Local hosting:** `npm run dev` → `localhost:5174` — no deployment during active phases; run `npm run watch` in a second terminal to auto-pull remote changes every 5 min
- **Public hosting:** GitHub Pages in public repo — created only at Phase 7, not now
- **Data store:** JSON flat files in /data/ — no database, no backend
- **Agent jobs:** GitHub Actions workflows in the private repo
- **Article fetching:** r.jina.ai/{url} — always auto-prepended, user always pastes raw URLs
- **Claude models:** Haiku for high-frequency jobs, Sonnet for synthesis jobs

### Folder structure
```
/src                    — React frontend
  /components           — Reusable UI components
    Tooltip.jsx         — Hover tooltip with ? icon, used on dashboard metrics
  /pages                — Page-level views
  /utils                — Helper functions (data loading, graph computation)
/scripts
  watch-pull.js         — Polls `git pull` every 5 min; run with `npm run watch`
/data
  /articles             — One JSON file per ingested article ({slug}.json)
  /books                — One JSON file per book (Phase 5)
  /digests              — One JSON file per month ({YYYY-MM}.json)
  queue.json            — URL drop zone (user adds URLs here)
  graph.json            — Nodes, edges, and evaluated_pairs
  opinions.json         — Per-theme intellectual positions (Phase 3)
  alerts.json           — Sent alert log with last_alerted_at timestamp (Phase 3)
  dashboard.json        — Precomputed dashboard stats (recomputed after every ingestion)
  config.json           — Topic colour map and app settings
/.github
  /workflows            — All agent logic lives here
    ingest.yml          — Triggered on queue.json push; runs ingest.py then compute_dashboard.py
    connect.yml         — Triggered after ingest; finds connections with Haiku
    alerts.yml          — Weekly cron (Sunday); sends consolidated surprise alert email (max 3, ranked by domain surprise)
    opinions.yml        — Weekly cron (Sunday); incremental opinion synthesis with Sonnet; FORCE_FULL input for full recompute
    digest.yml          — Monthly cron (1st of month); generates digest with Sonnet; supports target_month override
  /scripts
    ingest.py           — Article extraction (Haiku)
    connect.py          — Connection finding (Haiku); records all evaluated pairs (connected or not) to prevent re-evaluation
    alerts.py           — Consolidated weekly surprise alert email (no Claude); ranks by domain bucket distance
    opinions.py         — Incremental opinion synthesis (Sonnet); full recompute when FORCE_FULL=true or no prior opinions
    digest.py           — Monthly digest synthesis (Sonnet); idempotent (skips if file exists)
    compute_dashboard.py — Dashboard stat computation (no Claude, pure Python)
CLAUDE.md               — This file
README.md               — Setup instructions for Debjyoti
```

### Article JSON schema
```json
{
  "slug": "why-attention-is-the-new-currency",
  "title": "Why attention is the new currency",
  "source": "The Atlantic",
  "url": "https://...",
  "date_added": "2026-04-12",
  "published_date": "2026-04-10",
  "content_type": "essay",
  "read_depth": "full",
  "summary": "3 sentences capturing what the article argues, not just what it covers",
  "central_argument": "One sentence — the single strongest claim the article makes. Must commit to a position, not hedge.",
  "key_claims": ["specific and atomic claim", "another — no padding to hit a number"],
  "key_tensions": ["thing the article explicitly argues against", "idea it complicates"],
  "domain": "cognitive science",
  "stance": "pessimistic",
  "key_entities": ["attention economy (concept)", "Herbert Simon", "Flow (Csikszentmihalyi)"],
  "topic_tags": ["attention", "media", "cognition"]
}
```

### Graph JSON schema
```json
{
  "nodes": [
    { "id": "slug-here", "type": "article" }
  ],
  "edges": [
    {
      "source": "slug-a",
      "target": "slug-b",
      "type": "reinforce",
      "explanation": "One sentence explaining the connection",
      "date_added": "YYYY-MM-DD"
    }
  ],
  "evaluated_pairs": [
    ["slug-a", "slug-b"]
  ]
}
```

`evaluated_pairs` tracks every pair that has been evaluated (whether a connection was found or not), so the connection finder never re-evaluates the same pair. When an article is deleted, its pairs are removed from this list so they can be re-evaluated if the article is re-added.

### Edge types and their meaning
- **reinforce** — both articles make the same argument from different angles
- **contradict** — the articles disagree on a specific claim
- **evolve** — one article is a more developed version of an idea in the other
- **adjacent** — non-obvious structural similarity across different domains

---

## UI rules (non-negotiable)

- **Light theme only.** No `dark:` Tailwind classes anywhere. No dark mode toggle.
- **Colour palette for graph:** reinforce=#4a7c59 (green), contradict=#c0392b (red), evolve=#6c5ce7 (purple), adjacent=#e17055 (amber)
- **Background:** #fafaf8 (warm white, not pure white)
- **Font sizes:** minimum 14px body, 12px for secondary labels
- **Island nodes** (no connections yet) must be visible — float at graph periphery, slightly muted opacity
- **All external calls** must have loading states and error states in the UI
- **Empty states** must be friendly and instructional, not blank

---

## GitHub Actions rules

- All secrets referenced in workflows must be documented in README.md under "Required Secrets"
- Workflows must have `on: workflow_dispatch` in addition to their primary trigger — so Debjyoti can run them manually at any time
- Failed steps must log a clear error message — no silent failures
- Workflows that call the Claude API must log token usage to the Actions console for cost monitoring
- The ingestion workflow must be idempotent — running it twice on the same URL should not create duplicate articles

---

## Cost guardrails

If Claude Code is about to implement something that would increase API costs meaningfully, it must flag this explicitly before proceeding. Examples:
- Changing a Haiku call to Sonnet
- Adding a new daily cron job that calls Claude
- Passing more context than necessary to any Claude call
- Adding web search tool usage (billed separately at $10/1000 searches)

---

## Phases reference

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation — URL intake + article processing | Complete |
| 2 | Graph — connection finding + visual map | Complete |
| 3 | Analyst — opinion tracker + surprise email alerts | Complete |
| 4 | Memory — monthly digests + time-filtered graph | Complete |
| 5 | Books — anchor nodes | Parked |
| 6 | Dashboard — momentum + reading intelligence | Complete |
| 7 | Opinion evolution — track how intellectual positions change over time | Parked |
| 8 | Public repo — one-time MVP export with demo data | Parked |

---

## What Debjyoti cares about most
1. The "analyst" quality of connections — surprising, cross-domain, non-obvious links that help him form his own opinions
2. Low cost — the system must stay under $2/month
3. Genuine learning utility — not a demo, not a showpiece
4. Light, clean UI — no dark themes, no clutter
5. Minimal friction to add an article — paste URL, done

When in doubt, optimise for these five things in this order.
