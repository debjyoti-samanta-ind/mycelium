const REPO = import.meta.env.VITE_GITHUB_REPO
const TOKEN = import.meta.env.VITE_GITHUB_TOKEN

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

async function getFile(path) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    { headers: GITHUB_HEADERS }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Failed to read ${path} (${res.status})`)
  }
  const data = await res.json()
  return { parsed: JSON.parse(fromBase64(data.content)), sha: data.sha }
}

async function putFile(path, sha, content, message) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: { ...GITHUB_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content: toBase64(JSON.stringify(content, null, 2)),
        sha,
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Failed to write ${path} (${res.status})`)
  }
  return res.json()
}

async function deleteFileOnGitHub(path, sha, message) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    {
      method: 'DELETE',
      headers: { ...GITHUB_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sha }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Failed to delete ${path} (${res.status})`)
  }
  return res.json()
}

export async function submitUrl(url, pastedText = null) {
  if (!TOKEN || !REPO) {
    throw new Error('GitHub credentials not configured. See README.md for setup instructions.')
  }

  // Step 1: Read current queue.json to get content + SHA
  const getRes = await fetch(
    `https://api.github.com/repos/${REPO}/contents/data/queue.json`,
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
    `https://api.github.com/repos/${REPO}/contents/data/queue.json`,
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

export async function deleteArticle(slug, url) {
  if (!TOKEN || !REPO) {
    throw new Error('GitHub credentials not configured.')
  }

  // 1. Update graph.json — remove node and all connected edges
  const { parsed: graph, sha: graphSha } = await getFile('data/graph.json')
  graph.nodes = graph.nodes.filter(n => n.id !== slug)
  graph.edges = graph.edges.filter(e => e.source !== slug && e.target !== slug)
  await putFile('data/graph.json', graphSha, graph, `chore: remove article ${slug} [skip ci]`)

  // 2. Delete the article JSON file
  const { sha: articleSha } = await getFile(`data/articles/${slug}.json`)
  await deleteFileOnGitHub(`data/articles/${slug}.json`, articleSha, `chore: delete article ${slug} [skip ci]`)

  // 3. Remove URL from queue.json so it won't be re-ingested
  const { parsed: queue, sha: queueSha } = await getFile('data/queue.json')
  queue.urls = queue.urls.filter(e => {
    const entryUrl = typeof e === 'string' ? e : e.url
    return entryUrl !== url
  })
  await putFile('data/queue.json', queueSha, queue, `chore: remove deleted article from queue [skip ci]`)
}

export async function deleteDigest(month) {
  if (!TOKEN || !REPO) {
    throw new Error('GitHub credentials not configured.')
  }
  const { sha } = await getFile(`data/digests/${month}.json`)
  await deleteFileOnGitHub(
    `data/digests/${month}.json`,
    sha,
    `chore: delete digest ${month} [skip ci]`
  )
}

export async function dismissFailed(url) {
  if (!TOKEN || !REPO) {
    throw new Error('GitHub credentials not configured.')
  }

  // 1. Remove from queue_failed.json
  const { parsed: failedData, sha: failedSha } = await getFile('data/queue_failed.json')
  failedData.failed = failedData.failed.filter(e => e.url !== url)
  await putFile('data/queue_failed.json', failedSha, failedData, `chore: dismiss failed article [skip ci]`)

  // 2. Remove from queue.json so the ingest workflow won't retry it
  const { parsed: queue, sha: queueSha } = await getFile('data/queue.json')
  queue.urls = queue.urls.filter(e => {
    const entryUrl = typeof e === 'string' ? e : e.url
    return entryUrl !== url
  })
  await putFile('data/queue.json', queueSha, queue, `chore: remove dismissed url from queue [skip ci]`)
}
