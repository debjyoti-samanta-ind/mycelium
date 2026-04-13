const STANCE_COLOURS = {
  optimistic: '#4a7c59',
  pessimistic: '#c0392b',
  neutral: '#888780',
  ambivalent: '#e17055',
}

const CONTENT_TYPE_LABELS = {
  essay: 'Essay',
  news: 'News',
  thread: 'Thread',
  summary: 'Summary',
  other: '',
}

export default function ArticleCard({ article }) {
  const {
    title,
    source,
    url,
    date_added,
    published_date,
    content_type,
    summary,
    key_claims,
    domain,
    stance,
    key_entities,
  } = article

  const displayDate = published_date || date_added
  const typeLabel = CONTENT_TYPE_LABELS[content_type] ?? ''
  const stanceColour = STANCE_COLOURS[stance] ?? '#B4B2A9'

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

      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        {stance && (
          <span
            className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
            style={{ backgroundColor: stanceColour }}
          >
            {stance}
          </span>
        )}

        {domain && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
            {domain}
          </span>
        )}

        {key_entities && key_entities.map(entity => (
          <span
            key={entity}
            className="text-xs px-2 py-0.5 rounded-full bg-stone-50 text-stone-400 border border-stone-200"
          >
            {entity}
          </span>
        ))}
      </div>
    </div>
  )
}
