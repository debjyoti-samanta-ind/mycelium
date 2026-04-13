import { useState } from 'react'
import ArticleCard from '../components/ArticleCard.jsx'
import { deleteArticle, dismissFailed } from '../utils/github.js'

// Loaded at dev-server startup — run `git pull` then restart to see new articles
const articleModules = import.meta.glob('../../data/articles/*.json', { eager: true })
const initialArticles = Object.values(articleModules)
  .map(m => m.default)
  .filter(Boolean)
  .sort((a, b) => new Date(b.date_added) - new Date(a.date_added))

const failedModules = import.meta.glob('../../data/queue_failed.json', { eager: true })
const failedData = Object.values(failedModules)[0]?.default ?? { failed: [] }
const initialFailed = (failedData.failed ?? []).slice().reverse() // newest first

export default function ArticleListPage({ onArticleDeleted }) {
  const [articles, setArticles] = useState(initialArticles)
  const [failedItems, setFailedItems] = useState(initialFailed)
  const [deletingSlug, setDeletingSlug] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [dismissingUrl, setDismissingUrl] = useState(null)
  const [dismissError, setDismissError] = useState('')

  async function handleDelete(article) {
    setDeletingSlug(article.slug)
    setDeleteError('')
    try {
      await deleteArticle(article.slug, article.url)
      setArticles(prev => prev.filter(a => a.slug !== article.slug))
      onArticleDeleted?.(article.slug)
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeletingSlug(null)
    }
  }

  async function handleDismiss(url) {
    setDismissingUrl(url)
    setDismissError('')
    try {
      await dismissFailed(url)
      setFailedItems(prev => prev.filter(item => item.url !== url))
    } catch (err) {
      setDismissError(err.message)
    } finally {
      setDismissingUrl(null)
    }
  }

  return (
    <div>
      {/* Failed articles section */}
      {failedItems.length > 0 && (
        <div className="mb-8">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold text-amber-800">Failed to fetch</h2>
            <span className="text-xs text-amber-600">{failedItems.length} {failedItems.length === 1 ? 'item' : 'items'}</span>
          </div>
          <div className="space-y-2">
            {failedItems.map(item => (
              <div
                key={item.url}
                className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-amber-900 truncate">{item.url}</p>
                  <p className="text-xs text-amber-700 mt-0.5">{item.reason}</p>
                  <p className="text-xs text-amber-500 mt-0.5">
                    To retry: copy the URL above and re-submit it with a PDF on the Add Article page.
                  </p>
                </div>
                <button
                  onClick={() => handleDismiss(item.url)}
                  disabled={dismissingUrl === item.url}
                  className="shrink-0 text-xs px-2.5 py-1 rounded-lg border border-amber-300 text-amber-700 hover:border-amber-400 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                >
                  {dismissingUrl === item.url ? 'Dismissing…' : 'Dismiss'}
                </button>
              </div>
            ))}
          </div>
          {dismissError && (
            <p className="text-xs text-red-600 mt-2">{dismissError}</p>
          )}
        </div>
      )}

      {/* Articles list */}
      {articles.length === 0 && failedItems.length === 0 ? (
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
      ) : articles.length > 0 ? (
        <>
          <div className="flex items-baseline justify-between mb-6">
            <h1 className="text-2xl font-semibold text-stone-900">Articles</h1>
            <span className="text-sm text-stone-400">
              {articles.length} {articles.length === 1 ? 'article' : 'articles'}
            </span>
          </div>
          {deleteError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-xs text-red-700">{deleteError}</p>
            </div>
          )}
          <div className="space-y-4">
            {articles.map(article => (
              <ArticleCard
                key={article.slug}
                article={article}
                onDelete={handleDelete}
                isDeleting={deletingSlug === article.slug}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
