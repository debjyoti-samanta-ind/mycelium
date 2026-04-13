"""
Mycelium ingestion script — Phase 1
Reads data/queue.json, processes new URLs via r.jina.ai + Claude Haiku,
saves structured article JSON to data/articles/, updates data/graph.json.

Idempotent: skips any URL that already has a corresponding article file.
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import anthropic
import requests

QUEUE_PATH = Path("data/queue.json")
ARTICLES_DIR = Path("data/articles")
GRAPH_PATH = Path("data/graph.json")

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


def url_already_processed(url: str) -> bool:
    """Return True if an article with this URL already exists in data/articles/."""
    for article_path in ARTICLES_DIR.glob("*.json"):
        try:
            with open(article_path) as f:
                data = json.load(f)
            if data.get("url") == url:
                return True
        except (json.JSONDecodeError, OSError):
            continue
    return False


def fetch_via_jina(url: str) -> str:
    """Fetch article text via r.jina.ai/{url}."""
    jina_url = f"https://r.jina.ai/{url}"
    print(f"  Fetching via r.jina.ai: {jina_url}")
    response = requests.get(
        jina_url,
        timeout=30,
        headers={"Accept": "text/plain", "User-Agent": "Mycelium/1.0"},
    )
    response.raise_for_status()
    text = response.text
    print(f"  Fetched {len(text):,} characters.")
    return text


def extract_with_claude(text: str, url: str) -> dict:
    """
    Call Claude Haiku to extract structured article data.
    Logs token usage to console for cost monitoring.
    Returns a dict matching the article JSON schema.
    """
    prompt = f"""Extract structured information from this article. Reply with ONLY valid JSON — no markdown fences, no commentary.

Article URL: {url}

Article text (truncated to 8 000 chars):
{text[:8000]}

Return exactly this JSON structure:
{{
  "title": "full article title",
  "source": "publication name (e.g. The Atlantic, Wired, Nature)",
  "published_date": "YYYY-MM-DD or null if not found",
  "content_type": "essay|news|thread|summary",
  "summary": "3 sentences capturing what the article argues, not just what it covers",
  "central_argument": "one sentence — the single strongest claim the article makes",
  "key_claims": ["atomic claim 1", "atomic claim 2"],
  "key_tensions": ["thing the article argues against 1", "idea it complicates 2"],
  "domain": "the intellectual discipline this article comes from",
  "stance": "optimistic|pessimistic|neutral|ambivalent",
  "key_entities": ["named framework, theory, person, or study 1", "named reference 2"],
  "slug": "human-readable-slug-derived-from-title"
}}

Extraction rules — follow precisely:
- summary: exactly 3 sentences, factual, captures the argument not just the topic
- central_argument: one sentence only; must commit to a position ("X causes Y", "Z fails because..."); never hedge or describe ("the article explores...", "it argues that...")
- key_claims: extract only specific, atomic, falsifiable claims from the article; do NOT pad to hit a number; a short punchy article might yield 2–3, a dense essay might yield 8–9; omit vague or general observations
- key_tensions: 2–3 things the article explicitly argues against, pushes back on, or complicates — things the article itself names, not general counterarguments you infer
- domain: return the intellectual discipline or tradition, NOT the subject matter or topic; "AI" is a topic, "cognitive science" is a domain; valid examples: cognitive science, economics, philosophy, organisational behaviour, political theory, sociology, complexity theory, evolutionary biology, media studies
- stance: one word only, chosen from exactly these four: optimistic, pessimistic, neutral, ambivalent — toward the article's own central argument
- key_entities: named frameworks, theories, people, or studies the article explicitly engages with as intellectual references or lineage; NOT illustrative examples or passing mentions; e.g. "dual-process theory (Kahneman)", "Herbert Simon", "Dunbar's number"
- slug: lowercase, hyphens only, max 60 chars, derived from title"""

    MODEL = "claude-haiku-4-5-20251001"

    response = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    # Log token usage for cost monitoring
    usage = response.usage
    print(
        f"  Model: {MODEL} — input: {usage.input_tokens} tokens, "
        f"output: {usage.output_tokens} tokens"
    )

    raw = response.content[0].text.strip()

    # Strip markdown code fences if Claude added them anyway
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    return json.loads(raw)


def make_slug_unique(slug: str, existing_slugs: set[str]) -> str:
    """Append a numeric suffix if the slug is already taken."""
    if slug not in existing_slugs:
        return slug
    i = 2
    while f"{slug}-{i}" in existing_slugs:
        i += 1
    return f"{slug}-{i}"


def main() -> None:
    ARTICLES_DIR.mkdir(parents=True, exist_ok=True)

    # --- Load queue ---
    with open(QUEUE_PATH) as f:
        queue = json.load(f)

    entries = queue.get("urls", [])
    if not entries:
        print("Queue is empty. Nothing to process.")
        return

    print(f"Queue contains {len(entries)} URL(s).")

    # --- Load graph ---
    with open(GRAPH_PATH) as f:
        graph = json.load(f)

    existing_node_ids = {n["id"] for n in graph.get("nodes", [])}
    existing_slugs = {p.stem for p in ARTICLES_DIR.glob("*.json")}
    graph_updated = False
    processed_count = 0
    error_count = 0

    # --- Process each entry ---
    for entry in entries:
        # Support both plain string URLs and {url, text, added_at} objects
        if isinstance(entry, str):
            url = entry
            pasted_text = None
        else:
            url = entry.get("url", "").strip()
            pasted_text = entry.get("text") or None

        if not url:
            print("  Skipping entry with no URL.")
            continue

        # Idempotency check
        if url_already_processed(url):
            print(f"  Already processed, skipping: {url}")
            continue

        print(f"\nProcessing: {url}")

        try:
            # Fetch article text
            if pasted_text:
                print("  Using pasted text (skipping r.jina.ai).")
                article_text = pasted_text
            else:
                article_text = fetch_via_jina(url)

            if not article_text.strip():
                raise ValueError("Fetched text is empty — article may be inaccessible.")

            # Extract structured data
            print("  Calling Claude for extraction...")
            extracted = extract_with_claude(article_text, url)

            # Ensure slug uniqueness
            raw_slug = extracted.get("slug") or "article"
            slug = make_slug_unique(raw_slug, existing_slugs)
            existing_slugs.add(slug)

            # Build article record
            article = {
                "slug": slug,
                "title": extracted.get("title", "Untitled"),
                "source": extracted.get("source", "Unknown"),
                "url": url,
                "date_added": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "published_date": extracted.get("published_date"),
                "content_type": extracted.get("content_type", "essay"),
                "read_depth": "full",
                "summary": extracted.get("summary", ""),
                "central_argument": extracted.get("central_argument", ""),
                "key_claims": extracted.get("key_claims", []),
                "key_tensions": extracted.get("key_tensions", []),
                "domain": extracted.get("domain", ""),
                "stance": extracted.get("stance", "neutral"),
                "key_entities": extracted.get("key_entities", []),
            }

            # Save article file
            article_path = ARTICLES_DIR / f"{slug}.json"
            with open(article_path, "w") as f:
                json.dump(article, f, indent=2, ensure_ascii=False)
            print(f"  Saved: data/articles/{slug}.json")

            # Add node to graph if not present
            if slug not in existing_node_ids:
                graph["nodes"].append({"id": slug, "type": "article"})
                existing_node_ids.add(slug)
                graph_updated = True

            processed_count += 1

        except Exception as e:
            print(f"  ERROR processing {url}: {e}", file=sys.stderr)
            error_count += 1
            continue

    # --- Persist graph if changed ---
    if graph_updated:
        with open(GRAPH_PATH, "w") as f:
            json.dump(graph, f, indent=2, ensure_ascii=False)
        print(f"\nGraph updated with {processed_count} new node(s).")

    # --- Summary ---
    print(f"\n--- Done ---")
    print(f"Processed: {processed_count}  |  Skipped (errors): {error_count}")

    if error_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
