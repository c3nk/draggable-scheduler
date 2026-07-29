import { mkdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')
const source = resolve(root, 'src/style.css')
const destination = resolve(root, 'dist/style.css')

mkdirSync(dirname(destination), { recursive: true })
copyFileSync(source, destination)
