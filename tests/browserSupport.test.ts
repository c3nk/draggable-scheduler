import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BROWSER_SUPPORT_SUMMARY,
  SUPPORTED_BROWSER_TARGETS,
} from '../src/browserSupport'

describe('browser support policy', () => {
  it('documents a stable evergreen browser matrix', () => {
    expect(SUPPORTED_BROWSER_TARGETS).toEqual([
      'last 2 Chrome versions',
      'last 2 Edge versions',
      'last 2 Firefox versions',
      'last 2 Safari versions',
      'last 2 iOS Safari versions',
    ])
    expect(BROWSER_SUPPORT_SUMMARY).toContain('latest two stable versions')
  })

  it('matches the package.json browserslist metadata', () => {
    const packageJsonPath = resolve(process.cwd(), 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      browserslist?: string[]
    }

    expect(packageJson.browserslist).toEqual([...SUPPORTED_BROWSER_TARGETS])
  })
})
