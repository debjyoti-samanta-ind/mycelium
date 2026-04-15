import { useState, useMemo } from 'react'
import ArticleCard from '../components/ArticleCard.jsx'
import { deleteArticle, dismissFailed } from '../utils/github.js'

const articleModules = import.meta.glob('../../data/articles/*.json', { eager: true })
const initialArticles = Object.values(articleModules)
  .map(m => m.default)
  .filter(Boolean)
  .sort((a, b) => new Date(b.date_added) - new Date(a.date_added))

const failedModules = import.meta.glob('../../data/queue_failed.json', { eager: true })
const failedData = Object.values(failedModules)[0]?.default ?? { failed: [] }
const initialFailed = (failedData.failed ?? []).slice().reverse()

// ── Domain buckets (mirrors GraphPage) ───────────────────────────────────────
const DOMAIN_BUCKETS = [
  { name: 'Tech & AI',       color: '#6366f1', keywords: ['tech', 'software', 'ai', 'digital', 'data', 'machine learning', 'computer'] },
  { name: 'Science & Mind',  color: '#0d9488', keywords: ['science', 'biology', 'physics', 'neuro', 'cognitive', 'psychology', 'complexity', 'evolutionary'] },
  { name: 'Business & Econ', color: '#d97706', keywords: ['business', 'econom', 'financ', 'marketing', 'management', 'organizational', 'organisational', 'geopolit', 'trade'] },
  { name: 'Humanities',      color: '#dc6b3f', keywords: ['philosoph', 'histor', 'sociol', 'political', 'media', 'culture', 'anthropol', 'ethics'] },
  { name: 'Other',           color: '#78716c', keywords: [] },
]

function getDomainBucket(domain = '') {
  const d = domain.toLowerCase()
  for (const bucket of DOMAIN_BUCKETS) {
    if (bucket.keywords.length && bucket.keywords.some(k => d.includes(k))) return bucket
  }
  return DOMAIN_BUCKETS[DOMAIN_BUCKETS.length - 1]
}

const DATE_OPTIONS = [
  { label: '7d',  days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: null },
]

export default function ArticleListPage({ onArticleDeleted }) {
  const [articles,      setArticles]      = useState(initialArticles)
  const [failedItems,   setFailedItems]   = useState(initialFailed)
  const [deletingSlug,  setDeletingSlug]  = useState(null)
  const [deleteError,   setDeleteError]   = useState('')
  const [dismissingUrl, setDismissingUrl] = useState(null)
  const [dismissError,  setDismissError]  = useState('')

  const [search,       setSearch]       = useState('')
  const [activeBucket, setActiveBucket] = useState('all')
  const [dateDays,     setDateDays]     = useState(null)

  // Count articles per bucket for the filter pills
  const bucketCounts = useMemo(() => {
    const counts = {}
    articles.forEach(a => {
      const name = getDomainBucket(a.domain).name
      counts[name] = (counts[name] || 0) + 1
    })
    return counts
  }, [articles])

  const filtered = useMemo(() => {
    const cutoff = dateDays
      ? new Date(Date.now() - dateDays * 86400000).toISOString().slice(0, 10)
      : null
    return articles.filter(a => {
      if (search && !a.title?.toLowerCase().includes(search.toLowerCase())) return false
      if (activeBucket !== 'all' && getDomainBucket(a.domain).name !== activeBucket) return false
      if (cutoff && a.date_added < cutoff) return false
      return true
    })
  }, [articles, search, activeBucket, dateDays])

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

  if (articles.length === 0 && failedItems.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-500 text-sm">No articles yet.</p>
        <p className="text-stone-400 text-xs mt-2 leading-relaxed">
          Add your first article using the <strong className="text-stone-500">Add Article</strong> tab.
          <br/>
          After GitHub Actions processes it, run{' '}
          <code className="bg-stone-100 px-1 rounded font-mono">git pull</code>{' '}
          and restart the dev server.
        </p>
      </div>
    )
  }

  return (
    <div>

      {/* ── Failed articles ─────────────────────────────────────────────── */}
      {failedItems.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-700 mb-3">
            Failed to fetch
          </h2>
          <div className="space-y-2">
            {failedItems.map(item => (
              <div
                key={item.url}
                className="bg-white rounded-xl flex items-start justify-between gap-4 px-5 py-4"
                style={{ borderLeft: '4px solid #f59e0b', boxShadow: '0 1px 0 rgba(0,0,0,0.03), 0 4px 0 rgba(245,158,11,0.3), 0 8px 24px rgba(0,0,0,0.05)' }}
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-stone-800 truncate">{item.url}</p>
                  <p className="text-xs text-stone-500 mt-0.5">{item.reason}</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    To retry: re-submit this URL with a PDF on the Add Article page.
                  </p>
                </div>
                <button
                  onClick={() => handleDismiss(item.url)}
                  disabled={dismissingUrl === item.url}
                  className="shrink-0 text-xs px-2.5 py-1 rounded-lg border border-stone-200 text-stone-600 hover:border-stone-400 disabled:opacity-50 transition-colors"
                >
                  {dismissingUrl === item.url ? 'Dismissing…' : 'Dismiss'}
                </button>
              </div>
            ))}
          </div>
          {dismissError && <p className="text-xs text-red-600 mt-2">{dismissError}</p>}
        </div>
      )}

      {/* ── Article list ─────────────────────────────────────────────────── */}
      {articles.length > 0 && (
        <>
          {/* Header */}
          <div className="flex items-baseline justify-between mb-6">
            <h1 className="serif text-4xl font-bold text-stone-900">Articles</h1>
            <span className="text-sm text-stone-400">
              {filtered.length === articles.length
                ? `${articles.length} ${articles.length === 1 ? 'article' : 'articles'}`
                : `${filtered.length} of ${articles.length}`}
            </span>
          </div>

          {/* Filter bar */}
          <div className="space-y-3 mb-6">
            <input
              type="text"
              placeholder="Search by title…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-sm border border-stone-200 rounded-xl px-4 py-2.5 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
            />

            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Domain bucket pills */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveBucket('all')}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                    activeBucket === 'all'
                      ? 'bg-stone-800 text-white border-transparent'
                      : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'
                  }`}
                >
                  All
                </button>
                {DOMAIN_BUCKETS.filter(b => bucketCounts[b.name]).map(bucket => (
                  <button
                    key={bucket.name}
                    onClick={() => setActiveBucket(activeBucket === bucket.name ? 'all' : bucket.name)}
                    className="text-xs px-3 py-1.5 rounded-full font-medium border transition-all"
                    style={activeBucket === bucket.name
                      ? { backgroundColor: bucket.color, color: '#fff', borderColor: 'transparent' }
                      : { backgroundColor: '#fff', color: bucket.color, borderColor: `${bucket.color}40` }
                    }
                  >
                    {bucket.name}
                    <span className="ml-1.5 opacity-70">{bucketCounts[bucket.name]}</span>
                  </button>
                ))}
              </div>

              {/* Date pills */}
              <div className="flex rounded-xl border border-stone-200 overflow-hidden shrink-0">
                {DATE_OPTIONS.map(({ label, days }) => (
                  <button
                    key={label}
                    onClick={() => setDateDays(days)}
                    className={`text-xs px-3 py-1.5 transition-colors ${
                      dateDays === days
                        ? 'bg-stone-800 text-white'
                        : 'text-stone-500 bg-white hover:bg-stone-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {deleteError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-xs text-red-700">{deleteError}</p>
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-12">No articles match your filters.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map(article => {
                const bucket = getDomainBucket(article.domain)
                return (
                  <ArticleCard
                    key={article.slug}
                    article={article}
                    onDelete={handleDelete}
                    isDeleting={deletingSlug === article.slug}
                    domainColor={bucket.color}
                    domainBucket={bucket.name}
                  />
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
