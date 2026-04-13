import { useState } from 'react'

const TOPIC_COLOURS = {
  ai: '#7F77DD',
  technology: '#7F77DD',
  productivity: '#1D9E75',
  business: '#BA7517',
  society: '#D85A30',
  science: '#888780',
  health: '#4a7c59',
  politics: '#c0392b',
  economics: '#e17055',
  culture: '#F4C0D1',
}

const CONTENT_TYPE_LABELS = {
  essay: 'Essay',
  news: 'News',
  thread: 'Thread',
  summary: 'Summary',
  other: '',
}

export default function ArticleCard({ article, onDelete, isDeleting }) {
  const [confirming, setConfirming] = useState(false)

  const {
    title,
    source,
    url,
    date_added,
    published_date,
    content_type,
    summary,
    key_claims,
    topic_tags,
  } = article

  const displayDate = published_date || date_added
  const typeLabel = CONTENT_TYPE_LABELS[content_type] ?? ''

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 hover:border-stone-300 transition-colors">
      <div className="mb-3">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-base font-medium text-stone-900 hover:text-stone-600 leading-snug"
        >
          {title}
        </a>
        <p className="text-xs text-stone-400 mt-0.5">
          {[source, displayDate, typeLabel].filter(Boolean).join(' · ')}
        </p>
      </div>

      {summary && (
        <p className="text-sm text-stone-600 leading-relaxed mb-3">{summary}</p>
      )}

      {key_claims && key_claims.length > 0 && (
        <ul className="text-xs text-stone-500 space-y-1 mb-3 pl-1">
          {key_claims.map((claim, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-stone-300 select-none">—</span>
              <span>{claim}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end justify-between mt-3">
        {topic_tags && topic_tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {topic_tags.map(tag => {
              const colour = TOPIC_COLOURS[tag.toLowerCase()] ?? '#B4B2A9'
              return (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                  style={{ backgroundColor: colour }}
                >
                  {tag}
                </span>
              )
            })}
          </div>
        ) : (
          <span />
        )}

        {/* Delete control */}
        {onDelete && (
          <div className="flex items-center gap-2 ml-4 shrink-0">
            {confirming ? (
              <>
                <span className="text-xs text-stone-500">Delete this article?</span>
                <button
                  onClick={() => onDelete(article)}
                  disabled={isDeleting}
                  className="text-xs px-2.5 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {isDeleting ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={isDeleting}
                  className="text-xs px-2.5 py-1 rounded-lg border border-stone-300 text-stone-600 hover:border-stone-400 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="text-stone-400 hover:text-red-500 transition-colors"
                title="Delete article"
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
        )}
      </div>
    </div>
  )
}
