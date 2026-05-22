"""
Mycelium surprise alert script — Phase 3 (weekly consolidated)
Runs every Sunday. Collects all new adjacent cross-domain connections
since the last alert run, ranks by domain surprise (cross-bucket pairs
ranked above same-bucket), takes the top 3, and sends ONE consolidated
email. Skips entirely if nothing qualifies.

No Claude API calls — pure logic.
"""

import json
import os
import smtplib
import sys
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

ARTICLES_DIR = Path("data/articles")
GRAPH_PATH   = Path("data/graph.json")
ALERTS_PATH  = Path("data/alerts.json")

MAX_ALERTS = 3

# Broad domain buckets for surprise scoring.
# Cross-bucket connections are ranked higher (more surprising).
DOMAIN_BUCKETS = {
    'tech':       ['tech', 'software', 'computer', 'ai', 'data', 'digital', 'machine learning'],
    'science':    ['science', 'biology', 'physics', 'neuro', 'cognitive', 'complexity', 'psychology'],
    'business':   ['business', 'econom', 'financ', 'marketing', 'management', 'organisat', 'organizational'],
    'humanities': ['philosoph', 'histor', 'sociol', 'political', 'media', 'culture', 'anthropol', 'geopolit'],
}


def get_bucket(domain: str) -> str:
    domain = domain.lower()
    for bucket, keywords in DOMAIN_BUCKETS.items():
        if any(k in domain for k in keywords):
            return bucket
    return 'other'


def surprise_score(domain_a: str, domain_b: str) -> int:
    """1 if domains are in different broad buckets (more surprising), 0 otherwise."""
    return 0 if get_bucket(domain_a) == get_bucket(domain_b) else 1


def load_articles() -> dict:
    articles = {}
    for path in ARTICLES_DIR.glob("*.json"):
        try:
            with open(path) as f:
                data = json.load(f)
            articles[data["slug"]] = data
        except (json.JSONDecodeError, KeyError, OSError):
            continue
    return articles


def send_consolidated_email(
    gmail_user: str,
    gmail_password: str,
    gmail_recipient: str,
    candidates: list[dict],
    articles: dict,
) -> None:
    n = len(candidates)
    subject = f"Mycelium: {n} unexpected connection{'s' if n != 1 else ''} this week"

    connection_blocks = ""
    for c in candidates:
        article_a = articles.get(c["source"], {})
        article_b = articles.get(c["target"], {})
        domain_a  = article_a.get("domain", "")
        domain_b  = article_b.get("domain", "")

        connection_blocks += f"""
<div style="background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:20px;margin-bottom:16px;">
  <div style="margin-bottom:12px;">
    <span style="display:inline-block;background:#e17055;color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;">adjacent</span>
    {"<span style='display:inline-block;background:#f0fdf4;color:#166534;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;margin-left:6px;'>cross-domain</span>" if surprise_score(domain_a, domain_b) else ""}
  </div>
  <p style="font-size:14px;color:#292524;line-height:1.6;margin:0 0 16px;">{c.get("explanation","")}</p>
  <div style="display:flex;gap:12px;flex-direction:column;">
    <div style="border-left:3px solid #e7e5e4;padding-left:12px;">
      <p style="font-size:10px;color:#a8a29e;margin:0 0 3px;">{domain_a.upper()}</p>
      <a href="{article_a.get('url','#')}" style="font-size:13px;font-weight:600;color:#1c1917;text-decoration:none;">{article_a.get('title','')}</a>
    </div>
    <div style="border-left:3px solid #e7e5e4;padding-left:12px;">
      <p style="font-size:10px;color:#a8a29e;margin:0 0 3px;">{domain_b.upper()}</p>
      <a href="{article_b.get('url','#')}" style="font-size:13px;font-weight:600;color:#1c1917;text-decoration:none;">{article_b.get('title','')}</a>
    </div>
  </div>
</div>"""

    html = f"""
<html><body style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;color:#1c1917;background:#fafaf8;">
<p style="font-size:13px;color:#78716c;margin-bottom:24px;">
  Mycelium found {n} non-obvious cross-domain connection{'s' if n != 1 else ''} in your reading this week.
</p>
{connection_blocks}
<p style="font-size:11px;color:#a8a29e;text-align:center;margin-top:24px;">Mycelium · your personal knowledge graph</p>
</body></html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = gmail_user
    msg["To"]      = gmail_recipient
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(gmail_user, gmail_password)
        server.sendmail(gmail_user, gmail_recipient, msg.as_string())


def main() -> None:
    gmail_user      = os.environ.get("GMAIL_USER", "").strip()
    gmail_password  = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
    gmail_recipient = os.environ.get("GMAIL_RECIPIENT", gmail_user).strip()

    if not gmail_user or not gmail_password:
        print("GMAIL_USER or GMAIL_APP_PASSWORD not set. Skipping alerts.")
        return

    articles = load_articles()
    print(f"Loaded {len(articles)} article(s).")

    with open(GRAPH_PATH) as f:
        graph = json.load(f)

    with open(ALERTS_PATH) as f:
        alerts_data = json.load(f)

    # Pairs already alerted — never re-send
    alerted_pairs = {
        frozenset([a["source"], a["target"]])
        for a in alerts_data.get("alerts", [])
    }

    # Collect all new adjacent cross-domain connections
    candidates = []
    for edge in graph.get("edges", []):
        if edge.get("type") != "adjacent":
            continue

        src, tgt = edge["source"], edge["target"]
        if frozenset([src, tgt]) in alerted_pairs:
            continue

        article_a = articles.get(src)
        article_b = articles.get(tgt)
        if not article_a or not article_b:
            continue

        domain_a = (article_a.get("domain") or "").strip().lower()
        domain_b = (article_b.get("domain") or "").strip().lower()
        if not domain_a or not domain_b or domain_a == domain_b:
            continue

        candidates.append({
            "source":    src,
            "target":    tgt,
            "domain_a":  domain_a,
            "domain_b":  domain_b,
            "explanation": edge.get("explanation", ""),
            "date_added":  edge.get("date_added", ""),
            "surprise":    surprise_score(domain_a, domain_b),
        })

    if not candidates:
        print("No new surprise connections this week. Skipping email.")
        return

    # Rank: cross-bucket first, then most recent
    candidates.sort(key=lambda c: (c["surprise"], c["date_added"]), reverse=True)
    top = candidates[:MAX_ALERTS]

    print(f"Found {len(candidates)} new candidate(s). Sending top {len(top)}.")

    try:
        send_consolidated_email(gmail_user, gmail_password, gmail_recipient, top, articles)
        print(f"Email sent: '{len(top)} unexpected connection(s) this week'")
    except Exception as e:
        print(f"ERROR sending email: {e}", file=sys.stderr)
        sys.exit(1)

    # Mark ALL candidates as alerted (not just top N) so they don't resurface
    now = datetime.now(timezone.utc).isoformat()
    new_alerts = [
        {
            "source":      c["source"],
            "target":      c["target"],
            "type":        "adjacent",
            "domain_a":    c["domain_a"],
            "domain_b":    c["domain_b"],
            "explanation": c["explanation"],
            "sent_at":     now if c in top else None,
            "included_in_email": c in top,
        }
        for c in candidates
    ]
    alerts_data["alerts"] = alerts_data.get("alerts", []) + new_alerts
    alerts_data["last_alerted_at"] = now

    with open(ALERTS_PATH, "w") as f:
        json.dump(alerts_data, f, indent=2, ensure_ascii=False)

    print(f"Logged {len(candidates)} alert record(s) to data/alerts.json.")
    print("--- Done ---")


if __name__ == "__main__":
    main()
