"""
Mycelium surprise alert script — Phase 3
Runs after every connection-finding workflow.
Finds adjacent connections between articles from different intellectual domains
and sends a Gmail alert. Tracks sent alerts in data/alerts.json to avoid duplicates.
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
GRAPH_PATH = Path("data/graph.json")
ALERTS_PATH = Path("data/alerts.json")


def load_articles() -> dict:
    """Load all articles into a slug-keyed dict."""
    articles = {}
    for path in ARTICLES_DIR.glob("*.json"):
        try:
            with open(path) as f:
                data = json.load(f)
            articles[data["slug"]] = data
        except (json.JSONDecodeError, KeyError, OSError):
            continue
    return articles


def send_email(gmail_user: str, gmail_password: str, article_a: dict, article_b: dict, connection: dict) -> None:
    """Send a surprise connection alert email."""
    subject = f"Mycelium: Unexpected connection found"

    html = f"""
<html><body style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1c1917; background: #fafaf8;">

<p style="font-size: 13px; color: #78716c; margin-bottom: 24px;">Mycelium found a non-obvious cross-domain connection in your reading.</p>

<div style="background: #fff; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
  <p style="font-size: 11px; color: #a8a29e; margin: 0 0 6px;">CONNECTION TYPE</p>
  <span style="display: inline-block; background: #e17055; color: #fff; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px;">adjacent</span>
  <p style="margin: 16px 0 0; font-size: 15px; color: #292524; line-height: 1.6;">{connection.get("explanation", "")}</p>
</div>

<div style="background: #fff; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
  <p style="font-size: 11px; color: #a8a29e; margin: 0 0 10px;">ARTICLE A &nbsp;·&nbsp; {article_a.get("domain", "")}</p>
  <a href="{article_a.get("url", "#")}" style="font-size: 14px; font-weight: 600; color: #1c1917; text-decoration: none;">{article_a.get("title", "")}</a>
  <p style="font-size: 12px; color: #78716c; margin: 4px 0 10px;">{article_a.get("source", "")}</p>
  <p style="font-size: 13px; color: #44403c; line-height: 1.6; margin: 0;">{article_a.get("central_argument") or article_a.get("summary", "")}</p>
</div>

<div style="background: #fff; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
  <p style="font-size: 11px; color: #a8a29e; margin: 0 0 10px;">ARTICLE B &nbsp;·&nbsp; {article_b.get("domain", "")}</p>
  <a href="{article_b.get("url", "#")}" style="font-size: 14px; font-weight: 600; color: #1c1917; text-decoration: none;">{article_b.get("title", "")}</a>
  <p style="font-size: 12px; color: #78716c; margin: 4px 0 10px;">{article_b.get("source", "")}</p>
  <p style="font-size: 13px; color: #44403c; line-height: 1.6; margin: 0;">{article_b.get("central_argument") or article_b.get("summary", "")}</p>
</div>

<p style="font-size: 11px; color: #a8a29e; text-align: center;">Mycelium · your personal knowledge graph</p>
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


def main() -> None:
    gmail_user = os.environ.get("GMAIL_USER", "").strip()
    gmail_password = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
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

    # Build set of already-alerted pairs
    alerted_pairs = {
        frozenset([a["source"], a["target"]])
        for a in alerts_data.get("alerts", [])
    }

    new_alerts = []
    sent_count = 0
    error_count = 0

    for edge in graph.get("edges", []):
        if edge.get("type") != "adjacent":
            continue

        src_slug = edge["source"]
        tgt_slug = edge["target"]
        pair = frozenset([src_slug, tgt_slug])

        if pair in alerted_pairs:
            continue  # already sent

        article_a = articles.get(src_slug)
        article_b = articles.get(tgt_slug)

        if not article_a or not article_b:
            continue

        # Only alert if the two articles come from different intellectual domains
        domain_a = (article_a.get("domain") or "").strip().lower()
        domain_b = (article_b.get("domain") or "").strip().lower()
        if not domain_a or not domain_b or domain_a == domain_b:
            print(f"  Skipping {src_slug} ↔ {tgt_slug}: same domain or domain unknown.")
            continue

        print(f"  Sending alert: {src_slug} ↔ {tgt_slug} ({domain_a} ↔ {domain_b})")
        try:
            send_email(gmail_user, gmail_password, article_a, article_b, edge)
            print(f"  ✓ Alert sent.")
            new_alerts.append({
                "source": src_slug,
                "target": tgt_slug,
                "type": "adjacent",
                "domain_a": domain_a,
                "domain_b": domain_b,
                "explanation": edge.get("explanation", ""),
                "sent_at": datetime.now(timezone.utc).isoformat(),
            })
            sent_count += 1
        except Exception as e:
            print(f"  ERROR sending alert: {e}", file=sys.stderr)
            error_count += 1

    if new_alerts:
        alerts_data["alerts"] = alerts_data.get("alerts", []) + new_alerts
        with open(ALERTS_PATH, "w") as f:
            json.dump(alerts_data, f, indent=2, ensure_ascii=False)
        print(f"\nSent {sent_count} alert(s). Logged to data/alerts.json.")
    else:
        print("\nNo new surprise alerts to send.")

    print(f"\n--- Done ---")
    print(f"Alerts sent: {sent_count}  |  Errors: {error_count}")

    if error_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
