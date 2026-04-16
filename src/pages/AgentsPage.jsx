import steelmanOutputs from '../../data/steelman_outputs.json'
import repriseOutputs   from '../../data/reprise_outputs.json'
import blindSpotOutputs from '../../data/blind_spot_outputs.json'
import Tooltip from '../components/Tooltip.jsx'

// Each agent has a distinct identity color
const AGENT_COLORS = {
  Steelman:   '#e11d48', // rose   — confrontational, challenges consensus
  Reprise:    '#d97706', // amber  — warm, surfaces memory
  'Blind Spot': '#7c3aed', // violet — reveals what you can't see
}

function getMostRecentFired(outputs) {
  const fired = outputs.filter(o => o.fired)
  return fired.length > 0 ? fired[fired.length - 1] : null
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const AGENT_TOOLTIPS = {
  Steelman: "Scans your entire reading graph to find the single most widely-held intellectual position across your articles, then builds the strongest possible argument against it — using only evidence already in your own graph. Runs after each ingestion once you have 8+ articles.",
  Reprise:  "After you add a new article, looks back through everything you've read to find the one older article that would feel different to read now — because the new article has changed its context. Requires 5+ articles and at least 30 days of reading history.",
  'Blind Spot': "Once a month, analyses your reading graph to identify the most important adjacent intellectual domain you're systematically ignoring — and explains exactly which open questions in your current reading that domain would help answer. Requires 10+ articles.",
}

function AgentCard({ name, children, neverFired, runId }) {
  const color   = AGENT_COLORS[name] || '#78716c'
  const tooltip = AGENT_TOOLTIPS[name]
  return (
    <section
      className="bg-white rounded-2xl overflow-hidden"
      style={{
        borderTop:  `3px solid ${color}`,
        boxShadow: `0 1px 0 rgba(0,0,0,0.03), 0 4px 0 ${hexToRgba(color, 0.25)}, 0 8px 24px rgba(0,0,0,0.05)`,
      }}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <h2 className="serif text-xl font-bold" style={{ color }}>{name}</h2>
          {tooltip && (
            <span className="relative inline-flex items-center group ml-0.5 cursor-default">
              <span className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center leading-none select-none"
                style={{ backgroundColor: hexToRgba(color, 0.12), color }}>?</span>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 w-80 text-white text-xs rounded-xl px-4 py-3 leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-normal"
                style={{ backgroundColor: '#1c1917' }}>
                {tooltip}
                <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent" style={{ borderTopColor: '#1c1917' }} />
              </span>
            </span>
          )}
        </div>
        {neverFired ? (
          <span className="text-[11px] text-stone-400 font-medium">Waiting for first run</span>
        ) : (
          <span className="text-[11px] text-stone-400">{runId}</span>
        )}
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  )
}

function SectionLabel({ children, color }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
      style={{ color: color ? hexToRgba(color, 0.6) : '#a8a29e' }}>
      {children}
    </p>
  )
}

function ArticleTag({ slug, color }) {
  return (
    <span
      className="inline-block text-[11px] px-2 py-0.5 rounded-full font-medium mr-1.5 mb-1.5"
      style={{
        backgroundColor: color ? hexToRgba(color, 0.08) : '#f5f5f4',
        color:           color || '#78716c',
        border:          `1px solid ${color ? hexToRgba(color, 0.2) : '#e7e5e4'}`,
      }}
    >
      {slug}
    </span>
  )
}

function NeverFired({ description }) {
  return (
    <p className="text-sm text-stone-400 leading-relaxed">{description}</p>
  )
}

function TokenMeta({ output, color }) {
  return (
    <p className="text-[11px] mt-4 pt-3 border-t border-stone-100"
      style={{ color: color ? hexToRgba(color, 0.5) : '#a8a29e' }}>
      {output.input_tokens + output.output_tokens} tokens · {output.tool_calls} tool calls
    </p>
  )
}

// ── Steelman ─────────────────────────────────────────────────────────────────
function SteelmanSection() {
  const allFired = steelmanOutputs.filter(o => o.fired)
  const output   = allFired[allFired.length - 1] ?? null
  const history  = allFired.slice(0, -1).reverse() // older runs, newest first
  const color    = AGENT_COLORS['Steelman']

  return (
    <AgentCard name="Steelman" neverFired={!output} runId={output?.run_id}>
      {!output ? (
        <NeverFired description="Fires after each ingestion once you have 8+ articles. Finds the dominant consensus in your graph and writes the strongest argument against it — using only evidence from your own reading." />
      ) : (
        <div className="space-y-5">
          <div>
            <SectionLabel color={color}>Consensus challenged</SectionLabel>
            <p className="text-[15px] text-stone-800 font-medium leading-snug">{output.consensus?.claim}</p>
            <div className="mt-2">
              {(output.consensus?.supporting_articles || []).map(slug => (
                <ArticleTag key={slug} slug={slug} color={color} />
              ))}
            </div>
          </div>

          <div>
            <SectionLabel color={color}>Counter-argument</SectionLabel>
            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
              {output.steelman?.argument}
            </p>
          </div>

          {output.steelman?.key_tension_used && (
            <div
              className="pl-4 py-2 rounded-r-lg text-sm text-stone-700 leading-relaxed italic"
              style={{ borderLeft: `3px solid ${hexToRgba(color, 0.4)}` }}
            >
              {output.steelman.key_tension_used}
            </div>
          )}

          <div>
            <SectionLabel color={color}>Grounded in</SectionLabel>
            <div>
              {(output.steelman?.grounded_in || []).map(slug => (
                <ArticleTag key={slug} slug={slug} color={color} />
              ))}
            </div>
          </div>

          <TokenMeta output={output} color={color} />

          {/* Past challenges — already stored, just show them */}
          {history.length > 0 && (
            <div className="mt-2 pt-4 border-t border-stone-100">
              <SectionLabel color={color}>Past challenges</SectionLabel>
              <ul className="space-y-2.5">
                {history.map((o, i) => (
                  <li key={i} className="flex gap-3 items-baseline">
                    <span className="text-[11px] text-stone-400 shrink-0 w-20">{o.run_id}</span>
                    <span className="text-xs text-stone-500 leading-relaxed">{o.consensus?.claim}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </AgentCard>
  )
}

// ── Reprise ──────────────────────────────────────────────────────────────────
function RepriseSection() {
  const output = getMostRecentFired(repriseOutputs)
  const color  = AGENT_COLORS['Reprise']

  return (
    <AgentCard name="Reprise" neverFired={!output} runId={output?.run_id}>
      {!output ? (
        <NeverFired description="Fires after each ingestion once you have 5+ articles and the graph is at least 30 days old. Surfaces an older article that has become newly relevant because of what you just added." />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: hexToRgba(color, 0.06), border: `1px solid ${hexToRgba(color, 0.15)}` }}
            >
              <SectionLabel color={color}>You just read</SectionLabel>
              <p className="text-sm text-stone-800 font-medium leading-snug">
                {output.new_article?.title}
              </p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: hexToRgba(color, 0.06), border: `1px solid ${hexToRgba(color, 0.15)}` }}
            >
              <SectionLabel color={color}>Go back to</SectionLabel>
              <p className="text-sm text-stone-800 font-medium leading-snug">
                {output.surfaced_article?.title}
              </p>
              <p className="text-[11px] text-stone-400 mt-1">
                Added {output.surfaced_article?.date_added}
              </p>
            </div>
          </div>

          <div>
            <SectionLabel color={color}>Why now</SectionLabel>
            <p className="text-sm text-stone-700 leading-relaxed">{output.relevance_explanation}</p>
          </div>

          <TokenMeta output={output} color={color} />
        </div>
      )}
    </AgentCard>
  )
}

// ── Blind Spot ────────────────────────────────────────────────────────────────
function BlindSpotSection() {
  const output = getMostRecentFired(blindSpotOutputs)
  const color  = AGENT_COLORS['Blind Spot']

  return (
    <AgentCard name="Blind Spot" neverFired={!output} runId={output?.run_id}>
      {!output ? (
        <NeverFired description="Fires on the 1st of each month once you have 10+ articles. Identifies the most important adjacent domain you are systematically ignoring — and explains which questions in your current reading it would help you answer." />
      ) : (
        <div className="space-y-5">
          <div>
            <SectionLabel color={color}>
              Your reading gap
              {output.blind_spot?.persistent_gap && (
                <span className="ml-2 normal-case font-normal tracking-normal text-amber-500">· Also flagged last month</span>
              )}
            </SectionLabel>
            <p className="text-xl font-bold text-stone-900">{output.blind_spot?.domain}</p>
            <p className="text-sm text-stone-500 mt-1">{output.blind_spot?.why_adjacent}</p>
          </div>

          {output.blind_spot?.open_questions_it_addresses?.length > 0 && (
            <div>
              <SectionLabel color={color}>Questions it would answer</SectionLabel>
              <ul className="space-y-2">
                {output.blind_spot.open_questions_it_addresses.map((q, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-stone-700">
                    <span className="select-none shrink-0 mt-0.5" style={{ color: hexToRgba(color, 0.6) }}>—</span>
                    <span className="leading-relaxed">{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {output.blind_spot?.explanation && (
            <div>
              <SectionLabel color={color}>Why this matters</SectionLabel>
              <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
                {output.blind_spot.explanation}
              </p>
            </div>
          )}

          <div>
            <SectionLabel color={color}>Raised by</SectionLabel>
            <div>
              {(output.blind_spot?.grounded_in || []).map(slug => (
                <ArticleTag key={slug} slug={slug} color={color} />
              ))}
            </div>
          </div>

          <TokenMeta output={output} color={color} />
        </div>
      )}
    </AgentCard>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AgentsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="serif text-4xl font-bold text-stone-900 leading-tight mb-2">Agents</h1>
        <p className="text-stone-500 text-[15px] leading-relaxed">
          Three learning tools that analyse your graph and surface insights automatically.
        </p>
      </div>
      <div className="space-y-6">
        <SteelmanSection />
        <RepriseSection />
        <BlindSpotSection />
      </div>
    </div>
  )
}
