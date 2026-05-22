"""
Mycelium connection-finding script — Phase 2
Compares article pairs using Claude Sonnet to find intellectual connections.
Writes new edges to data/graph.json.

Uses Sonnet (not Haiku) — connection quality is the core value of the app
and requires genuine critical judgment, not pattern matching.

Idempotent: skips pairs already present in edges or evaluated_pairs.
Only evaluates new pairs — never re-evaluates existing ones.
"""

import json
import os
import re
import sys
from datetime import date
from itertools import combinations
from pathlib import Path

import anthropic

ARTICLES_DIR = Path("data/articles")
GRAPH_PATH   = Path("data/graph.json")

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
MODEL  = "claude-sonnet-4-6"

# ── Pre-filter ─────────────────────────────────────────────────────────────────
# Cheap Python scoring before any Sonnet call.  Pairs scoring 0 have no
# detectable overlap signal and are skipped (recorded as evaluated so they
# are not retried on future runs unless articles change).

_DOMAIN_BUCKETS = [
    ('tech',       ['tech', 'software', 'ai', 'digital', 'data', 'machine learning', 'computer']),
    ('science',    ['science', 'biology', 'physics', 'neuro', 'cognitive', 'psychology', 'complexity', 'evolutionary']),
    ('business',   ['business', 'econom', 'financ', 'marketing', 'management', 'organizational', 'geopolit', 'trade']),
    ('humanities', ['philosoph', 'histor', 'sociol', 'political', 'media', 'culture', 'anthropol', 'ethics']),
]
_STOP = {'the','a','an','is','are','in','on','of','to','and','or','that','it','for',
         'with','as','by','at','from','this','not','but','has','have','be','was','were','its'}


def _domain_bucket(domain: str) -> str | None:
    d = domain.lower()
    for name, kws in _DOMAIN_BUCKETS:
        if any(k in d for k in kws):
            return name
    return None


def pre_filter_score(a: dict, b: dict) -> int:
    """
    Score a pair on cheap signals.  Score 0 → skip.  Score ≥ 1 → send to Sonnet.
    Cross-domain pairs always score ≥ 1 (potential adjacent connections).
    Same-domain pairs must share an entity, tag, or significant claim keyword.
    """
    score = 0
    # Shared key entities (strong signal — same intellectual references)
    ents_a = {e.lower() for e in a.get("key_entities", [])}
    ents_b = {e.lower() for e in b.get("key_entities", [])}
    score += len(ents_a & ents_b) * 3
    # Shared topic tags
    tags_a = {t.lower() for t in a.get("topic_tags", [])}
    tags_b = {t.lower() for t in b.get("topic_tags", [])}
    score += len(tags_a & tags_b) * 2
    # Cross-domain: always passes (adjacent connections are cross-domain by definition)
    bucket_a = _domain_bucket(a.get("domain", ""))
    bucket_b = _domain_bucket(b.get("domain", ""))
    if bucket_a and bucket_b and bucket_a != bucket_b:
        score += 1
    # Shared claim keywords (length > 4, not stop-words)
    kw = lambda fields: {
        w for text in fields for w in text.lower().split()
        if len(w) > 4 and w not in _STOP
    }
    kw_a = kw(a.get("key_claims", []) + a.get("key_tensions", []))
    kw_b = kw(b.get("key_claims", []) + b.get("key_tensions", []))
    score += len(kw_a & kw_b)
    return score


def article_summary(a: dict) -> str:
    """Build a compact representation of an article for the connection prompt."""
    claims   = "\n".join(f"  - {c}" for c in a.get("key_claims", []))
    tensions = "\n".join(f"  - {t}" for t in a.get("key_tensions", []))
    entities = ", ".join(a.get("key_entities", [])) or "none cited"
    return f"""Title: {a.get("title", "Unknown")}
Domain: {a.get("domain", "unknown")}
Stance: {a.get("stance", "unknown")}
Central argument: {a.get("central_argument") or a.get("summary", "")}
Key claims:
{claims if claims else "  (none)"}
Key tensions (what it argues against):
{tensions if tensions else "  (none)"}
Key intellectual references: {entities}"""


def parse_response(raw: str) -> dict:
    """Strip markdown fences and parse JSON from model response."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)


def find_connection(article_a: dict, article_b: dict) -> dict | None:
    """
    Ask Claude Sonnet whether two articles have a genuine intellectual connection.
    Returns {type, claim_a, claim_b, explanation} if connected, None otherwise.
    Retries once with a stricter prompt if the first response fails to parse.
    Logs token usage for cost monitoring.
    """
    prompt = f"""You are a ruthlessly rigorous intellectual analyst building a personal knowledge \
graph. Your default is NO CONNECTION. You only record connections that would survive peer review \
— connections that a skeptical domain expert would agree are genuine, non-obvious, and \
irreducible to a shared theme.

ARTICLE A:
{article_summary(article_a)}

ARTICLE B:
{article_summary(article_b)}

OUTPUT FORMAT — apply this before reading anything else:
Your entire response must be valid JSON and nothing else. No preamble. No reasoning. \
No step labels. No commentary. The very first character must be {{.
Either: {{"connected": true, "type": "reinforce|contradict|evolve|adjacent", \
"claim_a": "exact verbatim claim from Article A", \
"claim_b": "exact verbatim claim from Article B", \
"explanation": "one precise sentence — the exact shared mechanism or formal relationship"}}
Or: {{"connected": false}}

EVALUATION CRITERIA — apply silently, then output only the JSON verdict:

CRITERION 1 — SHARPEST CLAIMS
Identify the single most specific, falsifiable, empirically-grounded claim in each article. \
Not the central argument — the sharpest atomic claim that could be directly cited. \
Themes, structural observations, and general arguments do not qualify.

CRITERION 2 — DIRECT RELATIONSHIP TYPE
- reinforce: Claims A and B assert the SAME causal mechanism operating in DIFFERENT empirical \
contexts. The mechanism must be explicitly stated in BOTH claims — not inferred or abstracted. \
If you need to say "both suggest X→Y" and X→Y is not the literal content of each claim, reject.

- contradict: Claim A, if true, directly falsifies Claim B. Logically inconsistent — not merely \
in tension. Different conclusions from different premises do not qualify. Different stances do not \
qualify.

- evolve: Claim B adds a specific limiting condition or scope boundary that modifies the \
predictive reach of Claim A. Both must concern the SAME mechanism. Same topic, different \
emphasis does not qualify.

- adjacent: Claims A and B exhibit the SAME FORMAL RELATIONSHIP between different variables \
across GENUINELY DIFFERENT disciplines (not sub-fields). The shared structure must generate a \
prediction NEITHER article makes alone. Thematic or analogical similarity does not qualify.

CRITERION 3 — ADVERSARIAL CHECK (reject if any apply)
(a) Does the connection rest on analogical reasoning ("X is like Y") rather than the identical \
mechanism in different empirical contexts?
(b) Does either claim need to be reinterpreted or extended beyond what the article literally \
states?
(c) Do the claims describe different failure modes, different causal directions, or different \
mechanisms that share only surface vocabulary?

CRITERION 4 — DISQUALIFICATION (reject if any apply)
- Requires a concept or framing neither article explicitly names
- Claims are thematically related but describe different causal structures
- Connection holds equally well for most article pairs in these domains (genre convention)
- A careful reader would not notice this connection without external prompting

FAIL examples → {{"connected": false}}:
- "Both show credentials are insufficient substitutes for accountability." \
→ mechanism not in either claim literally; abstracted upward. Fails 3(b).
- "Both argue surface metrics miss quality drivers." → genre convention. Fails 4.
- adjacent: "Both reveal structural proximity undermines judgment." \
→ thematic only; formal relationship differs. Fails 3(a).

PASS examples → {{"connected": true}}:
- reinforce: claim_a = "Live sports earns 600x more per hour than podcasts across 20 formats." \
claim_b = "Top 10 startups in a fund return more than the rest combined." \
→ power-law distribution explicitly stated in both, different domains.
- adjacent: claim_a = "25,000x more YouTube hours than TV yet TV monetises better per hour." \
claim_b = "Trade volume growth destroyed per-unit margins as exporters cut prices 8%." \
→ supply abundance collapses unit value; scarcity migrates to complement — across disciplines.

Now output ONLY the JSON verdict. No text before or after."""

    retry_prompt = """Reply with ONLY valid JSON. No markdown, no commentary.
Use one of these two forms exactly:
{"connected": true, "type": "reinforce", "claim_a": "specific claim from Article A", "claim_b": "specific claim from Article B", "explanation": "One sentence."}
{"connected": false}"""

    for attempt in range(2):
        if attempt == 1:
            print(f"    Retrying with stricter prompt (attempt 2)...")

        messages = (
            [{"role": "user", "content": prompt}]
            if attempt == 0
            else [
                {"role": "user",      "content": prompt},
                {"role": "assistant", "content": response.content[0].text},
                {"role": "user",      "content": retry_prompt},
            ]
        )

        response = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            messages=messages,
        )

        usage = response.usage
        print(
            f"    Model: {MODEL} — input: {usage.input_tokens} tokens, "
            f"output: {usage.output_tokens} tokens"
        )

        raw = response.content[0].text

        try:
            result = parse_response(raw)
            if result.get("connected"):
                return {
                    "type":        result["type"],
                    "claim_a":     result.get("claim_a", ""),
                    "claim_b":     result.get("claim_b", ""),
                    "explanation": result["explanation"],
                }
            return None
        except (json.JSONDecodeError, KeyError) as e:
            if attempt == 0:
                print(f"    Parse error on attempt 1 ({e}) — retrying...", file=sys.stderr)
            else:
                raise

    return None


def main() -> None:
    # Load articles
    article_files = list(ARTICLES_DIR.glob("*.json"))
    if len(article_files) < 2:
        print(f"Only {len(article_files)} article(s) found — need at least 2 to find connections.")
        return

    articles = {}
    for path in article_files:
        try:
            with open(path) as f:
                data = json.load(f)
            slug = data.get("slug") or path.stem
            articles[slug] = data
        except (json.JSONDecodeError, OSError) as e:
            print(f"  Skipping {path.name}: {e}", file=sys.stderr)

    print(f"Loaded {len(articles)} article(s).")

    # Load graph
    with open(GRAPH_PATH) as f:
        graph = json.load(f)

    # Build set of already-evaluated pairs from both edges AND evaluated_pairs.
    # Pairs that returned "no connection" are recorded in evaluated_pairs so
    # they are never re-evaluated.
    already_evaluated: set[frozenset] = set()
    for edge in graph.get("edges", []):
        already_evaluated.add(frozenset([edge["source"], edge["target"]]))
    for pair in graph.get("evaluated_pairs", []):
        already_evaluated.add(frozenset(pair))

    # Find pairs not yet evaluated
    all_slugs = list(articles.keys())
    new_pairs = [
        (a, b)
        for a, b in combinations(all_slugs, 2)
        if frozenset([a, b]) not in already_evaluated
    ]

    if not new_pairs:
        print("All article pairs already evaluated. Nothing to do.")
        return

    # Pre-filter: skip pairs with zero detectable overlap signals.
    # Pairs skipped here are recorded as evaluated so they are never retried.
    pre_pass    = [(a, b) for a, b in new_pairs if pre_filter_score(articles[a], articles[b]) >= 1]
    pre_skipped = [(a, b) for a, b in new_pairs if pre_filter_score(articles[a], articles[b]) < 1]
    if pre_skipped:
        print(f"Pre-filter: skipping {len(pre_skipped)} pair(s) with no overlap signals (no Sonnet call).")

    print(f"Evaluating {len(pre_pass)} new pair(s) with Sonnet...\n")

    new_edges:     list[dict]       = []
    new_evaluated: list[list[str]]  = [[a, b] for a, b in pre_skipped]  # record filtered pairs too
    error_count = 0

    for slug_a, slug_b in pre_pass:
        print(f"  {slug_a}  <->  {slug_b}")
        try:
            connection = find_connection(articles[slug_a], articles[slug_b])
            if connection:
                edge = {
                    "source":      slug_a,
                    "target":      slug_b,
                    "type":        connection["type"],
                    "claim_a":     connection["claim_a"],
                    "claim_b":     connection["claim_b"],
                    "explanation": connection["explanation"],
                    "date_added":  date.today().isoformat(),
                }
                new_edges.append(edge)
                print(f"  -> {connection['type'].upper()}: {connection['explanation']}")
                print(f"     A: {connection['claim_a']}")
                print(f"     B: {connection['claim_b']}")
            else:
                print("  -> No meaningful connection.")
            new_evaluated.append([slug_a, slug_b])
        except Exception as e:
            print(f"  ERROR: {e}", file=sys.stderr)
            error_count += 1
            continue

    # Persist graph
    graph_updated = bool(new_edges or new_evaluated)
    if new_edges:
        graph["edges"] = graph.get("edges", []) + new_edges
    if new_evaluated:
        graph["evaluated_pairs"] = graph.get("evaluated_pairs", []) + new_evaluated

    if graph_updated:
        with open(GRAPH_PATH, "w") as f:
            json.dump(graph, f, indent=2, ensure_ascii=False)

    if new_edges:
        print(f"\nAdded {len(new_edges)} new edge(s) to graph.json.")
    else:
        print("\nNo new connections found.")
    if new_evaluated:
        print(f"Recorded {len(new_evaluated)} evaluated pair(s) to skip on future runs.")

    print(f"\n--- Done ---")
    print(f"Connections found: {len(new_edges)}  |  Errors: {error_count}")

    if error_count > 0:
        print(
            f"Warning: {error_count} pair(s) were skipped due to parse errors. "
            f"They will be re-evaluated on the next run.",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
