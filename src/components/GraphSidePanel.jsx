export default function GraphSidePanel({ node, link, articleMap, edgeColours, onClose }) {

  if (node) {
    const article = node.article || articleMap[node.id]

    return (
      <div className="absolute top-0 right-0 h-full w-80 bg-white border-l border-stone-200 overflow-y-auto shadow-lg z-10">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 sticky top-0 bg-white">
          <span className="text-xs text-stone-400 font-medium uppercase tracking-wide">Article</span>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {article ? (
          <div className="p-4 space-y-4">

            {/* Title + meta */}
            <div>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-stone-900 hover:text-stone-600 leading-snug block"
              >
                {article.title}
              </a>
              <p className="text-xs text-stone-400 mt-0.5">
                {[article.source, article.published_date || article.date_added].filter(Boolean).join(' · ')}
              </p>
            </div>

            {/* Central argument */}
            {article.central_argument && (
              <div>
                <p className="text-xs font-medium text-stone-500 mb-1">Central argument</p>
                <p className="text-xs text-stone-700 leading-relaxed italic">
                  "{article.central_argument}"
                </p>
              </div>
            )}

            {/* Summary */}
            {article.summary && (
              <div>
                <p className="text-xs font-medium text-stone-500 mb-1">Summary</p>
                <p className="text-xs text-stone-600 leading-relaxed">{article.summary}</p>
              </div>
            )}

            {/* Key claims */}
            {article.key_claims?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-stone-500 mb-1">Key claims</p>
                <ul className="space-y-1.5">
                  {article.key_claims.map((claim, i) => (
                    <li key={i} className="flex gap-2 text-xs text-stone-600">
                      <span className="text-stone-300 select-none flex-shrink-0 mt-0.5">—</span>
                      <span className="leading-relaxed">{claim}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Domain + stance badges */}
            {(article.domain || article.stance) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {article.stance && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
                    {article.stance}
                  </span>
                )}
                {article.domain && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
                    {article.domain}
                  </span>
                )}
              </div>
            )}

            {/* Topic tags */}
            {article.topic_tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {article.topic_tags.map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-stone-50 text-stone-400 border border-stone-200">
                    {tag}
                  </span>
                ))}
              </div>
            )}

          </div>
        ) : (
          <p className="p-4 text-xs text-stone-400">Article data not found.</p>
        )}
      </div>
    )
  }

  if (link) {
    const srcId = typeof link.source === 'object' ? link.source.id : link.source
    const tgtId = typeof link.target === 'object' ? link.target.id : link.target
    const srcArticle = articleMap[srcId]
    const tgtArticle = articleMap[tgtId]
    const colour = edgeColours[link.type] || '#B4B2A9'

    return (
      <div className="absolute top-0 right-0 h-full w-80 bg-white border-l border-stone-200 overflow-y-auto shadow-lg z-10">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 sticky top-0 bg-white">
          <span className="text-xs text-stone-400 font-medium uppercase tracking-wide">Connection</span>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">

          {/* Connection type badge */}
          <span
            className="inline-block text-xs px-2.5 py-0.5 rounded-full text-white font-medium"
            style={{ backgroundColor: colour }}
          >
            {link.type}
          </span>

          {/* Explanation */}
          {link.explanation && (
            <p className="text-sm text-stone-700 leading-relaxed">{link.explanation}</p>
          )}

          {/* Specific claims connected */}
          {(link.claim_a || link.claim_b) && (
            <div className="space-y-2 pt-2 border-t border-stone-100">
              <p className="text-xs font-medium text-stone-500">Specific claims connected</p>
              {link.claim_a && (
                <div className="pl-3 border-l-2 border-stone-200">
                  <p className="text-xs text-stone-400 mb-0.5">Article A</p>
                  <p className="text-xs text-stone-600 leading-relaxed">{link.claim_a}</p>
                </div>
              )}
              {link.claim_b && (
                <div className="pl-3 border-l-2 border-stone-200">
                  <p className="text-xs text-stone-400 mb-0.5">Article B</p>
                  <p className="text-xs text-stone-600 leading-relaxed">{link.claim_b}</p>
                </div>
              )}
            </div>
          )}

          {/* The two articles */}
          <div className="space-y-3 pt-2 border-t border-stone-100">
            {[srcArticle, tgtArticle].filter(Boolean).map((article, i) => (
              <div key={i}>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-stone-700 hover:text-stone-500 block leading-snug"
                >
                  {article.title}
                </a>
                <p className="text-xs text-stone-400 mt-0.5">{article.source}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    )
  }

  return null
}
