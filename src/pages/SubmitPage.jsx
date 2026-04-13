import { useState, useRef } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { submitUrls } from '../utils/github.js'

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
  const [urls, setUrls]                   = useState([''])
  const [showTextFallback, setShowTextFallback] = useState(false)
  const [pastedText, setPastedText]       = useState('')
  const [pdfStatus, setPdfStatus]         = useState('idle') // idle | extracting | done | error
  const [pdfError, setPdfError]           = useState('')
  const [status, setStatus]               = useState('idle') // idle | loading | success | error
  const [errorMessage, setErrorMessage]   = useState('')
  const [submittedCount, setSubmittedCount] = useState(0)
  const fileInputRef = useRef(null)

  const isConfigured = import.meta.env.VITE_GITHUB_TOKEN && import.meta.env.VITE_GITHUB_REPO
  const isMultiple   = urls.length > 1
  const filledUrls   = urls.filter(u => u.trim())
  const canSubmit    = filledUrls.length > 0 && status !== 'loading' && pdfStatus !== 'extracting'

  function updateUrl(index, value) {
    setUrls(prev => prev.map((u, i) => i === index ? value : u))
    if (status !== 'idle') setStatus('idle')
  }

  function addUrl() {
    setUrls(prev => [...prev, ''])
    // Hide text fallback when switching to multi-URL mode
    if (urls.length === 1) {
      setShowTextFallback(false)
      setPastedText('')
      setPdfStatus('idle')
    }
  }

  function removeUrl(index) {
    setUrls(prev => prev.filter((_, i) => i !== index))
  }

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
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return

    setStatus('loading')
    setErrorMessage('')

    const text = !isMultiple ? (pastedText.trim() || null) : null
    const entries = filledUrls.map((url, i) => ({
      url: url.trim(),
      text: i === 0 ? text : null,  // text/PDF only applies to first URL in single-URL mode
    }))

    try {
      await submitUrls(entries)
      setSubmittedCount(entries.length)
      setStatus('success')
      setUrls([''])
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
      <h1 className="text-2xl font-semibold text-stone-900 mb-2">Add articles</h1>
      <p className="text-sm text-stone-500 mb-8">
        Paste one or more URLs. Mycelium will fetch, read, and file them automatically.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Article URL{isMultiple ? 's' : ''}
          </label>

          <div className="space-y-2">
            {urls.map((url, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={e => updateUrl(index, e.target.value)}
                  placeholder="https://example.com/article"
                  className="flex-1 px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
                  disabled={status === 'loading'}
                  required={index === 0}
                />
                {urls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeUrl(index)}
                    disabled={status === 'loading'}
                    className="text-stone-300 hover:text-red-400 transition-colors shrink-0"
                    title="Remove"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addUrl}
            disabled={status === 'loading'}
            className="mt-2 text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            + Add another
          </button>
        </div>

        {/* Text/PDF fallback — only available for single URL */}
        {!isMultiple ? (
          <>
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
          </>
        ) : (
          <p className="text-xs text-stone-400">
            Text/PDF fallback is available for single-URL submissions.
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="px-5 py-2 bg-stone-800 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'loading'
            ? 'Submitting…'
            : filledUrls.length > 1
            ? `Submit ${filledUrls.length} articles`
            : 'Submit'}
        </button>
      </form>

      {status === 'success' && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-xl px-4 py-4">
          <p className="text-sm text-green-800 font-medium">
            {submittedCount === 1 ? 'Article queued.' : `${submittedCount} articles queued.`}
          </p>
          <p className="text-xs text-green-700 mt-1 leading-relaxed">
            GitHub Actions will process {submittedCount === 1 ? 'it' : 'them'} in a few minutes. Run{' '}
            <code className="bg-green-100 px-1 rounded font-mono">git pull</code>{' '}
            then restart the dev server to see {submittedCount === 1 ? 'it' : 'them'} appear in the Articles list.
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
