import opinionsData from '../../data/opinions.json'

// Load articles for cross-referencing slugs to titles
const articleModules = import.meta.glob('../../data/articles/*.json', { eager: true })
const articleMap = Object.fromEntries(
  Object.values(articleModules)
    .filter(m => m.default)
    .map(m => [m.default.slug, m.default])
)

const { generated_at, opinions } = opinionsData

export default function OpinionsPage() {
  if (!opinions || opinions.length === 0) {
    return (
      <div className="py-16 text-center max-w-xl mx-auto">
        <p className="text-stone-500 text-sm">No opinions synthesised yet.</p>
        <p className="text-stone-400 text-xs mt-2 leading-relaxed">
          Opinions are generated every Sunday night once you have at least 3 articles.
          <br />
          You can also trigger the <strong className="text-stone-500">Synthesise Opinions</strong> workflow
          manually from GitHub Actions.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Opinions</h1>
          <p className="text-xs text-stone-400 mt-0.5">
            What your reading seems to be building toward · Last updated {generated_at}
          </p>
        </div>
        <span className="text-sm text-stone-400">
          {opinions.length} {opinions.length === 1 ? 'theme' : 'themes'}
        </span>
      </div>

      <div className="space-y-6">
        {opinions.map((opinion, i) => {
          const linkedArticles = (opinion.article_slugs || [])
            .map(slug => articleMap[slug])
            .filter(Boolean)

          return (
            <div key={i} className="bg-white border border-stone-200 rounded-xl p-6">

              {/* Theme */}
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Theme</p>
              <h2 className="text-base font-semibold text-stone-900 mb-4 leading-snug">
                {opinion.theme}
              </h2>

              {/* Position */}
              <div className="mb-4">
                <p className="text-xs font-medium text-stone-500 mb-1.5">Emerging position</p>
                <p className="text-sm text-stone-700 leading-relaxed">{opinion.position}</p>
              </div>

              {/* Tension */}
              {opinion.tension && (
                <div className="mb-4 pl-3 border-l-2 border-stone-200">
                  <p className="text-xs font-medium text-stone-400 mb-1">Tension</p>
                  <p className="text-xs text-stone-500 leading-relaxed">{opinion.tension}</p>
                </div>
              )}

              {/* Contributing articles */}
              {linkedArticles.length > 0 && (
                <div className="pt-4 border-t border-stone-100">
                  <p className="text-xs font-medium text-stone-400 mb-2">
                    Based on {linkedArticles.length} {linkedArticles.length === 1 ? 'article' : 'articles'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {linkedArticles.map(article => (
                      <a
                        key={article.slug}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-lg text-stone-600 hover:text-stone-900 hover:border-stone-300 transition-colors"
                      >
                        {article.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )
        })}
      </div>
    </div>
  )
}
