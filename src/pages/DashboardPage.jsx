import dashboardData from '../../data/dashboard.json'
import Tooltip from '../components/Tooltip.jsx'
import steelmanOutputs from '../../data/steelman_outputs.json'
import repriseOutputs from '../../data/reprise_outputs.json'
import blindSpotOutputs from '../../data/blind_spot_outputs.json'

const d = dashboardData

function monthLabel(monthStr) {
  if (!monthStr) return '—'
  try {
    return new Date(monthStr + '-02').toLocaleString('default', { month: 'short', year: 'numeric' })
  } catch {
    return monthStr
  }
}

function DeltaBadge({ delta }) {
  if (delta === 0 || delta == null) return null
  const positive = delta > 0
  return (
    <span className={`text-xs font-medium ml-1.5 ${positive ? 'text-green-600' : 'text-red-500'}`}>
      {positive ? `+${delta}` : delta} vs last month
    </span>
  )
}

function StatCard({ label, value, sub, tooltip }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="flex items-center mb-1">
        <p className="text-xs text-stone-400 uppercase tracking-wide">{label}</p>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <p className="text-2xl font-semibold text-stone-900">{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title }) {
  return (
    <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-4">{title}</p>
  )
}

function getLatestFired(outputs) {
  const fired = outputs.filter(o => o.fired)
  return fired.length > 0 ? fired[fired.length - 1] : null
}

function AgentStatusRow({ name, output, headline }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-stone-100 last:border-0">
      <span className="text-sm font-medium text-stone-700 w-28 shrink-0">{name}</span>
      {!output ? (
        <span className="text-sm text-stone-400">Active — no output yet</span>
      ) : (
        <span className="text-sm text-stone-600 text-right">{headline}</span>
      )}
    </div>
  )
}

function AgentStatusPanel() {
  const steelman  = getLatestFired(steelmanOutputs)
  const reprise   = getLatestFired(repriseOutputs)
  const blindSpot = getLatestFired(blindSpotOutputs)

  const steelmanHeadline  = steelman
    ? `Challenged: ${steelman.consensus?.claim?.slice(0, 60)}…`
    : null
  const repriseHeadline   = reprise
    ? `Surfaced: "${reprise.surfaced_article?.title}" (${reprise.run_id})`
    : null
  const blindSpotHeadline = blindSpot
    ? `${blindSpot.blind_spot?.domain} — ${blindSpot.run_id}`
    : null

  return (
    <section>
      <SectionHeader title="Agents" />
      <div className="bg-white border border-stone-200 rounded-xl px-4 py-1">
        <AgentStatusRow name="Steelman"   output={steelman}  headline={steelmanHeadline} />
        <AgentStatusRow name="Reprise"    output={reprise}   headline={repriseHeadline} />
        <AgentStatusRow name="Blind Spot" output={blindSpot} headline={blindSpotHeadline} />
      </div>
    </section>
  )
}

export default function DashboardPage() {
  const r = d.reading   || {}
  const g = d.graph     || {}

  const dist    = r.domain_distribution || []
  const maxCount = dist[0]?.count || 1
  const dvb     = r.depth_vs_breadth || {}
  const etd     = g.edge_type_distribution || {}
  const totalEdges = g.total_edges || 0

  return (
    <div className="space-y-10">

      {/* ── Reading Intelligence ── */}
      <section>
        <SectionHeader title="Reading Intelligence" />

        {/* Stat row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Articles"
            value={r.total_articles ?? 0}
            sub={`${r.months_active ?? 0} active month${r.months_active !== 1 ? 's' : ''}`}
          />
          <StatCard
            label="This month"
            value={r.this_month ?? 0}
            sub={<DeltaBadge delta={r.month_delta} />}
          />
          <StatCard
            label="Reading since"
            value={monthLabel(r.active_since)}
            sub={`${r.months_active ?? 0} month${r.months_active !== 1 ? 's' : ''} with articles`}
          />
        </div>

        {/* Domain distribution */}
        {dist.length > 0 && (
          <div className="bg-white border border-stone-200 rounded-xl p-5 mb-4">
            <div className="flex items-center mb-4">
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Domain distribution</p>
              <Tooltip text="How your reading is spread across intellectual disciplines — all time." />
            </div>
            <div className="space-y-2">
              {dist.map(({ domain, count }) => (
                <div key={domain} className="flex items-center gap-3">
                  <span className="text-xs text-stone-500 w-36 truncate capitalize">{domain}</span>
                  <div className="flex-1 bg-stone-100 rounded-full h-1.5">
                    <div
                      className="bg-stone-600 h-1.5 rounded-full"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-stone-400 w-4 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Depth vs breadth + neglected topic */}
        <div className="grid grid-cols-2 gap-4">

          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="flex items-center mb-2">
              <p className="text-xs text-stone-400 uppercase tracking-wide">Reading mode</p>
              <Tooltip text="Deep: more than 60% of this month's articles are in one domain. Broad: no single domain dominates — your reading is more varied." />
            </div>
            {dvb.mode ? (
              <>
                <p className="text-lg font-semibold text-stone-900 capitalize">{dvb.mode}</p>
                {dvb.mode === 'deep' && dvb.top_domain && (
                  <p className="text-xs text-stone-400 mt-0.5">
                    {dvb.top_domain_count} of {r.this_month} articles in{' '}
                    <span className="text-stone-600 capitalize">{dvb.top_domain}</span>
                  </p>
                )}
                {dvb.mode === 'broad' && (
                  <p className="text-xs text-stone-400 mt-0.5">
                    {dvb.domains_this_month} domains this month
                  </p>
                )}
                {dvb.last_broad_month && dvb.mode === 'deep' && (
                  <p className="text-xs text-stone-300 mt-1">
                    Last broad month: {monthLabel(dvb.last_broad_month)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-stone-400 mt-1">No articles this month yet.</p>
            )}
          </div>

          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="flex items-center mb-2">
              <p className="text-xs text-stone-400 uppercase tracking-wide">Neglected topic</p>
              <Tooltip text="A domain you've read in before, but haven't touched in over 30 days. A nudge, not a judgement." />
            </div>
            {r.neglected_topic ? (
              <>
                <p className="text-lg font-semibold text-stone-900 capitalize">
                  {r.neglected_topic.domain}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Last read {r.neglected_topic.weeks_ago} week{r.neglected_topic.weeks_ago !== 1 ? 's' : ''} ago
                </p>
              </>
            ) : (
              <p className="text-xs text-stone-400 mt-1">No neglected topics — you're reading broadly.</p>
            )}
          </div>

        </div>
      </section>

      {/* ── Graph Intelligence ── */}
      <section>
        <SectionHeader title="Graph Intelligence" />

        {/* Stat row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Graph density"
            value={`${Math.round((g.density ?? 0) * 100)}%`}
            sub={`${g.total_edges ?? 0} edges across ${g.total_nodes ?? 0} nodes`}
            tooltip="What percentage of all possible connections between your articles have been found. 100% would mean every article connects to every other."
          />
          <StatCard
            label="Most connected"
            value={g.most_connected_node ? `${g.most_connected_node.edge_count} links` : '—'}
            sub={g.most_connected_node
              ? g.most_connected_node.slug.replace(/-/g, ' ').slice(0, 32)
              : 'No connections yet'}
            tooltip="The article with the most connections in your graph — the most central idea in your reading."
          />
          <StatCard
            label="Island rate"
            value={g.island_count ?? 0}
            sub={g.island_count === 0
              ? 'All articles connected'
              : `article${g.island_count !== 1 ? 's' : ''} with no links yet`}
            tooltip="Articles with zero connections. A high number means the connect workflow hasn't run yet, or these articles are genuinely isolated from the rest of your reading."
          />
        </div>

        {/* Connection types */}
        <div className="bg-white border border-stone-200 rounded-xl p-5">
            <div className="flex items-center mb-4">
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Connection types</p>
              <Tooltip text="How your graph's connections break down by type. A reading diet heavy in 'reinforce' connections may mean you're reading inside an echo chamber. More 'contradict' and 'adjacent' connections mean your reading is genuinely challenging itself." />
            </div>
            {totalEdges === 0 ? (
              <p className="text-xs text-stone-400">No connections found yet.</p>
            ) : (
              <div className="space-y-2.5">
                {[
                  { type: 'reinforce', colour: '#4a7c59' },
                  { type: 'contradict', colour: '#c0392b' },
                  { type: 'evolve',    colour: '#6c5ce7' },
                  { type: 'adjacent',  colour: '#e17055' },
                ].map(({ type, colour }) => {
                  const count = etd[type] || 0
                  const pct = Math.round((count / totalEdges) * 100)
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-xs text-stone-500 w-20 capitalize">{type}</span>
                      <div className="flex-1 bg-stone-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: colour }}
                        />
                      </div>
                      <span className="text-xs text-stone-400 w-12 text-right">{count} ({pct}%)</span>
                    </div>
                  )
                })}
              </div>
            )}
            {totalEdges > 0 && (
              <p className="text-xs text-stone-400 mt-3 pt-3 border-t border-stone-100">
                {g.contradiction_density === 0
                  ? 'No contradictions yet — consider seeking out dissenting views.'
                  : `${Math.round((g.contradiction_density ?? 0) * 100)}% of connections challenge your existing views.`}
              </p>
            )}
        </div>
      </section>

      {/* ── Agents ── */}
      <AgentStatusPanel />

      <p className="text-xs text-stone-300 text-right">
        Last computed: {d.computed_at || '—'}
      </p>
    </div>
  )
}
