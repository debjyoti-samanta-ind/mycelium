import steelmanOutputs from '../../data/steelman_outputs.json'
import repriseOutputs from '../../data/reprise_outputs.json'
import blindSpotOutputs from '../../data/blind_spot_outputs.json'

function getMostRecentFired(outputs) {
  const fired = outputs.filter(o => o.fired)
  return fired.length > 0 ? fired[fired.length - 1] : null
}

function AgentHeader({ name, runId, neverFired }) {
  return (
    <div className="flex items-baseline justify-between mb-4">
      <h2 className="text-lg font-semibold text-stone-800">{name}</h2>
      {neverFired ? (
        <span className="text-xs text-stone-400">Active — no output yet</span>
      ) : (
        <span className="text-xs text-stone-400">{runId}</span>
      )}
    </div>
  )
}

function ArticleTag({ slug }) {
  return (
    <span className="inline-block bg-stone-100 text-stone-600 text-xs px-2 py-0.5 rounded mr-1 mb-1">
      {slug}
    </span>
  )
}

function SteelmanSection() {
  const output = getMostRecentFired(steelmanOutputs)

  return (
    <section className="bg-white border border-stone-200 rounded-xl p-6">
      <AgentHeader name="Steelman" runId={output?.run_id} neverFired={!output} />
      {!output ? (
        <p className="text-sm text-stone-400">
          Steelman fires after each ingestion batch once you have 8+ articles.
          It will appear here after its first output.
        </p>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Consensus challenged</p>
            <p className="text-sm text-stone-700">{output.consensus?.claim}</p>
            <div className="mt-2">
              {(output.consensus?.supporting_articles || []).map(slug => (
                <ArticleTag key={slug} slug={slug} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Counter-argument</p>
            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
              {output.steelman?.argument}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Grounded in</p>
            <div>
              {(output.steelman?.grounded_in || []).map(slug => (
                <ArticleTag key={slug} slug={slug} />
              ))}
            </div>
          </div>
          <p className="text-xs text-stone-400">
            {output.input_tokens + output.output_tokens} tokens · {output.tool_calls} tool calls
          </p>
        </div>
      )}
    </section>
  )
}

function RepriseSection() {
  const output = getMostRecentFired(repriseOutputs)

  return (
    <section className="bg-white border border-stone-200 rounded-xl p-6">
      <AgentHeader name="Reprise" runId={output?.run_id} neverFired={!output} />
      {!output ? (
        <p className="text-sm text-stone-400">
          Reprise fires after each ingestion batch once you have 5+ articles.
          It will appear here after its first output.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">You just read</p>
              <p className="text-sm text-stone-700">{output.new_article?.title}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Go back to</p>
              <p className="text-sm text-stone-700">{output.surfaced_article?.title}</p>
              <p className="text-xs text-stone-400 mt-0.5">Added {output.surfaced_article?.date_added}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Why now</p>
            <p className="text-sm text-stone-700 leading-relaxed">
              {output.relevance_explanation}
            </p>
          </div>
          <p className="text-xs text-stone-400">
            {output.input_tokens + output.output_tokens} tokens · {output.tool_calls} tool calls
          </p>
        </div>
      )}
    </section>
  )
}

function BlindSpotSection() {
  const output = getMostRecentFired(blindSpotOutputs)

  return (
    <section className="bg-white border border-stone-200 rounded-xl p-6">
      <AgentHeader name="Blind Spot" runId={output?.run_id} neverFired={!output} />
      {!output ? (
        <p className="text-sm text-stone-400">
          Blind Spot fires on the 1st of each month once you have 10+ articles.
          It will appear here after its first output.
        </p>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">
              Your reading gap
              {output.blind_spot?.persistent_gap && (
                <span className="ml-2 text-amber-600 normal-case font-normal">· Also flagged last month</span>
              )}
            </p>
            <p className="text-sm font-medium text-stone-800">{output.blind_spot?.domain}</p>
            <p className="text-sm text-stone-500 mt-0.5">{output.blind_spot?.why_adjacent}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Questions it would answer</p>
            <ul className="space-y-1">
              {(output.blind_spot?.open_questions_it_addresses || []).map((q, i) => (
                <li key={i} className="text-sm text-stone-700 flex gap-2">
                  <span className="text-stone-300 shrink-0">—</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Why this matters</p>
            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
              {output.blind_spot?.explanation}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Raised by</p>
            <div>
              {(output.blind_spot?.grounded_in || []).map(slug => (
                <ArticleTag key={slug} slug={slug} />
              ))}
            </div>
          </div>
          <p className="text-xs text-stone-400">
            {output.input_tokens + output.output_tokens} tokens · {output.tool_calls} tool calls
            · {output.graph_snapshot?.total_articles} articles in graph at time of run
          </p>
        </div>
      )}
    </section>
  )
}

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Agents</h1>
        <p className="text-sm text-stone-500 mt-1">
          Three learning tools that analyse your graph and surface insights automatically.
        </p>
      </div>
      <SteelmanSection />
      <RepriseSection />
      <BlindSpotSection />
    </div>
  )
}
