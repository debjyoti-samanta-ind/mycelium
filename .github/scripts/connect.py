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
    prompt = f"""You are a ruthlessly rigorous intellectual analyst building a personal knowledge \
graph. Your default is NO CONNECTION. You only record connections that would survive peer review \
— connections that a skeptical domain expert would agree are genuine, non-obvious, and \
irreducible to a shared theme.

ARTICLE A:
{article_summary(article_a)}

ARTICLE B:
{article_summary(article_b)}

Work through these steps in order. Stop and return {{"connected": false}} the moment any step fails.

STEP 1 — EXTRACT THE SHARPEST CLAIMS
Identify the single most specific, falsifiable, empirically-grounded claim in each article. \
Do not use the central argument — find the sharpest atomic claim that could be directly cited. \
Themes, structural observations, and general arguments do not qualify.

STEP 2 — TEST FOR A DIRECT RELATIONSHIP
Connection types — read definitions precisely:

- reinforce: Claims A and B assert the SAME causal mechanism or causal relationship operating \
in DIFFERENT empirical contexts. The mechanism must be explicitly stated in BOTH claims — not \
inferred, reconstructed, or abstracted upward from them. If you need to say "both suggest that \
X leads to Y" and X→Y is not the literal content of each claim, they do not reinforce.

- contradict: Claim A, if true, directly falsifies Claim B — or vice versa. They must be \
logically inconsistent, not merely in tension. Different conclusions drawn from different \
premises do not qualify. Different stances (one optimistic, one pessimistic) do not qualify.

- evolve: Claim B adds a specific limiting condition, scope boundary, or new evidence that \
directly modifies the predictive reach of Claim A. Both claims must concern the SAME \
mechanism. Same topic with different emphasis does not qualify.

- adjacent: Claims A and B exhibit the SAME FORMAL RELATIONSHIP between different variables, \
across GENUINELY DIFFERENT intellectual disciplines — not sub-fields, applied variants, or \
different scales of the same discipline. The shared formal structure must generate a specific \
prediction that NEITHER article makes alone. Thematic or analogical similarity does not qualify.

STEP 3 — ADVERSARIAL CHECK
If you found a potential connection in Step 2, argue against it. Identify the strongest single \
reason this is NOT a genuine connection. Then apply these three tests:
(a) Does this connection rest on analogical reasoning — "X is like Y" or "both involve Z" — \
rather than the identical mechanism operating in different empirical contexts?
(b) Does either claim need to be reinterpreted, abstracted, or extended beyond what the article \
literally states in order to create the connection?
(c) Do the claims describe structurally different phenomena — different failure modes, different \
causal directions, different mechanisms — that share only a surface theme or vocabulary?
If the answer to any of (a), (b), or (c) is yes, return {{"connected": false}}.

STEP 4 — DISQUALIFICATION CHECKS
Return {{"connected": false}} immediately if ANY of these apply:
- The connection requires invoking a concept, mechanism, or framing that neither article \
explicitly names or argues for
- The claims are thematically related but describe different causal structures
- The connection would hold equally well between this pair and most other articles in these \
domains — it is a genre convention
- A careful reader of both articles would not spontaneously notice this connection without \
external prompting — it requires synthesis the articles themselves do not invite

FAIL examples — these would all return {{"connected": false}}:
- reinforce: "Both show that formal credentials are insufficient substitutes for genuine \
accountability." → The mechanism (credentials ≠ accountability) is not the literal content of \
either claim; it is reconstructed by abstracting upward. Fails Step 3(b).
- reinforce: "Both argue that surface metrics miss underlying quality drivers." → Genre \
convention in management writing. Fails Step 4.
- reinforce: "Both show leaders' proximity creates overconfidence." → Well-known cognitive \
bias derivable from domain knowledge alone; not a non-obvious shared finding. Fails Step 4.
- adjacent: "Both reveal how structural proximity undermines objective judgment." → Thematic \
similarity only; the formal relationship between variables differs in each case. Fails Step 3(a).
- contradict: "Article A is optimistic about AI; Article B is pessimistic." → Surface \
sentiment, not logical inconsistency. Fails Step 2.

PASS examples — these would return connected: true:
- reinforce: claim_a = "Attention value follows a power law: live sports earns 600x more per \
hour than podcasts across 20 media formats." claim_b = "Startup returns follow a power law: \
top 10 companies in a fund return more than the rest combined." → Same mechanism (power-law \
distribution) explicitly stated in both claims across different domains. Passes all steps.
- adjacent: claim_a = "Content abundance has destroyed per-unit attention value: 25,000x more \
YouTube hours than TV yet TV monetises better per hour." claim_b = "Trade volume growth \
destroyed per-unit trade margins as Chinese exporters cut prices 8% to find buyers." → Same \
formal relationship (supply abundance collapses unit value of the commodity; scarcity migrates \
to the complement) across genuinely different disciplines, generating a prediction neither \
article makes alone. Passes all steps.

Reply with ONLY valid JSON — no markdown, no commentary:
{{"connected": true, "type": "reinforce|contradict|evolve|adjacent", \
"claim_a": "the exact verbatim claim from Article A", \
"claim_b": "the exact verbatim claim from Article B", \
"explanation": "one precise sentence stating the exact shared mechanism or formal relationship \
between these two specific claims — not a theme, not an analogy"}}
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
            max_tokens=1024,
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
