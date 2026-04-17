const DOMAIN_BUCKETS = [
  { color: '#6366f1', keywords: ['tech', 'software', 'ai', 'digital', 'data', 'machine learning', 'computer'] },
  { color: '#0d9488', keywords: ['science', 'biology', 'physics', 'neuro', 'cognitive', 'psychology', 'complexity', 'evolutionary'] },
  { color: '#d97706', keywords: ['business', 'econom', 'financ', 'marketing', 'management', 'organizational', 'organisational', 'geopolit', 'trade'] },
  { color: '#dc6b3f', keywords: ['philosoph', 'histor', 'sociol', 'political', 'media', 'culture', 'anthropol', 'ethics'] },
]

function getDomainColor(domain = '') {
  const d = domain.toLowerCase()
  for (const b of DOMAIN_BUCKETS) {
    if (b.keywords.some(k => d.includes(k))) return b.color
  }
  return '#78716c'
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function CloseButton({ onClose }) {
  return (
    <button
      onClick={onClose}
      className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
      aria-label="Close"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5">
      {children}
    </p>
  )
}

export default function GraphSidePanel({ node, link, articleMap, edgeColours, onClose }) {

  // ── Article panel ────────────────────────────────────────────────────────
  if (node) {
    const article = node.article || articleMap[node.id]
    const domainColor = getDomainColor(article?.domain)

    return (
      <div className="absolute top-0 right-0 h-full w-80 bg-white border-l border-stone-200 overflow-y-auto z-10"
        style={{ boxShadow: '-4px 0 24px rgba(0,0,0,0.06)' }}>

        {/* Header */}
        <div
          className="sticky top-0 bg-white z-10 flex items-center justify-between px-4 py-3 border-b border-stone-100"
          style={{ borderTop: `3px solid ${domainColor}` }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: domainColor }}>
            Article
          </span>
          <CloseButton onClose={onClose} />
        </div>

        {article ? (
          <div className="p-5 space-y-4">

            {/* Title + meta */}
            <div>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="serif text-base font-semibold text-stone-900 hover:text-stone-600 leading-snug block"
              >
                {article.title}
              </a>
              <p className="text-xs text-stone-400 mt-1">
                {[article.source, article.published_date || article.date_added].filter(Boolean).join(' · ')}
              </p>
            </div>

            {/* Domain + stance */}
            {(article.domain || article.stance) && (
              <div className="flex flex-wrap gap-1.5">
                {article.domain && (
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: hexToRgba(domainColor, 0.08), color: domainColor, border: `1px solid ${hexToRgba(domainColor, 0.2)}` }}
                  >
                    {article.domain}
                  </span>
                )}
                {article.stance && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-stone-100 text-stone-500">
                    {article.stance}
                  </span>
                )}
              </div>
            )}

            {/* Central argument */}
            {article.central_argument && (
              <div>
                <SectionLabel>Central argument</SectionLabel>
                <p className="text-xs text-stone-700 leading-relaxed italic">
                  "{article.central_argument}"
                </p>
              </div>
            )}

            {/* Summary */}
            {article.summary && (
              <div>
                <SectionLabel>Summary</SectionLabel>
                <p className="text-xs text-stone-600 leading-relaxed">{article.summary}</p>
              </div>
            )}

            {/* Key claims */}
            {article.key_claims?.length > 0 && (
              <div>
                <SectionLabel>Key claims</SectionLabel>
                <ul className="space-y-2">
                  {article.key_claims.map((claim, i) => (
                    <li key={i} className="flex gap-2 text-xs text-stone-600">
                      <span className="select-none flex-shrink-0 mt-0.5 font-medium"
                        style={{ color: domainColor }}>—</span>
                      <span className="leading-relaxed">{claim}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Topic tags */}
            {article.topic_tags?.length > 0 && (
              <div>
                <SectionLabel>Tags</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {article.topic_tags.map(tag => (
                    <span key={tag}
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: hexToRgba(domainColor, 0.06), color: domainColor, border: `1px solid ${hexToRgba(domainColor, 0.15)}` }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        ) : (
          <p className="p-5 text-xs text-stone-400">Article data not found.</p>
        )}
      </div>
    )
  }

  // ── Connection panel ─────────────────────────────────────────────────────
  if (link) {
    const srcId     = typeof link.source === 'object' ? link.source.id : link.source
    const tgtId     = typeof link.target === 'object' ? link.target.id : link.target
    const srcArticle = articleMap[srcId]
    const tgtArticle = articleMap[tgtId]
    const colour    = edgeColours[link.type] || '#B4B2A9'

    return (
      <div className="absolute top-0 right-0 h-full w-80 bg-white border-l border-stone-200 overflow-y-auto z-10"
        style={{ boxShadow: '-4px 0 24px rgba(0,0,0,0.06)' }}>

        {/* Header */}
        <div
          className="sticky top-0 bg-white z-10 flex items-center justify-between px-4 py-3 border-b border-stone-100"
          style={{ borderTop: `3px solid ${colour}` }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold text-white"
              style={{ backgroundColor: colour }}
            >
              {link.type}
            </span>
          </div>
          <CloseButton onClose={onClose} />
        </div>

        <div className="p-5 space-y-5">

          {/* Explanation */}
          {link.explanation && (
            <div>
              <SectionLabel>Connection</SectionLabel>
              <p className="text-sm text-stone-700 leading-relaxed">{link.explanation}</p>
            </div>
          )}

          {/* Specific claims */}
          {(link.claim_a || link.claim_b) && (
            <div>
              <SectionLabel>Specific claims</SectionLabel>
              <div className="space-y-3">
                {link.claim_a && (
                  <div className="pl-3 py-1" style={{ borderLeft: `2px solid ${colour}` }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-1"
                      style={{ color: colour }}>A</p>
                    <p className="text-xs text-stone-600 leading-relaxed">{link.claim_a}</p>
                  </div>
                )}
                {link.claim_b && (
                  <div className="pl-3 py-1" style={{ borderLeft: `2px solid ${colour}` }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-1"
                      style={{ color: colour }}>B</p>
                    <p className="text-xs text-stone-600 leading-relaxed">{link.claim_b}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* The two articles */}
          {(srcArticle || tgtArticle) && (
            <div>
              <SectionLabel>Articles</SectionLabel>
              <div className="space-y-3">
                {[srcArticle, tgtArticle].filter(Boolean).map((article, i) => {
                  const dc = getDomainColor(article.domain)
                  return (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: dc }} />
                      <div>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-stone-800 hover:text-stone-500 leading-snug block"
                        >
                          {article.title}
                        </a>
                        <p className="text-[11px] text-stone-400 mt-0.5">{article.source}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    )
  }

  return null
}
