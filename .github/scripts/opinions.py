"""
Mycelium opinion synthesis script — Phase 3 (incremental update)
Runs weekly. On first run or when FORCE_FULL=true, passes all articles to
Claude Sonnet for a full synthesis. On subsequent runs, passes only new
articles (since last generated_at) alongside existing opinions for an
incremental update. Skips entirely if no new articles.

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

ARTICLES_DIR  = Path("data/articles")
OPINIONS_PATH = Path("data/opinions.json")

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
MODEL  = "claude-sonnet-4-6"
MIN_ARTICLES = 3


def article_digest(a: dict) -> str:
    """Compact representation of an article for the Sonnet prompt."""
    claims   = " | ".join(a.get("key_claims", []))
    tensions = " | ".join(a.get("key_tensions", []))
    return (
        f"[{a.get('slug', '?')}]\n"
        f"Title: {a.get('title', 'Unknown')}\n"
        f"Domain: {a.get('domain', 'unknown')} | Stance: {a.get('stance', 'unknown')}\n"
        f"Central argument: {a.get('central_argument') or a.get('summary', '')}\n"
        f"Key claims: {claims or 'none'}\n"
        f"Argues against: {tensions or 'none'}"
    )


def call_sonnet(prompt: str) -> list[dict]:
    """Send prompt to Sonnet, parse JSON response, log token usage."""
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


def full_recompute_prompt(articles: list[dict]) -> str:
    digests = "\n\n---\n\n".join(article_digest(a) for a in articles)
    return f"""You are analysing the reading history of a curious, intellectually serious person (Debjyoti) to identify the intellectual positions his reading is building toward.

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


def incremental_update_prompt(existing_opinions: list[dict], new_articles: list[dict]) -> str:
    opinions_summary = "\n\n".join(
        f"Theme: {op['theme']}\n"
        f"Current position: {op['position']}\n"
        f"Tension: {op.get('tension', 'none')}\n"
        f"Based on: {', '.join(op.get('article_slugs', []))}"
        for op in existing_opinions
    )
    new_digests = "\n\n---\n\n".join(article_digest(a) for a in new_articles)
    return f"""You are updating the intellectual positions of a curious, intellectually serious person (Debjyoti) based on new reading.

Here are his current opinions, synthesised from his reading to date:

{opinions_summary}

---

Here are {len(new_articles)} new articles he has read since the last synthesis:

{new_digests}

---

Update the opinions based on this new reading. For each existing opinion:
- If new articles strengthen, weaken, or meaningfully shift the position — update it
- If new articles don't touch the theme — keep the opinion exactly as is (copy it unchanged)
- Add a new opinion only if a genuinely distinct new theme emerges from the new articles (not already covered)

Reply with ONLY valid JSON — no markdown fences. Return ALL opinions (updated and unchanged):
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
- Keep existing article_slugs and add new ones where relevant — do not drop slugs from existing opinions
- position: write as if articulating Debjyoti's view — direct, not hedged
- Only add a new theme if at least 2 new articles contribute to it and it is genuinely distinct from existing themes"""


def load_articles() -> list[dict]:
    articles = []
    for path in ARTICLES_DIR.glob("*.json"):
        try:
            with open(path) as f:
                articles.append(json.load(f))
        except (json.JSONDecodeError, OSError) as e:
            print(f"  Skipping {path.name}: {e}", file=sys.stderr)
    return articles


def main() -> None:
    force_full = os.environ.get("FORCE_FULL", "").lower() in ("true", "1", "yes")

    articles = load_articles()
    print(f"Loaded {len(articles)} article(s).")

    if len(articles) < MIN_ARTICLES:
        print(f"Need at least {MIN_ARTICLES} articles to synthesise opinions. Exiting.")
        return

    # Load existing opinions if available
    existing_opinions = []
    last_generated_at = None
    if OPINIONS_PATH.exists() and not force_full:
        try:
            with open(OPINIONS_PATH) as f:
                existing_data = json.load(f)
            existing_opinions = existing_data.get("opinions", [])
            last_generated_at = existing_data.get("generated_at")
            print(f"Found {len(existing_opinions)} existing opinion(s), last generated {last_generated_at}.")
        except (json.JSONDecodeError, OSError) as e:
            print(f"Could not load existing opinions ({e}), falling back to full recompute.")
            existing_opinions = []
            last_generated_at = None

    # Decide: full recompute or incremental
    if force_full or not existing_opinions or not last_generated_at:
        if force_full:
            print("Force full recompute requested.")
        else:
            print("No existing opinions — running full recompute.")
        prompt  = full_recompute_prompt(articles)
        opinions = call_sonnet(prompt)
    else:
        # Incremental: only articles newer than last run
        new_articles = [
            a for a in articles
            if a.get("date_added", "") > last_generated_at
        ]
        if not new_articles:
            print(f"No new articles since {last_generated_at}. Nothing to update.")
            return
        print(f"{len(new_articles)} new article(s) since {last_generated_at} — running incremental update.")
        prompt   = incremental_update_prompt(existing_opinions, new_articles)
        opinions = call_sonnet(prompt)

    if not opinions:
        print("No opinions returned. Exiting.")
        return

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
    print("--- Done ---")


if __name__ == "__main__":
    main()
