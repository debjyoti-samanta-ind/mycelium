"""
Mycelium Steelman agent — Phase 7
Runs post-ingestion (via agents.yml). Finds the strongest consensus position
in the reading graph and writes the most compelling counter-argument built
entirely from the actual articles and their claims.

True agent: Claude drives the process via tool-use API in a multi-step loop.
Python executes tool calls and stops when Claude calls finish().
Model: Claude Sonnet — synthesis job requiring genuine critical judgment.
"""

import json
import os
import sys
from datetime import date
from pathlib import Path

import anthropic

sys.path.insert(0, str(Path(__file__).parent))
from agent_tools import (
    get_graph_summary,
    get_article,
    get_edges_for_article,
    get_articles_by_filter,
    append_agent_log,
    send_agent_notification,
)

DATA_DIR     = Path("data")
OUTPUT_PATH  = DATA_DIR / "steelman_outputs.json"
MODEL        = "claude-sonnet-4-6"
MIN_ARTICLES = 8

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

SYSTEM_PROMPT = """You are a critical thinking agent with access to Debjyoti's personal \
knowledge graph — a collection of articles he has read, with connections between them.

Your job:
1. Explore the graph to find the single most important intellectual consensus — a position \
that multiple articles reinforce, that Debjyoti appears to broadly accept.
2. Write the strongest possible argument *against* that consensus, built entirely from \
claims and tensions already present in his graph.

Rules:
- Use only evidence from the graph. Do not draw on outside knowledge for your counter-argument.
- Your counter-argument must:
  * Name at least two specific articles by title and reference their actual claims
  * Identify the precise point of failure in the consensus — not a general observation
  * Be uncomfortable because it is specific, not because it is dramatic
  * Be concise: 4–6 sentences, 200–250 words. Every sentence must add new \
    information. Depth over breadth — go deeper into fewer points rather than listing many.
- A counter-argument that could apply to any reading list is not acceptable. If you cannot \
find a specific, grounded counter-argument, call finish() with fired=false.
- You may call tools as many times as you need before deciding.
- When ready, call finish() with your structured output."""

TOOLS = [
    {
        "name": "get_graph_summary",
        "description": "Returns all articles with metadata (title, domain, stance, topic_tags, date_added, degree). Use this first to orient yourself before drilling into specific articles.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_article",
        "description": "Returns enriched fields for one article: summary, central_argument, key_claims, key_tensions, key_entities. Call this for specific articles you have a hypothesis about.",
        "input_schema": {
            "type": "object",
            "properties": {"slug": {"type": "string", "description": "The article slug"}},
            "required": ["slug"],
        },
    },
    {
        "name": "get_edges_for_article",
        "description": "Returns all edges connecting this article: edge type, claim_a, claim_b, explanation, other article slug.",
        "input_schema": {
            "type": "object",
            "properties": {"slug": {"type": "string"}},
            "required": ["slug"],
        },
    },
    {
        "name": "get_articles_by_filter",
        "description": "Returns articles matching domain, stance, or tag filters (all optional). Use to explore domain clusters efficiently.",
        "input_schema": {
            "type": "object",
            "properties": {
                "domain": {"type": "string"},
                "stance": {"type": "string"},
                "tag":    {"type": "string"},
            },
        },
    },
    {
        "name": "finish",
        "description": "Call this when your analysis is complete. Set fired=true with consensus and steelman blocks if you found a strong output, or fired=false with skip_reason if not.",
        "input_schema": {
            "type": "object",
            "properties": {
                "fired":       {"type": "boolean"},
                "skip_reason": {"type": "string"},
                "consensus": {
                    "type": "object",
                    "properties": {
                        "claim":               {"type": "string"},
                        "supporting_articles": {"type": "array", "items": {"type": "string"}},
                        "supporting_evidence": {"type": "string"},
                    },
                },
                "steelman": {
                    "type": "object",
                    "properties": {
                        "argument":         {"type": "string", "description": "The counter-argument. 4–6 sentences, 200–250 words. Specific, grounded, uncomfortable."},
                        "grounded_in":      {"type": "array", "items": {"type": "string"}},
                        "key_tension_used": {"type": "string"},
                    },
                },
            },
            "required": ["fired"],
        },
    },
]


def execute_tool(name: str, inputs: dict) -> dict:
    if name == "get_graph_summary":
        return get_graph_summary()
    if name == "get_article":
        return get_article(inputs["slug"])
    if name == "get_edges_for_article":
        return get_edges_for_article(inputs["slug"])
    if name == "get_articles_by_filter":
        return get_articles_by_filter(**{k: v for k, v in inputs.items() if v})
    return {"error": f"Unknown tool: {name}"}


def run_agent() -> tuple[dict, int, int, int]:
    """Run the agent loop. Returns (finish_payload, input_tokens, output_tokens, tool_calls)."""
    messages: list[dict] = [
        {
            "role": "user",
            "content": (
                "Begin your analysis. Call get_graph_summary() first to survey the full "
                "reading graph, then explore specific articles to identify the dominant "
                "intellectual consensus before writing your counter-argument."
            ),
        }
    ]
    total_input = total_output = tool_calls = 0

    while True:
        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )
        total_input  += response.usage.input_tokens
        total_output += response.usage.output_tokens
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            return (
                {"fired": False, "skip_reason": "Agent ended without calling finish()"},
                total_input, total_output, tool_calls,
            )

        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            tool_calls += 1
            if block.name == "finish":
                return block.input, total_input, total_output, tool_calls
            result = execute_tool(block.name, block.input)
            tool_results.append({
                "type":        "tool_result",
                "tool_use_id": block.id,
                "content":     json.dumps(result),
            })

        if tool_results:
            messages.append({"role": "user", "content": tool_results})
        else:
            return (
                {"fired": False, "skip_reason": "No tool calls in response"},
                total_input, total_output, tool_calls,
            )


def main() -> None:
    run_id = date.today().isoformat()

    summary = get_graph_summary()
    if summary["total"] < MIN_ARTICLES:
        print(f"Steelman: {summary['total']} articles — below {MIN_ARTICLES} minimum. Skipping.")
        append_agent_log("steelman", run_id, "ingestion", None, False,
                         f"Only {summary['total']} articles (min {MIN_ARTICLES})", 0, 0, 0)
        return

    print(f"Steelman: Running on graph with {summary['total']} articles...")
    result, in_tok, out_tok, calls = run_agent()

    fired       = result.get("fired", False)
    skip_reason = result.get("skip_reason")

    print(f"Steelman: fired={fired} | input_tokens={in_tok} | output_tokens={out_tok} | tool_calls={calls}")

    outputs = json.loads(OUTPUT_PATH.read_text()) if OUTPUT_PATH.exists() else []
    entry = {
        "run_id":          run_id,
        "triggered_by":    "ingestion",
        "trigger_article": None,
        "fired":           fired,
        "model":           MODEL,
        "input_tokens":    in_tok,
        "output_tokens":   out_tok,
        "tool_calls":      calls,
    }
    if fired:
        entry["consensus"] = result.get("consensus")
        entry["steelman"]  = result.get("steelman")
    else:
        entry["skip_reason"] = skip_reason

    outputs.append(entry)
    OUTPUT_PATH.write_text(json.dumps(outputs, indent=2))
    append_agent_log("steelman", run_id, "ingestion", None, fired, skip_reason, in_tok, out_tok, calls)

    if fired:
        send_agent_notification("Steelman")


if __name__ == "__main__":
    main()
