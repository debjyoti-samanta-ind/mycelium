import ArticleCard from '../components/ArticleCard.jsx'

// Loaded at dev-server startup — run `git pull` then restart to see new articles
const articleModules = import.meta.glob('../../data/articles/*.json', { eager: true })
const articles = Object.values(articleModules)
  .map(m => m.default)
  .filter(Boolean)
  .sort((a, b) => new Date(b.date_added) - new Date(a.date_added))

export default function ArticleListPage() {
  if (articles.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-500 text-sm">No articles yet.</p>
        <p className="text-stone-400 text-xs mt-2 leading-relaxed">
          Add your first article using the <strong className="text-stone-500">Add Article</strong> tab.
          <br />
          After GitHub Actions processes it, run{' '}
          <code className="bg-stone-100 px-1 rounded font-mono">git pull</code>{' '}
          and restart the dev server.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">Articles</h1>
        <span className="text-sm text-stone-400">
          {articles.length} {articles.length === 1 ? 'article' : 'articles'}
        </span>
      </div>
      <div className="space-y-4">
        {articles.map(article => (
          <ArticleCard key={article.slug} article={article} />
        ))}
      </div>
    </div>
  )
}
