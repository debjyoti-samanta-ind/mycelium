const REPO = import.meta.env.VITE_GITHUB_REPO
const TOKEN = import.meta.env.VITE_GITHUB_TOKEN
const QUEUE_PATH = 'data/queue.json'

const GITHUB_HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
}

// Safely encode a string to base64, handling Unicode characters
function toBase64(str) {
  return btoa(unescape(encodeURIComponent(str)))
}

// Safely decode base64 to string, handling Unicode characters
function fromBase64(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))))
}

export async function submitUrl(url, pastedText = null) {
  if (!TOKEN || !REPO) {
    throw new Error('GitHub credentials not configured. See README.md for setup instructions.')
  }

  // Step 1: Read current queue.json to get content + SHA
  const getRes = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${QUEUE_PATH}`,
    { headers: GITHUB_HEADERS }
  )
  if (!getRes.ok) {
    const err = await getRes.json().catch(() => ({}))
    throw new Error(
      err.message ||
      `Could not read queue from GitHub (${getRes.status}). Check your token and repo name in .env.local.`
    )
  }

  const { content, sha } = await getRes.json()
  const current = JSON.parse(fromBase64(content))

  // Step 2: Append new entry
  const entry = {
    url,
    added_at: new Date().toISOString(),
    text: pastedText || null,
  }
  current.urls.push(entry)

  // Step 3: Write updated queue.json back
  const putRes = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${QUEUE_PATH}`,
    {
      method: 'PUT',
      headers: { ...GITHUB_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'queue: add article',
        content: toBase64(JSON.stringify(current, null, 2)),
        sha,
      }),
    }
  )

  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}))
    throw new Error(err.message || `Failed to update queue (${putRes.status}).`)
  }

  return putRes.json()
}
