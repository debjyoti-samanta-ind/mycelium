import { useState } from 'react'

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export default function ArticleCard({ article, onDelete, isDeleting, domainColor = '#78716c', domainBucket = 'Other' }) {
  const [expanded,   setExpanded]   = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [hovered,    setHovered]    = useState(false)

  const { title, source, url, date_added, domain, summary, key_claims, topic_tags } = article

  const cardStyle = {
    background:   '#ffffff',
    borderRadius: '16px',
    borderLeft:   `4px solid ${domainColor}`,
    boxShadow: hovered
      ? `0 1px 0 rgba(0,0,0,0.03), 0 6px 0 ${hexToRgba(domainColor, 0.45)}, 0 14px 28px rgba(0,0,0,0.08)`
      : `0 1px 0 rgba(0,0,0,0.03), 0 4px 0 ${hexToRgba(domainColor, 0.3)}, 0 8px 24px rgba(0,0,0,0.05)`,
    transform:    hovered ? 'translateY(-2px)' : 'translateY(0)',
    transition:   'transform 0.15s ease, box-shadow 0.15s ease',
  }

  const badgeStyle = {
    backgroundColor: hexToRgba(domainColor, 0.08),
    color:           domainColor,
    border:          `1px solid ${hexToRgba(domainColor, 0.2)}`,
  }

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Header row ── */}
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
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0"
              style={badgeStyle}
            >
              {domainBucket}
            </span>
            <span className="text-xs text-stone-400">
              {[source, date_added].filter(Boolean).join(' · ')}
            </span>
          </div>
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
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
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
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-stone-100 pt-3 space-y-3">
          {summary && (
            <p className="text-sm text-stone-600 leading-relaxed">{summary}</p>
          )}
          {key_claims?.length > 0 && (
            <ul className="text-xs text-stone-500 space-y-1 pl-1">
              {key_claims.map((claim, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-stone-300 select-none shrink-0">—</span>
                  <span>{claim}</span>
                </li>
              ))}
            </ul>
          )}
          {topic_tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {topic_tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={badgeStyle}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
