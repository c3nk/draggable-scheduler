// Bundles examples/standalone/main.tsx (the REAL package demo) into a single,
// self-contained examples/standalone-demo.html — React, react-dom and @dnd-kit
// inlined, plus the bundled stylesheet. No network, no build step for the viewer.
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const result = await build({
  entryPoints: [resolve(root, 'examples/standalone/main.tsx')],
  bundle: true,
  format: 'iife',
  jsx: 'automatic',
  minify: true,
  write: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
})
const js = result.outputFiles[0].text
const css = readFileSync(resolve(root, 'src/style.css'), 'utf8')

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>draggable-scheduler preview</title>
    <style>
* { box-sizing: border-box; }
body { margin: 0; }
${css}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>${js}</script>
  </body>
</html>
`

writeFileSync(resolve(root, 'examples/standalone-demo.html'), html)
console.log(`✓ standalone-demo.html rebuilt (${(html.length / 1024).toFixed(0)} KB, self-contained)`)
