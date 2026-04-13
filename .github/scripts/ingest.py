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
  "content_type": "essay|news|research|opinion|interview|other",
  "summary": "3-sentence summary covering the main argument and key insight",
  "key_claims": ["specific claim 1", "specific claim 2", "specific claim 3"],
  "topic_tags": ["tag1", "tag2"],
  "slug": "human-readable-slug-derived-from-title"
}}

Rules:
- summary: exactly 3 sentences, factual, no fluff
- key_claims: 3–5 specific, falsifiable claims from the article
- topic_tags: 2–4 lowercase single-word tags from: ai, technology, productivity, business, society, science, health, politics, economics, culture
- slug: lowercase, hyphens only, max 60 chars, derived from title"""

    MODEL = "claude-sonnet-4-6"  # TEMPORARY — swap back to claude-haiku-4-5-20251001 after test

    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
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
                "content_type": extracted.get("content_type", "other"),
                "summary": extracted.get("summary", ""),
                "key_claims": extracted.get("key_claims", []),
                "topic_tags": extracted.get("topic_tags", []),
                "read_depth": "full",
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
