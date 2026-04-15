import { useState } from 'react'

export default function ArticleCard({ article, onDelete, isDeleting }) {
  const [expanded, setExpanded]   = useState(false)
  const [confirming, setConfirming] = useState(false)

  const { title, source, url, date_added, domain, summary } = article

  return (
    <div className="bg-white border border-stone-200 rounded-xl hover:border-stone-300 transition-colors">

      {/* ── Header row (always visible) ── */}
      <div
        className="flex items-start justify-between gap-3 px-5 py-4 cursor-pointer select-none"
        onClick={() => { if (!confirming) setExpanded(e => !e) }}
      >
        <div className="min-w-0 flex-1">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-stone-900 hover:text-stone-600 leading-snug"
            onClick={e => e.stopPropagation()}
          >
            {title}
          </a>
          <p className="text-xs text-stone-400 mt-0.5">
            {[source, domain, date_added].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 mt-0.5">
          {/* Delete control */}
          {onDelete && (
            confirming ? (
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <span className="text-xs text-stone-500">Delete?</span>
                <button
                  onClick={() => onDelete(article)}
                  disabled={isDeleting}
                  className="text-xs px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {isDeleting ? 'Deleting…' : 'Yes'}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={isDeleting}
                  className="text-xs px-2 py-0.5 rounded border border-stone-300 text-stone-600 hover:border-stone-400 transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); setConfirming(true) }}
                className="text-stone-300 hover:text-red-500 transition-colors"
                title="Delete article"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            )
          )}

          {/* Chevron */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14" height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-stone-300 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* ── Expanded content ── */}
      {expanded && summary && (
        <div className="px-5 pb-4 border-t border-stone-100 pt-3">
          <p className="text-sm text-stone-600 leading-relaxed">{summary}</p>
        </div>
      )}
    </div>
  )
}
