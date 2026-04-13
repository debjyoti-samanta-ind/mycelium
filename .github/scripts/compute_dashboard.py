"""
Mycelium dashboard computation script — Phase 6
Pure Python, no Claude API call. Reads articles, graph, and opinions
and writes precomputed stats to data/dashboard.json.

Runs as the final step of the ingest workflow after new articles are saved.
"""

import json
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

ARTICLES_DIR = Path("data/articles")
GRAPH_PATH   = Path("data/graph.json")
OPINIONS_PATH = Path("data/opinions.json")
DASHBOARD_PATH = Path("data/dashboard.json")


def load_articles() -> list[dict]:
    articles = []
    for path in ARTICLES_DIR.glob("*.json"):
        try:
            with open(path) as f:
                articles.append(json.load(f))
        except (json.JSONDecodeError, OSError):
            continue
    return articles


def compute_reading(articles: list[dict]) -> dict:
    today = date.today()
    this_month_str = today.strftime("%Y-%m")
    last_month_str = (today.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")

    this_month = [a for a in articles if a.get("date_added", "").startswith(this_month_str)]
    last_month = [a for a in articles if a.get("date_added", "").startswith(last_month_str)]

    # Active since + months active
    dates = [a["date_added"] for a in articles if a.get("date_added")]
    active_since = min(dates)[:7] if dates else None
    months_active = len({d[:7] for d in dates})

    # Domain distribution — all time, top 8
    domain_counts = Counter(
        a.get("domain", "").strip().lower()
        for a in articles if a.get("domain", "").strip()
    )
    domain_distribution = [
        {"domain": d, "count": c}
        for d, c in domain_counts.most_common(8)
    ]

    # Depth vs breadth — this month
    this_month_domains = [
        a.get("domain", "").strip().lower()
        for a in this_month if a.get("domain", "").strip()
    ]
    domain_counts_this_month = Counter(this_month_domains)
    top = domain_counts_this_month.most_common(1)

    if this_month and top:
        top_domain, top_count = top[0]
        mode = "deep" if top_count / len(this_month) > 0.6 else "broad"
    else:
        top_domain, top_count, mode = None, 0, None

    # Last month with 3+ distinct domains
    month_domains: dict[str, set] = defaultdict(set)
    for a in articles:
        d = a.get("date_added", "")
        domain = a.get("domain", "").strip().lower()
        if d and domain:
            month_domains[d[:7]].add(domain)

    broad_months = sorted(
        [m for m, ds in month_domains.items() if len(ds) >= 3],
        reverse=True,
    )
    last_broad_month = broad_months[0] if broad_months else None

    # Neglected topic: domain with 2+ articles but none in last 30 days
    cutoff = (today - timedelta(days=30)).isoformat()
    domain_last_read: dict[str, str] = {}
    for a in articles:
        domain = a.get("domain", "").strip().lower()
        added  = a.get("date_added", "")
        if domain and added:
            if domain not in domain_last_read or added > domain_last_read[domain]:
                domain_last_read[domain] = added

    neglected = None
    for domain, count in domain_counts.items():
        last = domain_last_read.get(domain, "")
        if count >= 2 and last and last < cutoff:
            days_ago = (today - date.fromisoformat(last)).days
            if not neglected or last < domain_last_read.get(neglected["domain"], ""):
                neglected = {
                    "domain": domain,
                    "last_article_date": last,
                    "weeks_ago": days_ago // 7,
                }

    return {
        "total_articles":      len(articles),
        "this_month":          len(this_month),
        "last_month":          len(last_month),
        "month_delta":         len(this_month) - len(last_month),
        "active_since":        active_since,
        "months_active":       months_active,
        "domain_distribution": domain_distribution,
        "depth_vs_breadth": {
            "mode":              mode,
            "top_domain":        top_domain,
            "top_domain_count":  top_count,
            "domains_this_month": len(set(this_month_domains)),
            "last_broad_month":  last_broad_month,
        },
        "neglected_topic": neglected,
    }


def compute_graph(graph: dict) -> dict:
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    n, e = len(nodes), len(edges)

    max_edges = n * (n - 1) // 2 if n > 1 else 0
    density   = round(e / max_edges, 3) if max_edges > 0 else 0.0

    # Islands
    connected = set()
    for edge in edges:
        connected.add(edge["source"])
        connected.add(edge["target"])
    island_count = sum(1 for node in nodes if node["id"] not in connected)
    island_rate  = round(island_count / n, 3) if n > 0 else 0.0

    # Most connected node
    edge_counts: Counter = Counter()
    for edge in edges:
        edge_counts[edge["source"]] += 1
        edge_counts[edge["target"]] += 1

    most_connected = None
    if edge_counts:
        top_slug, top_count = edge_counts.most_common(1)[0]
        most_connected = {"slug": top_slug, "edge_count": top_count}

    # Edge type breakdown
    type_counts = Counter(edge.get("type", "unknown") for edge in edges)
    edge_type_distribution = {
        "reinforce": type_counts.get("reinforce", 0),
        "contradict": type_counts.get("contradict", 0),
        "evolve":     type_counts.get("evolve", 0),
        "adjacent":   type_counts.get("adjacent", 0),
    }
    contradiction_density = round(type_counts.get("contradict", 0) / e, 3) if e > 0 else 0.0

    return {
        "total_nodes":             n,
        "total_edges":             e,
        "density":                 density,
        "island_count":            island_count,
        "island_rate":             island_rate,
        "most_connected_node":     most_connected,
        "edge_type_distribution":  edge_type_distribution,
        "contradiction_density":   contradiction_density,
    }


def compute_opinions(opinions_data: dict) -> dict:
    opinions = opinions_data.get("opinions", [])
    strong  = sum(1 for op in opinions if len(op.get("article_slugs", [])) >= 4)
    forming = sum(1 for op in opinions if 2 <= len(op.get("article_slugs", [])) <= 3)
    thin    = sum(1 for op in opinions if len(op.get("article_slugs", [])) == 1)
    return {"total": len(opinions), "strong": strong, "forming": forming, "thin": thin}


def main() -> None:
    articles = load_articles()
    print(f"Loaded {len(articles)} article(s).")

    with open(GRAPH_PATH) as f:
        graph = json.load(f)

    try:
        with open(OPINIONS_PATH) as f:
            opinions_data = json.load(f)
    except (OSError, json.JSONDecodeError):
        opinions_data = {"opinions": []}

    dashboard = {
        "computed_at": date.today().isoformat(),
        "reading":     compute_reading(articles),
        "graph":       compute_graph(graph),
        "opinions":    compute_opinions(opinions_data),
    }

    with open(DASHBOARD_PATH, "w") as f:
        json.dump(dashboard, f, indent=2, ensure_ascii=False)

    r, g, o = dashboard["reading"], dashboard["graph"], dashboard["opinions"]
    print(f"Dashboard written to {DASHBOARD_PATH}.")
    print(f"  Articles: {r['total_articles']}  |  This month: {r['this_month']}")
    print(f"  Graph density: {g['density']}  |  Edges: {g['total_edges']}  |  Islands: {g['island_count']}")
    print(f"  Opinions: {o['total']}  (strong: {o['strong']}, forming: {o['forming']}, thin: {o['thin']})")


if __name__ == "__main__":
    main()
