"""
Mycelium Reprise agent — Phase 7
Runs post-ingestion (via agents.yml), after Steelman.
Surfaces an old article that has become newly relevant because of the new article
just added — closing the past-present memory gap.

True agent: Claude drives the process via tool-use API in a multi-step loop.
Model: Claude Sonnet — requires genuine judgment about intellectual resonance.
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
    append_agent_log,
    send_agent_notification,
)

DATA_DIR     = Path("data")
OUTPUT_PATH  = DATA_DIR / "reprise_outputs.json"
MODEL        = "claude-sonnet-4-6"
MIN_ARTICLES = 5

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

SYSTEM_PROMPT = """You are a reading memory agent. Debjyoti has just added a new article \
to his knowledge graph. Your job is to look through his older articles and find the one that \
has become most newly relevant because of what he just read — something he has probably \
forgotten that would land differently now.

Start by reading the new article carefully using get_article(). Then use get_graph_summary() \
to see all articles. Build a shortlist of 6–10 candidates from the metadata before reading \
any in detail. Do not call get_article() speculatively — only for articles you have a \
specific hypothesis about.

What you are looking for is NOT a direct connection (those are already found automatically). \
You are looking for an older article whose central argument, questions, or framing has become \
more alive given what Debjyoti just added — even if the relationship is oblique, cross-domain, \
or hard to name.

The bar for a genuine reprise is high. Before calling finish() with fired=true, you must \
be able to complete this sentence:
"Reading [old article] now would feel different because [new article] has established that \
[specific thing] — which changes what [old article] means."

Rules:
- Surface exactly one article, or stay silent.
- The surfaced article must have been added at least 30 days before the new article. \
  Check date_added from get_graph_summary() before reading any candidate in detail.
- Do not surface an article that already has a direct edge to the new article. \
  Call get_edges_for_article() on the new article to check before deciding.
- The connection must be non-obvious. If anyone could have predicted it without \
  reading both articles carefully, it is not good enough.
- If no article clears the bar, call finish() with fired=false. \
  A weak reprise is worse than no reprise."""

TOOLS = [
    {
        "name": "get_graph_summary",
        "description": "Returns all articles with metadata and degree. Use to build a candidate shortlist before reading any article in detail.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_article",
        "description": "Returns enriched fields for one article. Only call for specific candidates you have a hypothesis about.",
        "input_schema": {
            "type": "object",
            "properties": {"slug": {"type": "string"}},
            "required": ["slug"],
        },
    },
    {
        "name": "get_edges_for_article",
        "description": "Returns all edges connecting this article. Call on the new article to check what is already connected before surfacing a candidate.",
        "input_schema": {
            "type": "object",
            "properties": {"slug": {"type": "string"}},
            "required": ["slug"],
        },
    },
    {
        "name": "finish",
        "description": "Call when analysis is complete. Set fired=true with surfaced_article and relevance_explanation, or fired=false with skip_reason.",
        "input_schema": {
            "type": "object",
            "properties": {
                "fired":       {"type": "boolean"},
                "skip_reason": {"type": "string"},
                "surfaced_article": {
                    "type": "object",
                    "properties": {
                        "slug":       {"type": "string"},
                        "title":      {"type": "string"},
                        "date_added": {"type": "string"},
                    },
                },
                "relevance_explanation": {"type": "string"},
            },
            "required": ["fired"],
        },
    },
]


def find_trigger_article() -> dict | None:
    """
    Returns the most recently added article — the one that triggered this run.
    If multiple articles share the same date_added (batch), returns the last alphabetically.
    Returns None if the graph has fewer than MIN_ARTICLES articles.
    """
    summary = get_graph_summary()
    if summary["total"] < MIN_ARTICLES:
        return None

    articles = [a for a in summary["articles"] if a["date_added"]]
    if not articles:
        return None

    latest_date = max(a["date_added"] for a in articles)
    candidates  = [a for a in articles if a["date_added"] == latest_date]
    return sorted(candidates, key=lambda a: a["slug"])[-1]


def execute_tool(name: str, inputs: dict) -> dict:
    if name == "get_graph_summary":
        return get_graph_summary()
    if name == "get_article":
        return get_article(inputs["slug"])
    if name == "get_edges_for_article":
        return get_edges_for_article(inputs["slug"])
    return {"error": f"Unknown tool: {name}"}


def run_agent(trigger_slug: str, trigger_title: str) -> tuple[dict, int, int, int]:
    """Run the agent loop with the trigger article context injected into the first message."""
    initial_message = (
        f"The new article that was just added is: slug='{trigger_slug}', title='{trigger_title}'. "
        f"Start by reading it with get_article('{trigger_slug}'), then explore the graph."
    )
    messages: list[dict] = [{"role": "user", "content": initial_message}]
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

    trigger = find_trigger_article()
    if trigger is None:
        summary = get_graph_summary()
        print(f"Reprise: {summary['total']} articles — below {MIN_ARTICLES} minimum. Skipping.")
        append_agent_log("reprise", run_id, "ingestion", None, False,
                         f"Only {summary['total']} articles (min {MIN_ARTICLES})", 0, 0, 0)
        return

    trigger_slug  = trigger["slug"]
    trigger_title = trigger["title"]
    print(f"Reprise: Running. Trigger article: '{trigger_title}'")

    result, in_tok, out_tok, calls = run_agent(trigger_slug, trigger_title)

    fired       = result.get("fired", False)
    skip_reason = result.get("skip_reason")

    print(f"Reprise: fired={fired} | input_tokens={in_tok} | output_tokens={out_tok} | tool_calls={calls}")

    outputs = json.loads(OUTPUT_PATH.read_text()) if OUTPUT_PATH.exists() else []
    entry = {
        "run_id":          run_id,
        "triggered_by":    "ingestion",
        "trigger_article": trigger_slug,
        "fired":           fired,
        "model":           MODEL,
        "input_tokens":    in_tok,
        "output_tokens":   out_tok,
        "tool_calls":      calls,
    }
    if fired:
        entry["new_article"]           = {"slug": trigger_slug, "title": trigger_title}
        entry["surfaced_article"]      = result.get("surfaced_article")
        entry["relevance_explanation"] = result.get("relevance_explanation")
    else:
        entry["skip_reason"] = skip_reason

    outputs.append(entry)
    OUTPUT_PATH.write_text(json.dumps(outputs, indent=2))
    append_agent_log("reprise", run_id, "ingestion", trigger_slug, fired, skip_reason, in_tok, out_tok, calls)

    if fired:
        send_agent_notification("Reprise")


if __name__ == "__main__":
    main()
