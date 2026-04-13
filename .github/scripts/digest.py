"""
Mycelium monthly digest script — Phase 4
Runs on the 1st of each month. Covers articles added in the previous calendar month.
Synthesises a rich analyst-voice narrative using Claude Sonnet.
Writes data/digests/YYYY-MM.json and emails the digest via Gmail SMTP.

Model: Claude Sonnet (synthesis job, not high-frequency).
Cost note: One call per month — well within the $2/month budget.
"""

import json
import os
import re
import smtplib
import sys
from datetime import datetime, timezone, date, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import anthropic

ARTICLES_DIR = Path("data/articles")
GRAPH_PATH = Path("data/graph.json")
OPINIONS_PATH = Path("data/opinions.json")
DIGESTS_DIR = Path("data/digests")

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
MODEL = "claude-sonnet-4-6"


def previous_month_range() -> tuple[date, date, str]:
    """Return (start_date, end_date, 'YYYY-MM') for the previous calendar month."""
    today = date.today()
    first_of_this_month = today.replace(day=1)
    last_of_prev = first_of_this_month - timedelta(days=1)
    first_of_prev = last_of_prev.replace(day=1)
    month_str = first_of_prev.strftime("%Y-%m")
    return first_of_prev, last_of_prev, month_str


def load_articles_for_month(start: date, end: date) -> list[dict]:
    """Load articles whose date_added falls within [start, end]."""
    results = []
    for path in ARTICLES_DIR.glob("*.json"):
        try:
            with open(path) as f:
                data = json.load(f)
            added_str = data.get("date_added", "")
            if not added_str:
                continue
            added = date.fromisoformat(added_str)
            if start <= added <= end:
                results.append(data)
        except (json.JSONDecodeError, ValueError, OSError) as e:
            print(f"  Skipping {path.name}: {e}", file=sys.stderr)
    return results


def edges_for_month(graph: dict, article_slugs: set) -> list[dict]:
    """Return edges where at least one endpoint is an article added this month."""
    month_edges = []
    for edge in graph.get("edges", []):
        if edge.get("source") in article_slugs or edge.get("target") in article_slugs:
            month_edges.append(edge)
    return month_edges


def article_digest_str(a: dict) -> str:
    """Compact enriched representation for the Sonnet prompt."""
    claims = " | ".join(a.get("key_claims", []))
    tensions = " | ".join(a.get("key_tensions", []))
    return (
        f"[{a.get('slug', '?')}] {a.get('title', 'Unknown')}\n"
        f"Domain: {a.get('domain', 'unknown')} | Stance: {a.get('stance', 'unknown')}\n"
        f"Central argument: {a.get('central_argument') or a.get('summary', '')}\n"
        f"Key claims: {claims or 'none'}\n"
        f"Argues against: {tensions or 'none'}"
    )


def edge_str(edge: dict, article_slugs_in_month: set) -> str:
    src = edge.get("source", "?")
    tgt = edge.get("target", "?")
    tag = " [NEW THIS MONTH]" if src in article_slugs_in_month and tgt in article_slugs_in_month else ""
    return f"  {src} ↔ {tgt} ({edge.get('type', '?')}){tag}: {edge.get('explanation', '')}"


def synthesise_digest(
    month_str: str,
    articles_this_month: list[dict],
    month_edges: list[dict],
    opinions: list[dict],
    month_slugs: set,
) -> dict:
    """
    Call Claude Sonnet for a rich analyst-voice monthly digest.
    Returns a structured dict.
    Logs token usage for cost monitoring.
    """
    articles_section = "\n\n".join(article_digest_str(a) for a in articles_this_month)
    edges_section = "\n".join(edge_str(e, month_slugs) for e in month_edges) or "None yet."
    opinions_section = "\n".join(
        f"- {op.get('theme', '?')}: {op.get('position', '')}"
        for op in opinions
    ) or "No opinions synthesised yet."

    prompt = f"""You are writing a monthly intellectual digest for Debjyoti, a curious and analytically serious reader. This digest covers {month_str}.

ARTICLES READ THIS MONTH ({len(articles_this_month)}):
{articles_section}

CONNECTIONS INVOLVING THIS MONTH'S ARTICLES:
{edges_section}

CURRENT INTELLECTUAL POSITIONS (from opinion synthesis):
{opinions_section}

---

Write a rich analyst-voice digest. Be direct, specific, and intellectually honest. Avoid generic phrasing like "explores", "delves into", or "highlights". Commit to views.

Reply with ONLY valid JSON — no markdown fences, no commentary:
{{
  "narrative": "3–5 sentences. What was the intellectual character of this month's reading? What argument or tension runs through it? Speak directly about Debjyoti's reading, not abstractly about the articles.",
  "opinion_shifts": "1–3 sentences. Have any of his positions strengthened, weakened, or complicated based on this month's reading? If no shift is detectable, say so plainly.",
  "tensions": ["one specific unresolved tension surfaced this month", "optionally a second — only if genuinely distinct from the first"],
  "surprise_connection": "The most non-obvious connection found this month, or 'None this month.' if there isn't one. Include the two article slugs and why the connection is surprising."
}}"""

    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
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
    return json.loads(raw)


def send_digest_email(
    gmail_user: str,
    gmail_password: str,
    gmail_recipient: str,
    month_str: str,
    digest: dict,
    articles_this_month: list[dict],
    month_edges: list[dict],
    month_slugs: set,
) -> None:
    """Send the monthly digest as a formatted HTML email."""
    month_label = datetime.strptime(month_str, "%Y-%m").strftime("%B %Y")
    subject = f"Mycelium: Monthly digest — {month_label}"

    tensions_html = "".join(
        f'<li style="margin-bottom: 8px; color: #44403c;">{t}</li>'
        for t in digest.get("tensions", [])
    )

    html = f"""
<html><body style="font-family: Georgia, serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #1c1917; background: #fafaf8;">

<p style="font-size: 13px; color: #78716c; margin-bottom: 8px; letter-spacing: 0.05em; text-transform: uppercase;">Monthly Digest</p>
<h1 style="font-size: 22px; font-weight: 600; color: #1c1917; margin: 0 0 24px;">{month_label}</h1>

<p style="font-size: 12px; color: #a8a29e; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.05em;">This month</p>
<p style="font-size: 14px; color: #78716c; margin: 0 0 24px;">
  {len(articles_this_month)} article{'s' if len(articles_this_month) != 1 else ''} &nbsp;·&nbsp;
  {len(month_edges)} connection{'s' if len(month_edges) != 1 else ''}
</p>

<div style="background: #fff; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
  <p style="font-size: 11px; color: #a8a29e; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.05em;">Reading this month</p>
  <p style="font-size: 15px; color: #1c1917; line-height: 1.7; margin: 0;">{digest.get("narrative", "")}</p>
</div>

<div style="background: #fff; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
  <p style="font-size: 11px; color: #a8a29e; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.05em;">Opinion shifts</p>
  <p style="font-size: 14px; color: #44403c; line-height: 1.7; margin: 0;">{digest.get("opinion_shifts", "")}</p>
</div>

{f'''<div style="background: #fff; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
  <p style="font-size: 11px; color: #a8a29e; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.05em;">Tensions surfaced</p>
  <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.7;">{tensions_html}</ul>
</div>''' if tensions_html else ''}

<div style="background: #fff; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
  <p style="font-size: 11px; color: #a8a29e; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.05em;">Most surprising connection</p>
  <p style="font-size: 14px; color: #44403c; line-height: 1.7; margin: 0;">{digest.get("surprise_connection", "None this month.")}</p>
</div>

<p style="font-size: 11px; color: #a8a29e; text-align: center; margin-top: 32px;">Mycelium · your personal knowledge graph</p>
</body></html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = gmail_user
    msg["To"] = gmail_recipient
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(gmail_user, gmail_password)
        server.sendmail(gmail_user, gmail_recipient, msg.as_string())


def month_range_for(month_str: str) -> tuple[date, date]:
    """Return (start_date, end_date) for a given 'YYYY-MM' string."""
    year, month = int(month_str[:4]), int(month_str[5:7])
    start = date(year, month, 1)
    # Last day: first day of next month minus 1
    if month == 12:
        end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(year, month + 1, 1) - timedelta(days=1)
    return start, end


def main() -> None:
    target = os.environ.get("TARGET_MONTH", "").strip()
    if target:
        try:
            start, end = month_range_for(target)
            month_str = target
            print(f"Using TARGET_MONTH override: {month_str}")
        except (ValueError, IndexError):
            print(f"ERROR: Invalid TARGET_MONTH '{target}'. Expected YYYY-MM.", file=sys.stderr)
            sys.exit(1)
    else:
        start, end, month_str = previous_month_range()

    print(f"Generating digest for {month_str} (articles from {start} to {end})")

    # Check if digest already exists (idempotency)
    DIGESTS_DIR.mkdir(parents=True, exist_ok=True)
    digest_path = DIGESTS_DIR / f"{month_str}.json"
    if digest_path.exists():
        print(f"Digest for {month_str} already exists at {digest_path}. Skipping.")
        return

    # Load articles for this month
    articles_this_month = load_articles_for_month(start, end)
    print(f"Articles added in {month_str}: {len(articles_this_month)}")

    if not articles_this_month:
        print(f"No articles added in {month_str}. Nothing to digest.")
        return

    # Load graph and opinions for context
    with open(GRAPH_PATH) as f:
        graph = json.load(f)

    try:
        with open(OPINIONS_PATH) as f:
            opinions_data = json.load(f)
        opinions = opinions_data.get("opinions", [])
    except (OSError, json.JSONDecodeError):
        opinions = []

    month_slugs = {a["slug"] for a in articles_this_month}
    month_edges = edges_for_month(graph, month_slugs)

    print(f"Connections involving this month's articles: {len(month_edges)}")
    print(f"Calling Claude Sonnet for digest synthesis...")

    try:
        synthesis = synthesise_digest(
            month_str,
            articles_this_month,
            month_edges,
            opinions,
            month_slugs,
        )
    except Exception as e:
        print(f"ERROR: Sonnet call failed: {e}", file=sys.stderr)
        sys.exit(1)

    # Build final digest object
    digest_obj = {
        "month": month_str,
        "generated_at": date.today().isoformat(),
        "articles_this_month": len(articles_this_month),
        "new_edges_this_month": len(month_edges),
        "narrative": synthesis.get("narrative", ""),
        "opinion_shifts": synthesis.get("opinion_shifts", ""),
        "tensions": synthesis.get("tensions", []),
        "surprise_connection": synthesis.get("surprise_connection", ""),
    }

    with open(digest_path, "w") as f:
        json.dump(digest_obj, f, indent=2, ensure_ascii=False)
    print(f"Wrote digest to {digest_path}.")

    # Email the digest
    gmail_user = os.environ.get("GMAIL_USER", "").strip()
    gmail_password = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
    gmail_recipient = os.environ.get("GMAIL_RECIPIENT", gmail_user).strip()

    if not gmail_user or not gmail_password:
        print("GMAIL_USER or GMAIL_APP_PASSWORD not set. Skipping email.")
    else:
        try:
            send_digest_email(
                gmail_user, gmail_password, gmail_recipient,
                month_str, digest_obj, articles_this_month, month_edges, month_slugs,
            )
            print(f"Digest email sent to {gmail_recipient}.")
        except Exception as e:
            print(f"ERROR sending digest email: {e}", file=sys.stderr)
            # Non-fatal — digest is already written to disk
            print("Digest was saved to disk. Email failure is non-fatal.")

    print("\n--- Done ---")


if __name__ == "__main__":
    main()
