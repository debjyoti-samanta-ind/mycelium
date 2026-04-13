import { useState } from 'react'
import { submitUrl } from '../utils/github.js'

export default function SubmitPage() {
  const [url, setUrl] = useState('')
  const [showTextFallback, setShowTextFallback] = useState(false)
  const [pastedText, setPastedText] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [errorMessage, setErrorMessage] = useState('')

  const isConfigured = import.meta.env.VITE_GITHUB_TOKEN && import.meta.env.VITE_GITHUB_REPO

  async function handleSubmit(e) {
    e.preventDefault()
    if (!url.trim()) return

    setStatus('loading')
    setErrorMessage('')

    try {
      await submitUrl(url.trim(), pastedText.trim() || null)
      setStatus('success')
      setUrl('')
      setPastedText('')
      setShowTextFallback(false)
    } catch (err) {
      setStatus('error')
      setErrorMessage(err.message)
    }
  }

  if (!isConfigured) {
    return (
      <div className="py-12 max-w-xl">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-amber-900 mb-2">One-time setup needed</h2>
          <p className="text-sm text-amber-800 leading-relaxed">
            Create a{' '}
            <code className="bg-amber-100 px-1 rounded font-mono">.env.local</code>{' '}
            file in the project root with your GitHub token. See{' '}
            <strong>README.md</strong> for step-by-step instructions.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="py-8 max-w-xl">
      <h1 className="text-2xl font-semibold text-stone-900 mb-2">Add an article</h1>
      <p className="text-sm text-stone-500 mb-8">
        Paste a URL. Mycelium will fetch, read, and file it automatically.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-stone-700 mb-1.5">
            Article URL
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={e => {
              setUrl(e.target.value)
              if (status !== 'idle') setStatus('idle')
            }}
            placeholder="https://example.com/article"
            className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
            disabled={status === 'loading'}
            required
          />
        </div>

        <button
          type="button"
          onClick={() => setShowTextFallback(v => !v)}
          className="text-xs text-stone-400 hover:text-stone-600 underline underline-offset-2 transition-colors"
        >
          {showTextFallback
            ? 'Hide text field'
            : "r.jina.ai failed or article is paywalled? Paste the text instead."}
        </button>

        {showTextFallback && (
          <div>
            <label htmlFor="pastedText" className="block text-sm font-medium text-stone-700 mb-1.5">
              Article text{' '}
              <span className="text-stone-400 font-normal">(overrides URL fetch when provided)</span>
            </label>
            <textarea
              id="pastedText"
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              placeholder="Paste the full article text here..."
              rows={8}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white resize-y font-mono leading-relaxed"
              disabled={status === 'loading'}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'loading' || !url.trim()}
          className="px-5 py-2 bg-stone-800 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'loading' ? 'Submitting…' : 'Submit'}
        </button>
      </form>

      {status === 'success' && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-xl px-4 py-4">
          <p className="text-sm text-green-800 font-medium">Article queued.</p>
          <p className="text-xs text-green-700 mt-1 leading-relaxed">
            GitHub Actions will process it in a few minutes. Run{' '}
            <code className="bg-green-100 px-1 rounded font-mono">git pull</code>{' '}
            then restart the dev server to see it appear in the Articles list.
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-xl px-4 py-4">
          <p className="text-sm text-red-800 font-medium">Submission failed.</p>
          <p className="text-xs text-red-700 mt-1">{errorMessage}</p>
        </div>
      )}
    </div>
  )
}
