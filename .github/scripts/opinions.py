"""
Mycelium opinion synthesis script — Phase 3
Runs weekly. Passes all articles to Claude Sonnet, which identifies
recurring intellectual themes and synthesises the position Debjyoti's
reading seems to be building toward on each theme.

Writes data/opinions.json.
Uses Sonnet (not Haiku) — this is a synthesis job, not high-frequency.
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import anthropic

ARTICLES_DIR = Path("data/articles")
OPINIONS_PATH = Path("data/opinions.json")

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
MODEL = "claude-sonnet-4-6"
MIN_ARTICLES = 3  # Don't synthesise opinions until there's enough signal


def article_digest(a: dict) -> str:
    """Compact representation of an article for the Sonnet prompt."""
    claims = " | ".join(a.get("key_claims", []))
    tensions = " | ".join(a.get("key_tensions", []))
    return (
        f"[{a.get('slug', '?')}]\n"
        f"Title: {a.get('title', 'Unknown')}\n"
        f"Domain: {a.get('domain', 'unknown')} | Stance: {a.get('stance', 'unknown')}\n"
        f"Central argument: {a.get('central_argument') or a.get('summary', '')}\n"
        f"Key claims: {claims or 'none'}\n"
        f"Argues against: {tensions or 'none'}"
    )


def synthesise_opinions(articles: list[dict]) -> list[dict]:
    """
    Call Claude Sonnet to identify recurring themes and synthesise opinions.
    Returns a list of opinion dicts.
    Logs token usage for cost monitoring.
    """
    digests = "\n\n---\n\n".join(article_digest(a) for a in articles)

    prompt = f"""You are analysing the reading history of a curious, intellectually serious person (Debjyoti) to identify the intellectual positions his reading is building toward.

Here are all {len(articles)} articles he has read, with their key arguments:

{digests}

---

Identify 2–4 recurring intellectual themes across these articles. For each theme:
1. Give it a short, specific name (not a topic label — a genuine intellectual question or tension)
2. Write the position his reading seems to be building toward — be direct and commit to a view, as if you are articulating his emerging opinion
3. Identify one genuine tension or counterpoint surfaced by his reading

Reply with ONLY valid JSON — no markdown fences:
{{
  "opinions": [
    {{
      "theme": "short specific theme name",
      "article_slugs": ["slug1", "slug2"],
      "position": "2–3 sentences articulating the emerging intellectual position directly and confidently",
      "tension": "1–2 sentences on a genuine tension or complication his reading surfaces"
    }}
  ]
}}

Rules:
- theme: a specific intellectual question, not a broad topic ("Does AI augmentation deepen or flatten thinking?" not "AI and cognition")
- position: write as if articulating Debjyoti's view — direct, not hedged ("Your reading suggests X" not "the articles explore Y")
- Only include themes where at least 2 articles contribute meaningfully
- article_slugs: list only the slugs of articles that genuinely contribute to this theme"""

    response = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    usage = response.usage
    print(
        f"Model: {MODEL} — input: {usage.input_tokens} tokens, "
        f"output: {usage.output_tokens} tokens"
    )

    raw = response.content[0].text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    result = json.loads(raw)
    return result.get("opinions", [])


def main() -> None:
    # Load articles
    article_files = list(ARTICLES_DIR.glob("*.json"))
    articles = []
    for path in article_files:
        try:
            with open(path) as f:
                data = json.load(f)
            articles.append(data)
        except (json.JSONDecodeError, OSError) as e:
            print(f"  Skipping {path.name}: {e}", file=sys.stderr)

    print(f"Loaded {len(articles)} article(s).")

    if len(articles) < MIN_ARTICLES:
        print(f"Need at least {MIN_ARTICLES} articles to synthesise opinions. Exiting.")
        return

    print(f"Calling Claude Sonnet for opinion synthesis...")
    opinions = synthesise_opinions(articles)

    if not opinions:
        print("No opinions returned. Exiting.")
        return

    # Stamp with generation date
    output = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "opinions": [
            {**op, "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
            for op in opinions
        ],
    }

    with open(OPINIONS_PATH, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Wrote {len(opinions)} opinion(s) to data/opinions.json.")
    print("\n--- Done ---")


if __name__ == "__main__":
    main()
