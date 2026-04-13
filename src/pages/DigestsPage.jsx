import { useState } from 'react'
import { deleteDigest } from '../utils/github.js'

// Load all digest files at module init — converted to state below for live removal
const digestModules = import.meta.glob('../../data/digests/*.json', { eager: true })
const initialDigests = Object.values(digestModules)
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
  const [digests, setDigests]           = useState(initialDigests)
  const [selected, setSelected]         = useState(initialDigests[0] || null)
  const [confirming, setConfirming]     = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [deleteError, setDeleteError]   = useState(null)

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteDigest(selected.month)
      const next = digests.filter(d => d.month !== selected.month)
      setDigests(next)
      setSelected(next[0] || null)
      setConfirming(false)
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  if (!digests.length) {
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
          {digests.map(d => (
            <li key={d.month}>
              <button
                onClick={() => { setSelected(d); setConfirming(false); setDeleteError(null) }}
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

            {/* Delete control */}
            <div className="flex items-center gap-2 ml-4 shrink-0">
              {confirming ? (
                <>
                  <span className="text-xs text-stone-500">Delete this digest?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-xs px-2.5 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button
                    onClick={() => { setConfirming(false); setDeleteError(null) }}
                    disabled={deleting}
                    className="text-xs px-2.5 py-1 rounded-lg border border-stone-300 text-stone-600 hover:border-stone-400 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirming(true)}
                  className="text-stone-400 hover:text-red-500 transition-colors"
                  title="Delete digest"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {deleteError && (
            <p className="text-xs text-red-500 mb-3">{deleteError}</p>
          )}

          <p className="text-xs text-stone-400 mb-6">
            {selected.articles_this_month} article{selected.articles_this_month !== 1 ? 's' : ''} &nbsp;·&nbsp;
            {selected.new_edges_this_month} connection{selected.new_edges_this_month !== 1 ? 's' : ''} &nbsp;·&nbsp;
            Generated {selected.generated_at}
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
