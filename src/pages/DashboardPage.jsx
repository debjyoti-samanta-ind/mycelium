import dashboardData from '../../data/dashboard.json'
import Tooltip from '../components/Tooltip.jsx'
import steelmanOutputs from '../../data/steelman_outputs.json'
import repriseOutputs from '../../data/reprise_outputs.json'
import blindSpotOutputs from '../../data/blind_spot_outputs.json'

const d = dashboardData

const DOMAIN_COLOR_BUCKETS = [
  { color: '#6366f1', keywords: ['tech', 'software', 'ai', 'digital', 'data', 'machine learning', 'computer'] },
  { color: '#0d9488', keywords: ['science', 'biology', 'physics', 'neuro', 'cognitive', 'psychology', 'complexity', 'evolutionary'] },
  { color: '#d97706', keywords: ['business', 'econom', 'financ', 'marketing', 'management', 'organizational', 'organisational', 'geopolit', 'trade', 'corporate', 'governance', 'media econom'] },
  { color: '#dc6b3f', keywords: ['philosoph', 'histor', 'sociol', 'political', 'media', 'culture', 'anthropol', 'ethics'] },
]

function getDomainColor(domain) {
  const dl = (domain || '').toLowerCase()
  for (const b of DOMAIN_COLOR_BUCKETS) {
    if (b.keywords.some(k => dl.includes(k))) return b.color
  }
  return '#78716c'
}

function monthLabel(monthStr) {
  if (!monthStr) return '—'
  try { return new Date(monthStr + '-02').toLocaleString('default', { month: 'short', year: 'numeric' }) }
  catch { return monthStr }
}

function DeltaBadge({ delta }) {
  if (delta === 0 || delta == null) return null
  const pos = delta > 0
  return (
    <span className={`text-xs font-semibold ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
      {pos ? `+${delta}` : delta} vs last mo
    </span>
  )
}

function StatCard({ label, value, sub, tooltip }) {
  return (
    <div className="card-3d p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.14em]">{label}</p>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <p className="serif text-[1.85rem] font-semibold text-stone-900 tracking-tight leading-none">{value}</p>
      {sub != null && <div className="text-xs text-stone-400 mt-1.5 leading-snug">{sub}</div>}
    </div>
  )
}

function SectionHeader({ title }) {
  return (
    <h2 className="serif text-2xl font-semibold text-stone-900 mb-4">{title}</h2>
  )
}

function BarRow({ label, pct, color, right }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-stone-500 w-28 truncate capitalize shrink-0">{label}</span>
      <div className="flex-1 bg-stone-200/60 rounded-full h-[5px]">
        <div
          className="h-[5px] rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-stone-400 w-6 text-right shrink-0 tabular-nums">{right}</span>
    </div>
  )
}

function getLatestFired(outputs) {
  const fired = (outputs || []).filter(o => o.fired)
  return fired.length > 0 ? fired[fired.length - 1] : null
}

// Icons per agent — personality-driven SVGs
const AgentIcon = ({ name }) => {
  if (name === 'Steelman') return (
    // Shield — challenge / confrontation
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  )
  if (name === 'Reprise') return (
    // Counter-clockwise clock — resurface / memory
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/>
      <path d="M3.51 15a9 9 0 1 0 .49-4.61"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  )
  // Eye-off — the unseen / blind spot
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

const AGENT_ACCENT = {
  Steelman:    { bg: '#ede9fe', color: '#6c5ce7' },
  Reprise:     { bg: '#fef3c7', color: '#b45309' },
  'Blind Spot':{ bg: '#ccfbf1', color: '#0f766e' },
}

function AgentStatusRow({ name, tooltip, output, headline }) {
  const accent = AGENT_ACCENT[name] || { bg: '#f1f5f9', color: '#64748b' }
  return (
    <div className="flex items-start gap-3.5 py-3 border-b last:border-0" style={{ borderColor: '#f0ebe3' }}>
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: accent.bg, color: accent.color }}
      >
        <AgentIcon name={name} />
      </div>
      <div className="flex items-center gap-0.5 w-24 shrink-0 mt-1">
        <span className="text-sm font-semibold text-stone-700">{name}</span>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      {!output ? (
        <span className="text-sm text-stone-400 italic mt-1">Active — no output yet</span>
      ) : (
        <span className="text-sm text-stone-600 leading-snug mt-1">{headline}</span>
      )}
    </div>
  )
}

function AgentStatusPanel() {
  const steelman  = getLatestFired(steelmanOutputs)
  const reprise   = getLatestFired(repriseOutputs)
  const blindSpot = getLatestFired(blindSpotOutputs)
  return (
    <section>
      <SectionHeader title="Agents" />
      <div className="card-3d px-5 py-1">
        <AgentStatusRow
          name="Steelman"
          tooltip="Finds the dominant view in your reading and writes the strongest possible argument against it — using your own articles."
          output={steelman}
          headline={steelman ? `Challenged: ${steelman.consensus?.claim?.slice(0, 60)}…` : null}
        />
        <AgentStatusRow
          name="Reprise"
          tooltip="Surfaces an old article that has become newly relevant because of what you just read."
          output={reprise}
          headline={reprise ? `Surfaced: "${reprise.surfaced_article?.title}" (${reprise.run_id})` : null}
        />
        <AgentStatusRow
          name="Blind Spot"
          tooltip="Identifies the most important intellectual domain you are systematically ignoring, based on questions your reading keeps raising."
          output={blindSpot}
          headline={blindSpot ? `${blindSpot.blind_spot?.domain} — ${blindSpot.run_id}` : null}
        />
      </div>
    </section>
  )
}

export default function DashboardPage() {
  const r = d.reading || {}
  const g = d.graph   || {}

  const dist      = r.domain_distribution || []
  const maxCount  = dist[0]?.count || 1
  const dvb       = r.depth_vs_breadth || {}
  const etd       = g.edge_type_distribution || {}
  const totalEdges = g.total_edges || 0

  const sd = r.stance_distribution || {}
  const stanceTotal = (sd.optimistic || 0) + (sd.pessimistic || 0) + (sd.neutral || 0)

  return (
    <div className="space-y-8">

      {/* ── Reading Intelligence ── */}
      <section>
        <SectionHeader title="Reading Intelligence" />

        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard label="Articles" value={r.total_articles ?? 0}
            sub={`${r.months_active ?? 0} active month${r.months_active !== 1 ? 's' : ''}`} />
          <StatCard label="This month" value={r.this_month ?? 0}
            sub={<DeltaBadge delta={r.month_delta} />} />
          <StatCard label="Reading since" value={monthLabel(r.active_since)}
            sub={`${r.months_active ?? 0} month${r.months_active !== 1 ? 's' : ''} tracked`} />
        </div>

        {/* Domain + Stance side by side */}
        {(dist.length > 0 || stanceTotal > 0) && (
          <div className={`grid gap-3 mb-4 ${dist.length > 0 && stanceTotal > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {dist.length > 0 && (
              <div className="card-3d p-4">
                <div className="flex items-center mb-3">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.14em]">Domain split</p>
                  <Tooltip text="How your reading is spread across intellectual disciplines — all time." />
                </div>
                <div className="space-y-2.5">
                  {dist.map(({ domain, count }) => (
                    <BarRow key={domain} label={domain} pct={(count / maxCount) * 100}
                      color={getDomainColor(domain)} right={count} />
                  ))}
                </div>
              </div>
            )}
            {stanceTotal > 0 && (
              <div className="card-3d p-4">
                <div className="flex items-center mb-3">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.14em]">Reading stance</p>
                  <Tooltip text="Whether your articles take an optimistic, pessimistic, or neutral view. Set by Claude during ingestion based on each article's overall framing." />
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: 'Optimistic',  key: 'optimistic',  color: '#4a7c59' },
                    { label: 'Neutral',     key: 'neutral',     color: '#B4B2A9' },
                    { label: 'Pessimistic', key: 'pessimistic', color: '#c0392b' },
                  ].map(({ label, key, color }) => {
                    const count = sd[key] || 0
                    const pct   = stanceTotal > 0 ? Math.round((count / stanceTotal) * 100) : 0
                    return <BarRow key={key} label={label} pct={pct} color={color} right={count} />
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reading mode + Neglected topic */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card-3d p-4">
            <div className="flex items-center mb-2">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.14em]">Reading mode</p>
              <Tooltip text="Deep: more than 60% of this month's articles are in one domain. Broad: no single domain dominates." />
            </div>
            {dvb.mode ? (
              <>
                <p className="serif text-xl font-semibold text-stone-900 capitalize">{dvb.mode}</p>
                {dvb.mode === 'deep' && dvb.top_domain && (
                  <p className="text-xs text-stone-400 mt-1">{dvb.top_domain_count} of {r.this_month} in <span className="text-stone-600 capitalize">{dvb.top_domain}</span></p>
                )}
                {dvb.mode === 'broad' && (
                  <p className="text-xs text-stone-400 mt-1">{dvb.domains_this_month} domains this month</p>
                )}
                {dvb.last_broad_month && dvb.mode === 'deep' && (
                  <p className="text-xs text-stone-300 mt-1.5">Last broad: {monthLabel(dvb.last_broad_month)}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-stone-400 mt-1">No articles this month yet.</p>
            )}
          </div>

          <div className="card-3d p-4">
            <div className="flex items-center mb-2">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.14em]">Neglected topic</p>
              <Tooltip text="A domain you've read in before, but haven't touched in over 30 days. A nudge, not a judgement." />
            </div>
            {r.neglected_topic ? (
              <>
                <p className="serif text-xl font-semibold text-stone-900 capitalize">{r.neglected_topic.domain}</p>
                <p className="text-xs text-stone-400 mt-1">Last read {r.neglected_topic.weeks_ago} week{r.neglected_topic.weeks_ago !== 1 ? 's' : ''} ago</p>
              </>
            ) : (
              <p className="text-sm text-stone-400 mt-1">Reading broadly — no gaps.</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Graph Intelligence ── */}
      <section>
        <SectionHeader title="Graph Intelligence" />

        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard label="Graph density" value={`${Math.round((g.density ?? 0) * 100)}%`}
            sub={`${g.total_edges ?? 0} edges · ${g.total_nodes ?? 0} nodes`}
            tooltip="What percentage of all possible connections between your articles have been found." />
          <StatCard label="Most connected"
            value={g.most_connected_node ? `${g.most_connected_node.edge_count} links` : '—'}
            sub={g.most_connected_node ? g.most_connected_node.slug.replace(/-/g, ' ').slice(0, 32) : 'No connections yet'}
            tooltip="The article with the most connections — the most central idea in your reading." />
          <StatCard label="Island rate" value={g.island_count ?? 0}
            sub={g.island_count === 0 ? 'All articles connected' : `article${g.island_count !== 1 ? 's' : ''} unlinked`}
            tooltip="Articles with zero connections." />
        </div>

        <div className="card-3d p-4">
          <div className="flex items-center mb-3">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.14em]">Connection types</p>
            <Tooltip text="How your graph's connections break down. Heavy 'reinforce' may indicate echo-chamber reading; more 'contradict' and 'adjacent' means genuinely challenging reading." />
          </div>
          {totalEdges === 0 ? (
            <p className="text-sm text-stone-400">No connections found yet.</p>
          ) : (
            <div className="space-y-2.5">
              {[
                { type: 'reinforce',  color: '#4a7c59' },
                { type: 'contradict', color: '#c0392b' },
                { type: 'evolve',     color: '#6c5ce7' },
                { type: 'adjacent',   color: '#e17055' },
              ].map(({ type, color }) => {
                const count = etd[type] || 0
                const pct   = Math.round((count / totalEdges) * 100)
                return <BarRow key={type} label={type} pct={pct} color={color} right={count} />
              })}
            </div>
          )}
          {totalEdges > 0 && (
            <p className="text-xs text-stone-400 mt-3.5 pt-3 border-t" style={{ borderColor: '#f0ebe3' }}>
              {g.contradiction_density === 0
                ? 'No contradictions yet — consider seeking out dissenting views.'
                : `${Math.round((g.contradiction_density ?? 0) * 100)}% of connections challenge your existing views.`}
            </p>
          )}
        </div>
      </section>

      {/* ── Agents ── */}
      <AgentStatusPanel />

      <p className="text-[11px] text-stone-400 text-right tabular-nums">
        Last computed: {d.computed_at || '—'}
      </p>
    </div>
  )
}
