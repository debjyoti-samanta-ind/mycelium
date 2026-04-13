import { useState, useRef } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { submitUrl } from '../utils/github.js'

// Use the bundled PDF.js worker via Vite's asset URL handling
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    fullText += textContent.items.map(item => item.str).join(' ') + '\n\n'
  }
  return fullText.trim()
}

export default function SubmitPage() {
  const [url, setUrl] = useState('')
  const [showTextFallback, setShowTextFallback] = useState(false)
  const [pastedText, setPastedText] = useState('')
  const [pdfStatus, setPdfStatus] = useState('idle') // idle | extracting | done | error
  const [pdfError, setPdfError] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [errorMessage, setErrorMessage] = useState('')
  const fileInputRef = useRef(null)

  const isConfigured = import.meta.env.VITE_GITHUB_TOKEN && import.meta.env.VITE_GITHUB_REPO

  async function handlePdfUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setPdfStatus('extracting')
    setPdfError('')
    setShowTextFallback(true)

    try {
      const text = await extractTextFromPdf(file)
      if (!text) {
        throw new Error('No text found — this may be a scanned PDF. Try copying the text manually.')
      }
      setPastedText(text)
      setPdfStatus('done')
    } catch (err) {
      setPdfStatus('error')
      setPdfError(err.message)
    } finally {
      // Reset file input so the same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

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
      setPdfStatus('idle')
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

        {/* Fallback toggle */}
        <button
          type="button"
          onClick={() => setShowTextFallback(v => !v)}
          className="text-xs text-stone-400 hover:text-stone-600 underline underline-offset-2 transition-colors"
        >
          {showTextFallback
            ? 'Hide text field'
            : 'r.jina.ai failed or article is paywalled? Paste text or upload a PDF instead.'}
        </button>

        {showTextFallback && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="pastedText" className="block text-sm font-medium text-stone-700">
                  Article text{' '}
                  <span className="text-stone-400 font-normal">(overrides URL fetch when provided)</span>
                </label>

                {/* PDF upload button */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfUpload}
                    className="hidden"
                    id="pdfUpload"
                    disabled={status === 'loading' || pdfStatus === 'extracting'}
                  />
                  <label
                    htmlFor="pdfUpload"
                    className={`text-xs px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                      pdfStatus === 'extracting'
                        ? 'bg-stone-50 text-stone-400 border-stone-200 cursor-wait'
                        : pdfStatus === 'done'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-white text-stone-500 border-stone-300 hover:border-stone-400'
                    }`}
                  >
                    {pdfStatus === 'extracting' ? 'Extracting…' : pdfStatus === 'done' ? 'PDF extracted ✓' : 'Upload PDF'}
                  </label>
                </div>
              </div>

              {/* PDF error */}
              {pdfStatus === 'error' && (
                <p className="text-xs text-red-600 mb-1.5">{pdfError}</p>
              )}

              <textarea
                id="pastedText"
                value={pastedText}
                onChange={e => {
                  setPastedText(e.target.value)
                  if (pdfStatus === 'done') setPdfStatus('idle')
                }}
                placeholder="Paste the full article text here, or upload a PDF above to populate this automatically…"
                rows={8}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white resize-y font-mono leading-relaxed"
                disabled={status === 'loading' || pdfStatus === 'extracting'}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'loading' || !url.trim() || pdfStatus === 'extracting'}
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
