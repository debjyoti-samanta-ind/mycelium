"""
Mycelium connection-finding script — Phase 2
Compares article pairs using Claude Haiku to find intellectual connections.
Writes new edges to data/graph.json.

Idempotent: skips pairs already present in graph.json.
Only compares new pairs — never re-evaluates existing ones.
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
GRAPH_PATH = Path("data/graph.json")

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
MODEL = "claude-haiku-4-5-20251001"


def article_summary(a: dict) -> str:
    """Build a compact representation of an article for the connection prompt."""
    claims = "\n".join(f"  - {c}" for c in a.get("key_claims", []))
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
    """Strip markdown fences and parse JSON from a Haiku response."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)


def find_connection(article_a: dict, article_b: dict) -> dict | None:
    """
    Ask Claude Haiku whether two articles have a meaningful intellectual connection.
    Returns {type, explanation} if connected, None otherwise.
    Retries once with a stricter prompt if the first response fails to parse.
    Logs token usage for cost monitoring.
    """
    prompt = f"""You are building a personal knowledge graph. Evaluate whether these two articles have a meaningful intellectual connection.

ARTICLE A:
{article_summary(article_a)}

ARTICLE B:
{article_summary(article_b)}

A connection is meaningful only if there is a specific argumentative relationship:
- reinforce: both articles make the same core argument from different domains or angles
- contradict: the articles directly disagree on a specific claim or conclusion
- evolve: one article is a more developed or refined version of an idea in the other
- adjacent: a non-obvious structural similarity across different fields — the same underlying logic applied differently

QUALITY BAR — before responding, ask: would a thoughtful reader who has read both articles find this connection genuinely surprising or illuminating? If the connection describes a principle so general it could apply to most articles in these domains, return {{"connected": false}}.

Examples of connections that FAIL the quality bar:
- reinforce: "Both articles argue that culture determines organisational success." → Too generic, applies to most management writing.
- contradict: "Article A is optimistic about AI; Article B is pessimistic." → Surface sentiment, not a specific claim clash.
- evolve: "Article A introduces the attention economy; Article B also discusses it." → B references A's concept but does not extend it.
- adjacent: "Both articles argue that surface metrics miss the underlying quality that drives outcomes." → Applies to virtually all management writing, generates no specific insight.

Examples of connections that PASS the quality bar:
- reinforce: "Article A shows attention value follows a power law (live sports earns 600x more per hour than podcasts). Article B shows startup returns follow a power law (top 10 companies outperform the rest combined). Both identify power-law distribution as the structural reality their industries ignore by averaging — same specific mechanism, different domains."
- contradict: "Article A claims board diversity metrics predict governance quality. Article B shows Enron's board comprised credentialed, prominent individuals who still failed catastrophically — directly contradicting that composition metrics predict outcomes on a specific, falsifiable point."
- evolve: "Article A prescribes 4-hour uninterrupted focus blocks for deep work. Article B finds alternating 90-minute sessions with deliberate rest outperforms sustained blocks — identifying the exact boundary condition (cognitive fatigue) where A's prescription breaks down and extending it with a limiting case."
- adjacent: "Article A shows content abundance destroyed per-unit attention value (25,000x more YouTube than TV, yet TV monetises better per hour). Article B shows trade volume growth destroyed per-unit trade margins. Both reveal the same structural logic: when supply becomes near-infinite, per-unit economics collapse while the scarce complement becomes the true value driver — a prediction neither article makes alone."

Reply with ONLY valid JSON — no markdown fences, no commentary:
{{"connected": true, "type": "reinforce|contradict|evolve|adjacent", "explanation": "One precise sentence naming the specific shared argument, disagreement, or structural similarity."}}
or
{{"connected": false}}"""

    retry_prompt = """Reply with ONLY valid JSON. No markdown, no commentary, no special characters outside the JSON values.
Use one of these two forms exactly:
{"connected": true, "type": "reinforce", "explanation": "One sentence."}
{"connected": false}"""

    for attempt in range(2):
        if attempt == 1:
            print(f"    Retrying with stricter prompt (attempt 2)...")

        response = client.messages.create(
            model=MODEL,
            max_tokens=256,
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
                    "type": result["type"],
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
    # This ensures pairs that returned "no connection" are never re-evaluated.
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

    new_edges = []
    new_evaluated: list[list[str]] = []  # all pairs evaluated this run (connected or not)
    error_count = 0

    for slug_a, slug_b in new_pairs:
        print(f"  {slug_a}  ↔  {slug_b}")
        try:
            connection = find_connection(articles[slug_a], articles[slug_b])
            if connection:
                edge = {
                    "source": slug_a,
                    "target": slug_b,
                    "type": connection["type"],
                    "explanation": connection["explanation"],
                    "date_added": date.today().isoformat(),
                }
                new_edges.append(edge)
                print(f"  → {connection['type'].upper()}: {connection['explanation']}")
            else:
                print("  → No meaningful connection.")
            # Record as evaluated regardless of outcome
            new_evaluated.append([slug_a, slug_b])
        except Exception as e:
            print(f"  ERROR: {e}", file=sys.stderr)
            error_count += 1
            # Do NOT record as evaluated — will retry on next run
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
