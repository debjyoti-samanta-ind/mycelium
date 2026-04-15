"""
Mycelium Blind Spot agent — Phase 7
Runs on the 1st of each month (via blind_spot.yml).
Identifies the single most important adjacent intellectual domain that Debjyoti
is systematically ignoring, grounded in specific open questions from actual articles.

True agent: Claude drives the process via tool-use API in a multi-step loop.
Model: Claude Sonnet — synthesis job.
Idempotent: skips if a fired output for the current month already exists.
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
    get_articles_by_filter,
    append_agent_log,
    send_agent_notification,
)

DATA_DIR     = Path("data")
OUTPUT_PATH  = DATA_DIR / "blind_spot_outputs.json"
MODEL        = "claude-sonnet-4-6"
MIN_ARTICLES = 10

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

SYSTEM_PROMPT = """You are a reading coverage agent. Once a month you look at everything \
Debjyoti has read and identify the single most important intellectual domain he is \
systematically ignoring — one that would directly address questions his current reading \
raises but leaves unanswered.

Step 1: Map his reading landscape.
Use get_graph_summary() to see all articles. Note which domains are well-represented and \
which are absent or thin.

Step 2: Understand what questions his reading is grappling with.
Build a shortlist of 6–10 articles to read in detail — prioritise those with the most \
connections (high degree). Read them using get_article(). Look for recurring open questions: \
things his reading circles around but doesn't resolve.

Step 3: Identify the blind spot.
Find the one adjacent domain that would most directly address those open questions. \
Adjacent means: not already well-represented in his graph, but clearly relevant to the \
questions his reading raises.

Step 4: Explain specifically.
Name 2–3 actual questions from actual articles that this domain would help answer. \
Cite specific articles by title.

Rules:
- Name exactly one domain, or stay silent.
- The domain name alone is not acceptable. You must specify the precise intellectual \
  angle within that domain. \
  Bad: "You should read more political theory." \
  Good: "Political theory — specifically how institutions derive and maintain epistemic \
  authority — would directly address the questions your articles on AI and credentialism keep raising."
- Do not name authors or books. Name the precise subfield or question-space.
- Generic observations are not acceptable. The blind spot must be grounded in specific \
  questions that specific articles raised.
- Do not call get_article() speculatively — only for shortlisted candidates.
- If you cannot find a blind spot that clears the specificity bar, call finish() with fired=false."""

TOOLS = [
    {
        "name": "get_graph_summary",
        "description": "Returns all articles with metadata and degree. Use to map the reading landscape and build a shortlist before reading articles in detail.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_article",
        "description": "Returns enriched fields for one article. Only call for shortlisted articles you have a hypothesis about.",
        "input_schema": {
            "type": "object",
            "properties": {"slug": {"type": "string"}},
            "required": ["slug"],
        },
    },
    {
        "name": "get_articles_by_filter",
        "description": "Returns articles matching domain, stance, or tag filters. Useful for understanding depth of coverage in a specific domain.",
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
        "description": "Call when analysis is complete. Set fired=true with blind_spot block, or fired=false with skip_reason.",
        "input_schema": {
            "type": "object",
            "properties": {
                "fired":       {"type": "boolean"},
                "skip_reason": {"type": "string"},
                "blind_spot": {
                    "type": "object",
                    "properties": {
                        "domain":                        {"type": "string"},
                        "why_adjacent":                  {"type": "string"},
                        "open_questions_it_addresses":   {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "grounded_in": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Article slugs whose questions this domain would address",
                        },
                        "explanation": {"type": "string"},
                    },
                    "required": ["domain", "why_adjacent", "open_questions_it_addresses", "grounded_in", "explanation"],
                },
            },
            "required": ["fired"],
        },
    },
]


def get_last_month_domain() -> str | None:
    """Returns the domain flagged last month, if any, for persistent_gap detection."""
    if not OUTPUT_PATH.exists():
        return None
    outputs = json.loads(OUTPUT_PATH.read_text())
    fired_outputs = [o for o in outputs if o.get("fired")]
    if not fired_outputs:
        return None
    return fired_outputs[-1].get("blind_spot", {}).get("domain")


def execute_tool(name: str, inputs: dict) -> dict:
    if name == "get_graph_summary":
        return get_graph_summary()
    if name == "get_article":
        return get_article(inputs["slug"])
    if name == "get_articles_by_filter":
        return get_articles_by_filter(**{k: v for k, v in inputs.items() if v})
    return {"error": f"Unknown tool: {name}"}


def run_agent() -> tuple[dict, int, int, int]:
    messages: list[dict] = []
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
    run_id = date.today().strftime("%Y-%m")

    # Idempotency check
    if OUTPUT_PATH.exists():
        outputs = json.loads(OUTPUT_PATH.read_text())
        if any(o.get("run_id") == run_id and o.get("fired") for o in outputs):
            print(f"Blind Spot: Output for {run_id} already exists. Skipping.")
            return

    summary = get_graph_summary()
    if summary["total"] < MIN_ARTICLES:
        print(f"Blind Spot: {summary['total']} articles — below {MIN_ARTICLES} minimum. Skipping.")
        append_agent_log("blind_spot", run_id, "monthly_cron", None, False,
                         f"Only {summary['total']} articles (min {MIN_ARTICLES})", 0, 0, 0)
        return

    last_month_domain = get_last_month_domain()
    print(f"Blind Spot: Running for {run_id}. Graph has {summary['total']} articles.")

    result, in_tok, out_tok, calls = run_agent()

    fired       = result.get("fired", False)
    skip_reason = result.get("skip_reason")

    print(f"Blind Spot: fired={fired} | input_tokens={in_tok} | output_tokens={out_tok} | tool_calls={calls}")

    outputs = json.loads(OUTPUT_PATH.read_text()) if OUTPUT_PATH.exists() else []
    entry = {
        "run_id":       run_id,
        "triggered_by": "monthly_cron",
        "fired":        fired,
        "graph_snapshot": {
            "total_articles":      summary["total"],
            "represented_domains": list({a["domain"] for a in summary["articles"] if a["domain"]}),
        },
        "model":         MODEL,
        "input_tokens":  in_tok,
        "output_tokens": out_tok,
        "tool_calls":    calls,
    }
    if fired:
        blind_spot = result.get("blind_spot", {})
        if last_month_domain and last_month_domain.lower() == blind_spot.get("domain", "").lower():
            blind_spot["persistent_gap"] = True
        entry["blind_spot"] = blind_spot
    else:
        entry["skip_reason"] = skip_reason

    outputs.append(entry)
    OUTPUT_PATH.write_text(json.dumps(outputs, indent=2))
    append_agent_log("blind_spot", run_id, "monthly_cron", None, fired, skip_reason, in_tok, out_tok, calls)

    if fired:
        send_agent_notification("Blind Spot")


if __name__ == "__main__":
    main()
