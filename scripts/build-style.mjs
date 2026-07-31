import { mkdirSync, copyFileSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')
const source = resolve(root, 'src/style.css')
const destination = resolve(root, 'dist/style.css')

// ---------------------------------------------------------------------------
// Drift guard: every utility class the shipped components render must exist in
// src/style.css, otherwise a consumer who imports the bundled stylesheet (and
// does not run Tailwind themselves) silently gets an unstyled element. The
// stylesheet is hand-maintained, so without this check missing classes are
// invisible until shipped. Fail the build if any used class is undefined.
// ---------------------------------------------------------------------------

const css = readFileSync(source, 'utf8')

// Non-utility semantic hook classes intentionally left unstyled (host targets).
const ALLOWLIST = new Set(['scheduler-event-card', 'scheduler-drag-handle', 'scheduler-remove-button'])

function isUtilityToken(token) {
  if (ALLOWLIST.has(token)) return false
  // A utility either has a Tailwind separator or is one of the known bare words.
  if (/[-:[/]/.test(token)) return true
  return ['flex', 'grid', 'border', 'sticky', 'rounded', 'transition', 'relative', 'absolute', 'block', 'hidden', 'italic', 'shrink-0'].includes(token)
}

function tailwindEscape(token) {
  return token.replace(/[.:/[\]%#]/g, (char) => `\\${char}`)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isDefined(token) {
  const selector = `.${tailwindEscape(token)}`
  const pattern = new RegExp(`${escapeRegExp(selector)}(?=[\\s,{>:.]|$)`, 'm')
  return pattern.test(css)
}

// Pull the balanced `className={ ... }` expressions and `className="..."` from a file.
function extractClassChunks(text) {
  const chunks = []
  const marker = 'className='
  let index = text.indexOf(marker)
  while (index !== -1) {
    let cursor = index + marker.length
    if (text[cursor] === '{') {
      let depth = 0
      const start = cursor
      for (; cursor < text.length; cursor += 1) {
        if (text[cursor] === '{') depth += 1
        else if (text[cursor] === '}') {
          depth -= 1
          if (depth === 0) break
        }
      }
      chunks.push(text.slice(start + 1, cursor))
    } else if (text[cursor] === '"' || text[cursor] === "'") {
      const quote = text[cursor]
      const end = text.indexOf(quote, cursor + 1)
      if (end !== -1) chunks.push(text.slice(cursor + 1, end))
    }
    index = text.indexOf(marker, cursor)
  }
  return chunks
}

function collectTokens(chunk) {
  const tokens = new Set()
  const literals = chunk.match(/`[^`]*`|'[^']*'|"[^"]*"/g) ?? []
  for (const literal of literals) {
    const body = literal.slice(1, -1).replace(/\$\{[^}]*\}/g, ' ')
    for (const token of body.split(/\s+/)) {
      if (token && !token.includes('$') && !token.includes('{') && isUtilityToken(token)) tokens.add(token)
    }
  }
  return tokens
}

const componentFiles = readdirSync(resolve(root, 'src'))
  .filter((file) => file.endsWith('.tsx'))
  .map((file) => resolve(root, 'src', file))

const missing = new Map()
for (const file of componentFiles) {
  const text = readFileSync(file, 'utf8')
  for (const chunk of extractClassChunks(text)) {
    for (const token of collectTokens(chunk)) {
      if (!isDefined(token)) {
        const owners = missing.get(token) ?? new Set()
        owners.add(file.replace(`${root}/`, ''))
        missing.set(token, owners)
      }
    }
  }
}

if (missing.size > 0) {
  console.error('\n✗ style.css is missing utility classes used by components:')
  for (const [token, owners] of missing) {
    console.error(`  - ${token}  (used in ${[...owners].join(', ')})`)
  }
  console.error('\nAdd them to src/style.css so consumers of the bundled stylesheet render correctly.\n')
  process.exit(1)
}

mkdirSync(dirname(destination), { recursive: true })
copyFileSync(source, destination)
console.log(`✓ style.css verified (${componentFiles.length} components) and copied to dist/`)
