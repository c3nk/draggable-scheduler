import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PresetToolbar, type Preset } from '../src/PresetToolbar'

type ToolbarState = {
  view: string
}

const presets: Preset<ToolbarState>[] = [
  { id: 'all', label: 'All', state: { view: 'all' }, description: 'Show everything' },
  { id: 'today', label: 'Today', state: { view: 'today' }, description: 'Show today only' },
]

const tx = (_tr: string, en: string) => en

describe('PresetToolbar', () => {
  it('renders preset buttons and highlights the active preset', () => {
    const markup = renderToStaticMarkup(
      <PresetToolbar
        tx={tx}
        presets={presets}
        activePresetId="today"
        onPresetSelect={() => {}}
      />,
    )

    expect(markup).toContain('Presets')
    expect(markup).toContain('All')
    expect(markup).toContain('Today')
    expect(markup).toContain('Show today only')
    expect(markup).toContain('border-blue-500')
  })

  it('renders the empty state and optional clear button', () => {
    const markup = renderToStaticMarkup(
      <PresetToolbar
        tx={tx}
        presets={[]}
        activePresetId={null}
        onPresetSelect={() => {}}
        onClearSelection={() => {}}
      />,
    )

    expect(markup).toContain('No presets available yet.')
    expect(markup).toContain('Clear')
  })
})
