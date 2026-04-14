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
    prompt = f"""You are a rigorous intellectual analyst building a personal knowledge graph. \
Evaluate whether these two articles have a genuine, specific, non-obvious intellectual connection.

ARTICLE A:
{article_summary(article_a)}

ARTICLE B:
{article_summary(article_b)}

Before answering, work through these four tests in order:

TEST 1 — SPECIFIC CLAIMS
Identify the single most specific, falsifiable claim in Article A and in Article B. \
Work at the level of citable claims — not themes, structural patterns, or general arguments.

TEST 2 — DIRECT ARGUMENTATIVE RELATIONSHIP
Is there a direct relationship between a specific claim in A and a specific claim in B?
- reinforce: the specific claim in A and a specific claim in B make the same non-obvious \
argument independently. Must be falsifiable. Generic principles ("incentives matter", \
"culture drives outcomes", "metrics can mislead", "proximity affects judgment") do not qualify.
- contradict: a specific claim in A directly contradicts a specific claim in B. Surface \
sentiment disagreement (one optimistic, one pessimistic) does not qualify.
- evolve: a specific argument in A is extended, refined, or bounded by a specific argument \
in B with new evidence or a limiting case that A does not address.
- adjacent: a specific claim in A and a specific claim in B reveal the same structural logic \
across GENUINELY DIFFERENT intellectual disciplines — not different sub-fields or scales of \
the same discipline. Economics and media economics are the same discipline. The shared logic \
must generate a specific prediction that neither article makes alone.

TEST 3 — NON-DERIVABILITY
Would someone who had only read Article A already predict the specific finding in Article B \
that creates this connection — or vice versa? If yes, the connection is derivable from domain \
knowledge alone and does not qualify. Return connected: false.

TEST 4 — GENERALITY
Would this connection apply to 20%+ of articles in these domains? If yes, it is a genre \
convention, not an intellectual connection. Return connected: false.

Your default is: {{"connected": false}}
Only override with specific, non-derivable evidence that passes all four tests.

FAIL examples (do not return these):
- reinforce: "Both show that leaders' proximity to their organisations creates overconfidence \
that blinds them to systemic risks." → Derivable from either article's domain alone; \
a well-known cognitive bias, not a non-obvious shared finding.
- reinforce: "Both argue that surface metrics miss underlying quality drivers." → Genre \
convention; applies to most management writing.
- contradict: "Article A is optimistic about AI; Article B is pessimistic." → Surface \
sentiment only.
- adjacent: "Both reveal how structural proximity undermines objective judgment." → Too \
generic; applies to virtually all governance and behavioural economics writing.

PASS examples:
- reinforce: claim_a = "Attention value follows a power law: live sports earns 600x more \
per hour than podcasts across 20 media formats." claim_b = "Startup returns follow a power \
law: top 10 companies in a fund return more than the rest combined." Explanation: "Both \
independently identify power-law distribution as the structural reality their industry ignores \
by using averages — the same non-obvious mechanism appearing across genuinely different domains."
- adjacent: claim_a = "Content abundance has destroyed per-unit attention value: 25,000x more \
YouTube hours than TV yet TV monetises better per hour." claim_b = "Trade volume growth \
destroyed per-unit trade margins as Chinese exporters cut prices 8% to find buyers in \
realigned markets." Explanation: "Across genuinely different disciplines, near-infinite supply \
collapses per-unit economics while the scarce complement (focused attention; geopolitically \
trusted partnerships) becomes the true value driver — a prediction neither article makes alone."

Reply with ONLY valid JSON — no markdown, no commentary:
{{"connected": true, "type": "reinforce|contradict|evolve|adjacent", \
"claim_a": "the exact specific claim from Article A being connected", \
"claim_b": "the exact specific claim from Article B being connected", \
"explanation": "one precise sentence explaining the exact relationship between these two specific claims"}}
or
{{"connected": false}}"""

    retry_prompt = """Reply with ONLY valid JSON. No markdown, no commentary.
Use one of these two forms exactly:
{"connected": true, "type": "reinforce", "claim_a": "specific claim from Article A", "claim_b": "specific claim from Article B", "explanation": "One sentence."}
{"connected": false}"""

    for attempt in range(2):
        if attempt == 1:
            print(f"    Retrying with stricter prompt (attempt 2)...")

        response = client.messages.create(
            model=MODEL,
            max_tokens=512,
            messages=(
                [{"role": "user", "content": prompt}]
                if attempt == 0
                else [
                    {"role": "user", "content": prompt},
                    {"role": "assistant", "content": response.content[0].text},
                    {"role": "user", "content": retry_prompt},
                ]
            ),
        )

        usage = response.usage
        print(
            f"    Model: {MODEL} — input: {usage.input_tokens} tokens, "
            f"output: {usage.output_tokens} tokens"
        )

        try:
            result = parse_response(response.content[0].text)
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

    print(f"Evaluating {len(new_pairs)} new pair(s)...\n")

    new_edges:     list[dict]       = []
    new_evaluated: list[list[str]]  = []
    error_count = 0

    for slug_a, slug_b in new_pairs:
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
