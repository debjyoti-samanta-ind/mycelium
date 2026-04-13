import { useState } from 'react'

// Load all digest files
const digestModules = import.meta.glob('../../data/digests/*.json', { eager: true })
const allDigests = Object.values(digestModules)
  .filter(m => m.default)
  .map(m => m.default)
  .sort((a, b) => b.month.localeCompare(a.month)) // most recent first

function monthLabel(monthStr) {
  try {
    return new Date(monthStr + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })
  } catch {
    return monthStr
  }
}

export default function DigestsPage() {
  const [selected, setSelected] = useState(allDigests[0] || null)

  if (!allDigests.length) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <p className="text-stone-500 text-sm">No monthly digests yet.</p>
        <p className="text-stone-400 text-xs mt-2 leading-relaxed">
          The first digest will be generated automatically on the 1st of next month.<br />
          You can also trigger one manually via GitHub Actions → Monthly Digest → Run workflow.
        </p>
      </div>
    )
  }

  return (
    <div className="flex gap-8">

      {/* Sidebar — digest list */}
      <div className="w-44 flex-shrink-0">
        <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-3">Months</p>
        <ul className="space-y-1">
          {allDigests.map(d => (
            <li key={d.month}>
              <button
                onClick={() => setSelected(d)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selected?.month === d.month
                    ? 'bg-stone-100 text-stone-900 font-medium'
                    : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'
                }`}
              >
                {monthLabel(d.month)}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Main — digest content */}
      {selected && (
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-1">
            <h1 className="text-xl font-semibold text-stone-900">{monthLabel(selected.month)}</h1>
            <span className="text-xs text-stone-400">Generated {selected.generated_at}</span>
          </div>
          <p className="text-xs text-stone-400 mb-6">
            {selected.articles_this_month} article{selected.articles_this_month !== 1 ? 's' : ''} &nbsp;·&nbsp;
            {selected.new_edges_this_month} connection{selected.new_edges_this_month !== 1 ? 's' : ''}
          </p>

          <section className="mb-6">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Reading this month</p>
            <p className="text-sm text-stone-700 leading-relaxed">{selected.narrative}</p>
          </section>

          <section className="mb-6">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Opinion shifts</p>
            <p className="text-sm text-stone-700 leading-relaxed">{selected.opinion_shifts}</p>
          </section>

          {selected.tensions?.length > 0 && (
            <section className="mb-6">
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Tensions surfaced</p>
              <ul className="space-y-2">
                {selected.tensions.map((t, i) => (
                  <li key={i} className="text-sm text-stone-700 leading-relaxed pl-3 border-l-2 border-stone-200">
                    {t}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {selected.surprise_connection && selected.surprise_connection !== 'None this month.' && (
            <section className="mb-6">
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Most surprising connection</p>
              <p className="text-sm text-stone-700 leading-relaxed pl-3 border-l-2 border-amber-300">
                {selected.surprise_connection}
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
