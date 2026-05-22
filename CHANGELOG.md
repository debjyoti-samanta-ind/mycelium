# Changelog

All notable changes to Mycelium are recorded here.
Format: phase headings with dated sub-entries. Entry types: **Added**, **Fixed**, **Changed**.
Retroactive entries (Phases 1–7) capture only the most significant changes. From 2026-04-22 onwards, all changes are captured.

---

## Phase 7 — Agents (April 2026)

### 2026-05-06
#### Fixed
- Dashboard month counts no longer go stale at month boundaries; recompute_dashboard.yml now runs automatically on the 1st of each month via cron

### 2026-05-01
#### Fixed
- Blind Spot agent no longer crashes on launch; `run_agent()` now seeds the messages list with an initial user prompt before the first API call (Anthropic requires at least one message)

### 2026-04-24
#### Fixed
- Graph page now loads graph.json dynamically (fetch + 5-minute poll) instead of a static import; new articles appear in the graph automatically without restarting the dev server

### 2026-04-22
#### Fixed
- Ingestion script now exits with error only when *all* articles fail; partial successes still commit and trigger downstream workflows (connect, agents)

### 2026-04-16
#### Fixed
- Normalized domain name spelling to American English across all article data and the ingest prompt (e.g. "organisational behaviour" → "organizational behavior")
- Stance distribution on dashboard now computed dynamically from article data instead of hardcoded values
- Added `git pull --rebase` before push in `connect.yml` to prevent race condition on concurrent workflow runs

### 2026-04-15
#### Added
- Collapsible left sidebar navigation replacing top nav bar
- Warm parchment theme with serif headings and agent icons
- Domain-colored 3D article cards on Articles page
- Domain-colored nodes with degree-based sizing and legend on Graph page
- Redesigned Digests and Agents pages
- Redesigned Add Article page

#### Fixed
- Connection evaluation prompt restructured to default-no with specific claim grounding
- Steelman agent paused — consistently selected most-connected cluster, producing repetitive challenges; will re-enable once post-check deduplication is added
- `connect.py` JSON parse failures now handled with retry; pre-filter skips already-evaluated pairs
- `reprise.py` 30-day minimum enforced in Python as a hard guard before Claude is called
- Tooltip clipping on Agents page fixed

### 2026-04-14
#### Added
- **Steelman agent** — finds strongest consensus in graph, writes best counter-argument using actual article claims (Sonnet, tool-use loop)
- **Reprise agent** — surfaces one old article newly reframed by the latest ingestion; enforces 30-day minimum on surfaced articles (Sonnet, tool-use loop)
- **Blind Spot agent** — identifies the most important adjacent domain being systematically ignored (Sonnet, tool-use loop)
- Agents page with run history and status panel on Dashboard
- `agent_log.json` and `reprise_outputs.json` for agent observability
- Shared agent tool library used by all three agents
- Switched connection-finding to Sonnet with four-test quality evaluation framework (specific claims, direct relationship, non-derivability, generality)

---

## Phase 6 — Dashboard (April 2026)

### 2026-04-13
#### Added
- Dashboard with 8 reading intelligence cards: momentum, domain spread, stance distribution, most connected article, longest gap, and more
- Incremental dashboard recompute after each ingestion; `force_full` flag for full recompute
- Multi-URL submission — paste several URLs at once on Add Article page
- Auto git pull watcher (`npm run watch`) — polls remote every 5 minutes so local app stays current without manual pulls

#### Fixed
- Dashboard stat validation fixes for edge cases (empty graph, single article)

---

## Phase 4 — Memory (April 2026)

### 2026-04-13
#### Added
- Monthly digest generation via Claude Sonnet — synthesises reading themes and connections into a narrative summary
- Time-filtered graph — slider to view the graph as it existed at any past date
- `target_month` override parameter on digest workflow for manual regeneration
- Delete digest button on Digests page
- Weekly consolidated surprise alerts (max 3, ranked by domain bucket distance) replacing per-connection alerts

---

## Phase 3 — Analyst (April 2026)

### 2026-04-13
#### Added
- Surprise alert emails — weekly cron identifies the most cross-domain connections and emails a consolidated digest
- Opinions UI page
- PDF upload support on Add Article page (via pdfjs-dist) — paste text extracted from PDFs
- Failed article notifications with delete-from-UI option

#### Fixed
- Alert emails now sent to `GMAIL_RECIPIENT` (previously sent to sender address by mistake)

---

## Phase 2 — Graph (April 2026)

### 2026-04-12
#### Added
- Connection-finding workflow — compares every new article pair using Claude Sonnet and records reinforce / contradict / evolve / adjacent edges
- `evaluated_pairs` tracking in `graph.json` — prevents re-evaluating already-compared pairs
- Interactive force-directed graph visualization with edge-type color coding

---

## Phase 1 — Foundation (April 2026)

### 2026-04-12
#### Added
- Project scaffold — React + Vite + Tailwind, GitHub Actions, flat JSON data store
- URL intake via `queue.json` — add a URL, push, ingest runs automatically
- Article fetching via `r.jina.ai` with Claude Haiku extraction
- Enriched article schema: `central_argument`, `domain`, `stance`, `key_entities`, `key_tensions`, `key_claims`
- Ingestion idempotency — re-running on the same URL is a no-op
- Article list page with expandable cards

#### Fixed
- Ingestion workflow trigger corrected to `master` branch
