/**
 * Watches for remote changes and pulls every 5 minutes.
 * Run alongside `npm run dev` in a separate terminal: npm run watch
 * Vite detects the changed JSON files and auto-reloads the browser.
 */

import { execSync } from 'child_process'

const INTERVAL_MS = 5 * 60 * 1000

function pull() {
  try {
    const out = execSync('git pull', { encoding: 'utf8' }).trim()
    if (out && out !== 'Already up to date.') {
      console.log(`[${new Date().toLocaleTimeString()}] ${out}`)
    }
  } catch (e) {
    console.error(`[${new Date().toLocaleTimeString()}] git pull failed:`, e.message)
  }
}

console.log('Watching for remote changes every 5 min. Press Ctrl+C to stop.')
pull()
setInterval(pull, INTERVAL_MS)
