"""
Mycelium agent tools — Phase 7
Shared tool functions used by all three agents (Steelman, Reprise, Blind Spot).
Also provides shared utilities: append_agent_log, send_agent_notification.
"""

import json
import os
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

DATA_DIR     = Path("data")
ARTICLES_DIR = DATA_DIR / "articles"
GRAPH_PATH   = DATA_DIR / "graph.json"
LOG_PATH     = DATA_DIR / "agent_log.json"


# ── Tool functions (called by agents via tool-use loop) ──────────────────────

def get_graph_summary() -> dict:
    """
    Returns all articles with metadata and degree (connection count).
    Never returns full article text — metadata only.
    """
    graph = json.loads(GRAPH_PATH.read_text())

    degree: dict[str, int] = {}
    for edge in graph.get("edges", []):
        degree[edge["source"]] = degree.get(edge["source"], 0) + 1
        degree[edge["target"]] = degree.get(edge["target"], 0) + 1

    articles = []
    for path in sorted(ARTICLES_DIR.glob("*.json")):
        a = json.loads(path.read_text())
        slug = a["slug"]
        articles.append({
            "slug":       slug,
            "title":      a.get("title", ""),
            "domain":     a.get("domain", ""),
            "stance":     a.get("stance", ""),
            "topic_tags": a.get("topic_tags", []),
            "date_added": a.get("date_added", ""),
            "degree":     degree.get(slug, 0),
        })

    return {"articles": articles, "total": len(articles)}


def get_article(slug: str) -> dict:
    """
    Returns enriched fields for one article.
    Never returns the raw fetched content — only ingested enriched fields.
    """
    path = ARTICLES_DIR / f"{slug}.json"
    if not path.exists():
        return {"error": f"Article '{slug}' not found"}
    a = json.loads(path.read_text())
    return {
        "slug":             a["slug"],
        "title":            a.get("title", ""),
        "source":           a.get("source", ""),
        "date_added":       a.get("date_added", ""),
        "published_date":   a.get("published_date", ""),
        "domain":           a.get("domain", ""),
        "stance":           a.get("stance", ""),
        "summary":          a.get("summary", ""),
        "central_argument": a.get("central_argument", ""),
        "key_claims":       a.get("key_claims", []),
        "key_tensions":     a.get("key_tensions", []),
        "key_entities":     a.get("key_entities", []),
        "topic_tags":       a.get("topic_tags", []),
    }


def get_edges_for_article(slug: str) -> dict:
    """
    Returns all edges connecting this article, including the other article's slug,
    edge type, claim_a, claim_b, and explanation.
    """
    graph = json.loads(GRAPH_PATH.read_text())
    edges = []
    for edge in graph.get("edges", []):
        if edge["source"] == slug or edge["target"] == slug:
            other = edge["target"] if edge["source"] == slug else edge["source"]
            edges.append({
                "other_slug":  other,
                "type":        edge.get("type", ""),
                "claim_a":     edge.get("claim_a", ""),
                "claim_b":     edge.get("claim_b", ""),
                "explanation": edge.get("explanation", ""),
                "date_added":  edge.get("date_added", ""),
            })
    return {"edges": edges, "count": len(edges)}


def get_articles_by_filter(domain: str = None, stance: str = None, tag: str = None) -> dict:
    """
    Returns articles matching one or more filters (all optional).
    Useful for exploring domain clusters without reading every article.
    """
    summary = get_graph_summary()
    results = []
    for a in summary["articles"]:
        if domain and a["domain"].lower() != domain.lower():
            continue
        if stance and a["stance"].lower() != stance.lower():
            continue
        if tag and tag.lower() not in [t.lower() for t in a["topic_tags"]]:
            continue
        results.append(a)
    return {"articles": results, "count": len(results)}


# ── Shared utilities ─────────────────────────────────────────────────────────

def append_agent_log(
    agent: str,
    run_id: str,
    triggered_by: str,
    trigger_article: str | None,
    fired: bool,
    skip_reason: str | None,
    input_tokens: int,
    output_tokens: int,
    tool_calls: int,
) -> None:
    """Appends one entry to data/agent_log.json."""
    log = json.loads(LOG_PATH.read_text()) if LOG_PATH.exists() else []
    log.append({
        "agent":           agent,
        "run_id":          run_id,
        "timestamp":       datetime.now(timezone.utc).isoformat(),
        "triggered_by":    triggered_by,
        "trigger_article": trigger_article,
        "fired":           fired,
        "skip_reason":     skip_reason,
        "input_tokens":    input_tokens,
        "output_tokens":   output_tokens,
        "tool_calls":      tool_calls,
    })
    LOG_PATH.write_text(json.dumps(log, indent=2))


def send_agent_notification(agent_name: str) -> None:
    """
    Sends a minimal email notification that an agent has produced a new output.
    Uses the same Gmail SMTP credentials as alerts.py.
    """
    gmail_user      = os.environ.get("GMAIL_USER", "").strip()
    gmail_password  = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
    gmail_recipient = os.environ.get("GMAIL_RECIPIENT", gmail_user).strip()

    if not gmail_user or not gmail_password:
        print(f"{agent_name}: GMAIL_USER or GMAIL_APP_PASSWORD not set. Skipping notification.")
        return

    subject = f"Mycelium — {agent_name} has a new output"
    body    = f"{agent_name} has produced a new output. Open the app to read it."

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = gmail_user
    msg["To"]      = gmail_recipient
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(gmail_user, gmail_password)
            server.sendmail(gmail_user, gmail_recipient, msg.as_string())
        print(f"{agent_name}: Notification sent to {gmail_recipient}.")
    except Exception as e:
        print(f"{agent_name}: Failed to send notification: {e}")
