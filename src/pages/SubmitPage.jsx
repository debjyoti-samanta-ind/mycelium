import { useState, useRef } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { submitUrls } from '../utils/github.js'

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

// ── Icons ─────────────────────────────────────────────────────────────────────
function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

function IconChevron({ open }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}

function IconLink() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  )
}

export default function SubmitPage() {
  const [urls, setUrls]                         = useState([''])
  const [showTextFallback, setShowTextFallback] = useState(false)
  const [pastedText, setPastedText]             = useState('')
  const [pdfStatus, setPdfStatus]               = useState('idle')
  const [pdfError, setPdfError]                 = useState('')
  const [status, setStatus]                     = useState('idle')
  const [errorMessage, setErrorMessage]         = useState('')
  const [submittedCount, setSubmittedCount]     = useState(0)
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
      if (!text) throw new Error('No text found — this may be a scanned PDF. Try copying the text manually.')
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
      text: i === 0 ? text : null,
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

  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

  if (!isConfigured) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <div className="card-3d p-6">
          {isDemoMode ? (
            <>
              <h2 className="text-base font-semibold text-stone-900 mb-2">Read-only demo</h2>
              <p className="text-sm text-stone-600 leading-relaxed">
                This is a live read-only instance of my personal knowledge graph.
                Article submission is disabled here.{' '}
                <a
                  href="https://github.com/debjyoti-samanta-ind/mycelium"
                  className="underline text-stone-700 hover:text-stone-900"
                  target="_blank" rel="noreferrer"
                >
                  Fork the repo
                </a>{' '}
                to run your own.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-stone-900 mb-2">One-time setup needed</h2>
              <p className="text-sm text-stone-600 leading-relaxed">
                Create a{' '}
                <code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs font-mono">.env.local</code>{' '}
                file in the project root with your GitHub token. See{' '}
                <strong>README.md</strong> for step-by-step instructions.
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  const submitLabel = status === 'loading'
    ? 'Submitting…'
    : filledUrls.length > 1
    ? `Submit ${filledUrls.length} articles`
    : 'Submit'

  return (
    <div className="max-w-2xl mx-auto">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="serif text-4xl font-bold text-stone-900 leading-tight mb-2">
          Add an article
        </h1>
        <p className="text-stone-500 text-[15px] leading-relaxed">
          Paste a URL and Mycelium will fetch, read, and file it — then find
          how it connects to everything you've already read.
        </p>
      </div>

      {/* Main card */}
      <div className="card-3d">

        {/* URL section */}
        <div className="p-7">
          <label className="block text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">
            Article URL{isMultiple ? 's' : ''}
          </label>

          <div className="space-y-2.5">
            {urls.map((url, index) => (
              <div key={index} className="flex items-center gap-2.5">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-300 pointer-events-none">
                    <IconLink />
                  </span>
                  <input
                    type="url"
                    value={url}
                    onChange={e => updateUrl(index, e.target.value)}
                    placeholder="https://example.com/article"
                    className="w-full pl-9 pr-4 py-3 text-[15px] border border-stone-200 rounded-xl
                               focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent
                               bg-stone-50 placeholder-stone-300 text-stone-900 transition-shadow"
                    disabled={status === 'loading'}
                    required={index === 0}
                  />
                </div>
                {urls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeUrl(index)}
                    disabled={status === 'loading'}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-300
                               hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
                    title="Remove"
                  >
                    <IconX />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addUrl}
            disabled={status === 'loading'}
            className="mt-3 flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add another URL
          </button>
        </div>

        {/* Text / PDF fallback — divider + collapsible drawer */}
        {!isMultiple ? (
          <div className="border-t border-stone-100">
            <button
              type="button"
              onClick={() => setShowTextFallback(v => !v)}
              className="w-full flex items-center justify-between px-7 py-3.5 text-left
                         text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-50
                         transition-colors"
            >
              <span>Paywalled or fetch failed? Paste text or upload a PDF</span>
              <IconChevron open={showTextFallback} />
            </button>

            {showTextFallback && (
              <div className="px-7 pb-6 space-y-3 border-t border-stone-100">
                <div className="flex items-center justify-between pt-4">
                  <label htmlFor="pastedText"
                    className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                    Article text
                    <span className="normal-case font-normal tracking-normal ml-1.5 text-stone-400">
                      (overrides URL fetch)
                    </span>
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
                      className={`text-xs px-3 py-1.5 rounded-lg border cursor-pointer transition-colors font-medium ${
                        pdfStatus === 'extracting'
                          ? 'bg-stone-50 text-stone-400 border-stone-200 cursor-wait'
                          : pdfStatus === 'done'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-white text-stone-600 border-stone-300 hover:border-stone-400'
                      }`}
                    >
                      {pdfStatus === 'extracting' ? 'Extracting…' : pdfStatus === 'done' ? 'PDF extracted ✓' : 'Upload PDF'}
                    </label>
                  </div>
                </div>

                {pdfStatus === 'error' && (
                  <p className="text-xs text-red-500">{pdfError}</p>
                )}

                <textarea
                  id="pastedText"
                  value={pastedText}
                  onChange={e => {
                    setPastedText(e.target.value)
                    if (pdfStatus === 'done') setPdfStatus('idle')
                  }}
                  placeholder="Paste the full article text here, or upload a PDF above to populate it automatically…"
                  rows={8}
                  className="w-full px-3.5 py-3 text-sm border border-stone-200 rounded-xl
                             focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent
                             bg-stone-50 resize-y font-mono leading-relaxed text-stone-700
                             placeholder-stone-300 transition-shadow"
                  disabled={status === 'loading' || pdfStatus === 'extracting'}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="border-t border-stone-100 px-7 py-3.5">
            <p className="text-xs text-stone-400">
              Text/PDF fallback is available for single-URL submissions.
            </p>
          </div>
        )}

        {/* Submit */}
        <div className="border-t border-stone-100 px-7 py-5">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 bg-stone-900 text-white text-sm font-semibold rounded-xl
                       hover:bg-stone-800 disabled:opacity-35 disabled:cursor-not-allowed
                       transition-colors tracking-wide"
          >
            {submitLabel}
          </button>
        </div>
      </div>

      {/* Status messages */}
      {status === 'success' && (
        <div className="mt-5 card-3d p-5 border-l-4 border-green-400">
          <p className="text-sm font-semibold text-stone-900 mb-1">
            {submittedCount === 1 ? 'Article queued.' : `${submittedCount} articles queued.`}
          </p>
          <p className="text-xs text-stone-500 leading-relaxed">
            GitHub Actions will process {submittedCount === 1 ? 'it' : 'them'} in a few minutes.
            Run{' '}
            <code className="bg-stone-100 px-1 py-0.5 rounded font-mono">git pull</code>{' '}
            then restart the dev server to see {submittedCount === 1 ? 'it' : 'them'} in the Articles list.
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-5 card-3d p-5 border-l-4 border-red-400">
          <p className="text-sm font-semibold text-stone-900 mb-1">Submission failed.</p>
          <p className="text-xs text-stone-500">{errorMessage}</p>
        </div>
      )}

    </div>
  )
}
