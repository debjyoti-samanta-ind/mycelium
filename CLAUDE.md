# Mycelium â€” Claude Code Instructions

## What is Mycelium?
Mycelium is a personal knowledge graph. It ingests articles (via URL) and builds a living map of connections between ideas over time. It surfaces reinforcements, contradictions, evolutions, and unexpected cross-domain links across everything the user has read. It is a genuine learning tool, not a showpiece.

You are building this for yourself. Every decision should optimise for: genuine usefulness over visual impressiveness, low cost (target ~$1â€“2/month total), and long-term maintainability by a solo developer.

---

## Two-repo strategy

### Private repo â€” `mycelium-private` (build everything here)
- Contains all real article data, graph, alerts, digests
- Contains all GitHub Actions agent workflows
- Contains the full React frontend
- **Never made public**
- This is where all development happens across all phases
- GitHub Actions runs all agent jobs here (ingestion, connections, alerts, digests)
- Frontend runs locally via `npm run dev` â€” not deployed to GitHub Pages
- you accesses the app at `localhost:5174` on his machine

### Public repo â€” `mycelium` (created only when Phases 1â€“4 are complete)
- Contains only the React frontend code copied from `/src` of the private repo
- Contains a `/data` folder with fictional demo articles â€” **never real data**
- Deployed to GitHub Pages as a live public demo
- Treated as a **point-in-time MVP snapshot** â€” not a live mirror
- Updated manually and infrequently when you decides the public demo needs refreshing
- No agent workflows â€” it is a static frontend only
- No automated sync between private and public repos â€” updates are deliberate, not automatic

### What this means for Claude Code
- **Always build in the private repo context**
- **Never reference, sync to, or assume the existence of the public repo** during any phase build
- Phase 8 (future, not yet planned) will handle the one-time export to the public repo
- When building the frontend, do not add any GitHub Pages deployment workflow â€” the app runs locally only during active development phases

---

## How Claude Code must behave in this project

### 1. Brainstorm before building
**Never jump straight into writing code for a new feature.**
Before implementing anything non-trivial, Claude Code must:
- Summarise its understanding of what is being asked
- Identify 2â€“3 design decisions or tradeoffs worth discussing
- Ask you at least one clarifying question using the Ask User Questions tool
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
- [ ] Do all tooltip texts, comments, and UI descriptions precisely match the code's *actual* behaviour â€” not the intended behaviour? (Caught: tooltip said "3+ domains" but code used a 60% threshold)

**For GitHub Actions workflows:**
- [ ] Are all required secrets named and documented?
- [ ] Is the trigger condition correct?
- [ ] Does the workflow handle failure gracefully (not silently)?
- [ ] Would this workflow run unnecessarily or too frequently?

**For React components:**
- [ ] Light theme only â€” no dark mode classes or dark: prefixes
- [ ] No hardcoded colours â€” use Tailwind's standard palette
- [ ] Mobile-readable (min font size 14px, no overflow)
- [ ] Loading and empty states handled

**For Claude API calls:**
- [ ] Is the correct model being used? (Haiku for ingestion/dashboard, Sonnet for connections/synthesis/digests)
- [ ] Is only the minimum necessary context being passed? (summaries and claims only â€” never full article text after ingestion)
- [ ] Is the prompt asking for structured output (JSON) with a clear schema?
- [ ] Is there a fallback if the API call fails?

### 3. Explain before committing
Before writing any file to disk, Claude Code must show you:
- What file(s) will be created or modified
- A brief summary of what the change does
- Any irreversible actions (schema changes, file deletions)

### 4. Token efficiency is a first-class concern
This is a personal project with a target cost of ~$1â€“2/month. Every Claude API call in the workflows must be scrutinised:
- Pass enriched article fields to Claude â€” summary, central_argument, key_claims, key_tensions, domain, stance, key_entities â€” never full article text after initial ingestion
- Use Haiku for: ingestion, book processing, dashboard computation
- Use Sonnet for: connection-finding, weekly/monthly digests
- Never call Claude when the answer can be computed from existing JSON data

### 5. One phase at a time
The project is built in 8 phases. Claude Code must not implement features from a later phase while working on an earlier one. If a future-phase feature is relevant to a current decision, note it as a comment or a TODO â€” do not build it.

Current phase is always stated at the top of the session. If it isn't stated, ask.

### 6. Phase completion gate â€” validate before closing a phase
Before declaring any phase complete and before you moves to the next phase, Claude Code must run a full phase-level validation. This is distinct from the per-feature checklist in rule 2 â€” it is a holistic end-of-phase review.

Claude Code must explicitly work through the following and report the result to you:

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
Claude Code must write a short handoff note to you covering:
- What was built this phase (2â€“3 sentences)
- Any known limitations or edge cases to be aware of
- Any decisions made that deviate from the original plan, and why
- What the first step of the next phase will touch

Claude Code must not say a phase is complete until it has explicitly confirmed every item above with you. If any item fails, fix it before closing the phase.

---

## Project architecture

### Stack
- **Frontend:** React + Vite + Tailwind CSS (light theme only, no dark mode)
- **Local hosting:** `npm run dev` â†’ `localhost:5174` â€” no deployment during active phases; run `npm run watch` in a second terminal to auto-pull remote changes every 5 min
- **Public hosting:** GitHub Pages in public repo â€” created only at Phase 8, not now
- **Data store:** JSON flat files in /data/ â€” no database, no backend
- **Agent jobs:** GitHub Actions workflows in the private repo
- **Article fetching:** r.jina.ai/{url} â€” always auto-prepended, user always pastes raw URLs
- **Claude models:** Haiku for high-frequency jobs, Sonnet for synthesis jobs

### Folder structure
```
/src                    â€” React frontend
  /components           â€” Reusable UI components
    Tooltip.jsx         â€” Hover tooltip with ? icon, used on dashboard metrics
  /pages                â€” Page-level views
  /utils                â€” Helper functions (data loading, graph computation)
/scripts
  watch-pull.js         â€” Polls `git pull` every 5 min; run with `npm run watch`
/data
  /articles             â€” One JSON file per ingested article ({slug}.json)
  /books                â€” One JSON file per book (Phase 5)
  /digests              â€” One JSON file per month ({YYYY-MM}.json)
  queue.json            â€” URL drop zone (user adds URLs here)
  graph.json            â€” Nodes, edges, and evaluated_pairs
  alerts.json           â€” Sent alert log with last_alerted_at timestamp (Phase 3)
  dashboard.json        â€” Precomputed dashboard stats (recomputed after every ingestion)
  agent_log.json        â€” All agent run records (fired / skipped, reason, output summary)
  reprise_outputs.json  â€” Full Reprise agent outputs (one entry per run that fired)
  config.json           â€” Topic colour map and app settings
/.github
  /workflows            â€” All agent logic lives here
    ingest.yml          â€” Triggered on queue.json push; runs ingest.py then compute_dashboard.py
    connect.yml         â€” Triggered after ingest; finds connections with Sonnet
    alerts.yml          â€” Weekly cron (Sunday); sends consolidated surprise alert email (max 3, ranked by domain surprise)
    digest.yml          â€” Monthly cron (1st of month); generates digest with Sonnet; supports target_month override
    agents.yml          â€” Triggered after connect; runs Reprise (Steelman paused); commits agent_log.json + reprise_outputs.json
  /scripts
    ingest.py           â€” Article extraction (Haiku)
    connect.py          â€” Connection finding (Sonnet); four-test evaluation (specific claims, direct relationship, non-derivability, generality); records all evaluated pairs to prevent re-evaluation; edges include claim_a and claim_b fields
    alerts.py           â€” Consolidated weekly surprise alert email (no Claude); ranks by domain bucket distance
    digest.py           â€” Monthly digest synthesis (Sonnet); idempotent (skips if file exists)
    compute_dashboard.py â€” Dashboard stat computation (no Claude, pure Python); normalises UK/US spelling variants in domain names
    steelman.py         â€” Steelman agent (Sonnet tool-use loop); PAUSED â€” repetition risk, pending post-check deduplication
    reprise.py          â€” Reprise agent (Sonnet tool-use loop); fires after each ingestion; enforces 30-day minimum on surfaced articles
CLAUDE.md               â€” This file
README.md               â€” Setup instructions for you
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
  "central_argument": "One sentence â€” the single strongest claim the article makes. Must commit to a position, not hedge.",
  "key_claims": ["specific and atomic claim", "another â€” no padding to hit a number"],
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
      "claim_a": "the specific claim from Article A that creates this connection",
      "claim_b": "the specific claim from Article B that creates this connection",
      "explanation": "One sentence explaining the exact relationship between the two claims",
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
- **reinforce** â€” both articles make the same argument from different angles
- **contradict** â€” the articles disagree on a specific claim
- **evolve** â€” one article is a more developed version of an idea in the other
- **adjacent** â€” non-obvious structural similarity across different domains

---

## UI rules (non-negotiable)

- **Light theme only.** No `dark:` Tailwind classes anywhere. No dark mode toggle.
- **Colour palette for graph:** reinforce=#4a7c59 (green), contradict=#c0392b (red), evolve=#6c5ce7 (purple), adjacent=#e17055 (amber)
- **Background:** #fafaf8 (warm white, not pure white)
- **Font sizes:** minimum 14px body, 12px for secondary labels
- **Island nodes** (no connections yet) must be visible â€” float at graph periphery, slightly muted opacity
- **All external calls** must have loading states and error states in the UI
- **Empty states** must be friendly and instructional, not blank

---

## GitHub Actions rules

- All secrets referenced in workflows must be documented in README.md under "Required Secrets"
- Workflows must have `on: workflow_dispatch` in addition to their primary trigger â€” so you can run them manually at any time
- Failed steps must log a clear error message â€” no silent failures
- Workflows that call the Claude API must log token usage to the Actions console for cost monitoring
- The ingestion workflow must be idempotent â€” running it twice on the same URL should not create duplicate articles

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
| 1 | Foundation â€” URL intake + article processing | Complete |
| 2 | Graph â€” connection finding + visual map | Complete |
| 3 | Analyst â€” surprise email alerts | Complete |
| 4 | Memory â€” monthly digests + time-filtered graph | Complete |
| 5 | Books â€” anchor nodes | Parked |
| 6 | Dashboard â€” momentum + reading intelligence | Complete |
| 7 | Agents â€” Steelman (paused), Reprise, Blind Spot | In Progress |
| 8 | Public repo â€” one-time MVP export with demo data | Parked |

---

## Phase 7 â€” Agents detail

Phase 7 adds three agentic learning tools. Unlike earlier phases which process inputs and find patterns, these agents explore the current state of the graph, make independent judgments, and produce outputs that feed back into you's thinking.

**Core architectural principle â€” true agents, not scripts:** All three agents are built using Claude's tool-use API in a multi-step agent loop. Claude drives the process â€” it decides which tools to call, what to look at, and when it's done. Python is scaffolding that executes tool calls and maintains the loop. No hardcoded thresholds or fixed decision logic in the agent behaviour.

**Why these three were chosen:**
Each agent targets a different failure mode of reading:
- **Steelman** â€” you absorb dominant views without noticing. This forces confrontation with the best opposing argument.
- **Reprise** â€” memory fades. This closes the gap between past and present reading by surfacing old articles that have become newly relevant.
- **Blind Spot** â€” you read through the same intellectual lenses without noticing. This identifies the most important adjacent domain you are systematically ignoring.

**Implementation status:** Reprise is live. Steelman is built but paused. Blind Spot is not yet started.

---

### Agent 1 â€” Steelman

**Value add:** You absorb dominant views in your reading without realising it. Steelman finds the most important consensus in your graph and writes the strongest possible argument against it â€” built from your specific articles and their actual claims, not generic domain knowledge. It makes you uncomfortable in a useful way.

**Status:** Built, paused. Repetition risk: the agent consistently selects the most-connected cluster, producing similar challenges on consecutive runs. Will be re-enabled once post-check deduplication is implemented (Python compares `supporting_articles` slugs against recent runs before sending the email).

**Design:**
- Trigger: fires after every ingestion via `agents.yml`
- Tools Claude can call: `get_graph_summary`, `get_article`, `get_cluster`, `get_recent_steelmans`, `finish`
- Output: a structured counter-argument built from the user's actual article claims, 200â€“250 words
- Storage: logs to `data/agent_log.json`; full outputs would go to `data/steelman_outputs.json` (not committed while paused)
- Model: Sonnet; ~3,500â€“4,000 tokens per run

---

### Agent 2 â€” Reprise

**Value add:** Your biggest enemy as a reader is forgetting. Reprise surfaces an old article that has become newly relevant because of what you just added â€” connecting your past reading to your present reading in a way you wouldn't have made yourself. The value compounds: the older and larger the graph, the more powerful this becomes.

**Status:** Live.

**Design:**
- Trigger: fires after every ingestion via `agents.yml`, immediately after connect
- Tools Claude can call: `get_new_article`, `get_all_articles`, `get_connections`, `finish`
- Logic: Claude reads the newly ingested article, scans the reading history, selects the one older article whose meaning has most changed in light of the new one, explains the reframing
- Enforces a 30-day minimum: will not surface an article added within the last 30 days
- Fires with `fired = false` (and logs reason) if no sufficiently old article qualifies
- Output: emailed to GMAIL_RECIPIENT; full output stored in `data/reprise_outputs.json`
- Storage: every run (fired or not) logged to `data/agent_log.json`
- Model: Sonnet; ~3,500â€“4,500 tokens per run

---

### Agent 3 â€” Blind Spot

**Value add:** You read the same topics through the same intellectual lenses without noticing. Blind Spot identifies the most important adjacent domain you are systematically ignoring â€” and explains specifically which questions in your current reading that missing domain would help you answer. Fires monthly. Low cost, high leverage.

**Status:** Not yet started.

**Design:** TBD â€” to be brainstormed before building begins.

---

### Phase 7 observability

All three agents log every run to `data/agent_log.json` â€” whether they fired or explicitly chose not to. A widget on the Dashboard surfaces recent agent activity. The weekly email includes a summary of what each agent did or skipped that week.

### Phase 7 cost summary

All three agents use Sonnet for their reasoning loops.

- **Reprise:** ~3,500â€“4,500 tokens per run. At 5 articles/week that is ~20 runs/month â†’ ~$0.10â€“$0.15/month.
- **Steelman:** paused. Similar cost to Reprise when active.
- **Blind Spot:** not yet built. Expected to be low cost (monthly cadence, focused context).

Combined additional cost expected to stay under $0.30/month, keeping the total well within the $2/month budget.

---

## What you care about most
1. The "analyst" quality of connections â€” surprising, cross-domain, non-obvious links that help him form his own opinions
2. Low cost â€” the system must stay under $2/month
3. Genuine learning utility â€” not a demo, not a showpiece
4. Light, clean UI â€” no dark themes, no clutter
5. Minimal friction to add an article â€” paste URL, done

When in doubt, optimise for these five things in this order.

