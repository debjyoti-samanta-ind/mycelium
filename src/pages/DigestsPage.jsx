import { useState } from 'react'
import { deleteDigest } from '../utils/github.js'

const digestModules = import.meta.glob('../../data/digests/*.json', { eager: true })
const initialDigests = Object.values(digestModules)
  .filter(m => m.default)
  .map(m => m.default)
  .sort((a, b) => b.month.localeCompare(a.month))

function monthLabel(monthStr) {
  try {
    return new Date(monthStr + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })
  } catch {
    return monthStr
  }
}

function shortMonth(monthStr) {
  try {
    return new Date(monthStr + '-02').toLocaleString('default', { month: 'short' })
  } catch {
    return monthStr
  }
}

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2">
      {children}
    </p>
  )
}

export default function DigestsPage() {
  const [digests, setDigests]       = useState(initialDigests)
  const [selected, setSelected]     = useState(initialDigests[0] || null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [deleteError, setDeleteError] = useState(null)

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
        <div className="card-3d p-8">
          <p className="serif text-2xl font-bold text-stone-800 mb-2">No digests yet</p>
          <p className="text-stone-500 text-sm leading-relaxed">
            The first digest is generated automatically on the 1st of each month.
            <br />
            You can also trigger one manually via GitHub Actions → Monthly Digest → Run workflow.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-6 items-start">

      {/* Month sidebar */}
      <div className="w-36 flex-shrink-0 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 px-2 mb-3">
          Archive
        </p>
        {digests.map(d => {
          const active = selected?.month === d.month
          return (
            <button
              key={d.month}
              onClick={() => { setSelected(d); setConfirming(false); setDeleteError(null) }}
              className="w-full text-left px-3 py-2.5 rounded-xl transition-all"
              style={active
                ? { background: '#1c1917', color: '#fff' }
                : { background: 'transparent', color: '#78716c' }
              }
            >
              <p className={`text-sm font-semibold leading-tight ${active ? 'text-white' : 'text-stone-700'}`}>
                {shortMonth(d.month)}
              </p>
              <p className={`text-[11px] mt-0.5 ${active ? 'text-stone-400' : 'text-stone-400'}`}>
                {d.articles_this_month || 0} articles
              </p>
            </button>
          )
        })}
      </div>

      {/* Main content */}
      {selected && (
        <div className="flex-1 min-w-0">

          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1 className="serif text-4xl font-bold text-stone-900 leading-tight">
                {monthLabel(selected.month)}
              </h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-xs text-stone-400">
                  {selected.articles_this_month} {selected.articles_this_month !== 1 ? 'articles' : 'article'}
                </span>
                <span className="text-stone-200">·</span>
                <span className="text-xs text-stone-400">
                  {selected.new_edges_this_month} {selected.new_edges_this_month !== 1 ? 'connections' : 'connection'}
                </span>
                <span className="text-stone-200">·</span>
                <span className="text-xs text-stone-400">Generated {selected.generated_at}</span>
              </div>
            </div>

            {/* Delete */}
            <div className="flex items-center gap-2 shrink-0 mt-1">
              {confirming ? (
                <>
                  <span className="text-xs text-stone-500">Delete?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-xs px-2.5 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? 'Deleting…' : 'Yes'}
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
                  className="text-stone-300 hover:text-red-500 transition-colors p-1"
                  title="Delete digest"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {deleteError && (
            <p className="text-xs text-red-500 mb-4">{deleteError}</p>
          )}

          <div className="space-y-5">

            {/* Narrative */}
            {selected.narrative && (
              <div className="card-3d p-6">
                <SectionLabel>Reading this month</SectionLabel>
                <p className="text-[15px] text-stone-700 leading-relaxed">{selected.narrative}</p>
              </div>
            )}

            {/* Tensions */}
            {selected.tensions?.length > 0 && (
              <div className="card-3d p-6">
                <SectionLabel>Tensions surfaced</SectionLabel>
                <ul className="space-y-3">
                  {selected.tensions.map((t, i) => (
                    <li key={i} className="flex gap-3 text-sm text-stone-700 leading-relaxed">
                      <span className="text-stone-300 select-none shrink-0 mt-0.5 font-medium">—</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Surprise connection */}
            {selected.surprise_connection && selected.surprise_connection !== 'None this month.' && (
              <div className="card-3d p-6" style={{ borderLeft: '4px solid #f59e0b' }}>
                <SectionLabel>Most surprising connection</SectionLabel>
                <p className="text-[15px] text-stone-700 leading-relaxed">
                  {selected.surprise_connection}
                </p>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
