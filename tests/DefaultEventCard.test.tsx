import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DndContext } from '@dnd-kit/core'
import { describe, expect, it } from 'vitest'
import { DefaultEventCard, formatDurationLabel } from '../src/DefaultEventCard'
import type { SchedulerEvent } from '../src/types'

type DemoEvent = SchedulerEvent<{ instructor: string }>

const event: DemoEvent = { id: 'evt-1', durationMinutes: 90, label: 'Workshop', data: { instructor: 'Alice' } }

function render(node: Parameters<typeof renderToStaticMarkup>[0]) {
  return renderToStaticMarkup(createElement(DndContext, null, node))
}

describe('formatDurationLabel', () => {
  it('formats minutes, hours, and combined durations per locale', () => {
    const tr = (turkish: string, _en: string) => turkish
    const en = (_tr: string, english: string) => english
    expect(formatDurationLabel(30, en)).toBe('30 min')
    expect(formatDurationLabel(60, en)).toBe('1 h')
    expect(formatDurationLabel(90, en)).toBe('1 h 30 min')
    expect(formatDurationLabel(90, tr)).toBe('1 sa 30 dk')
    expect(formatDurationLabel(0, en)).toBe('')
  })
})

describe('DefaultEventCard', () => {
  it('renders the drag handle, remove button, duration badge, and domain children', () => {
    const markup = render(
      createElement(DefaultEventCard<DemoEvent>, {
        event,
        selected: false,
        tx: (_tr, en) => en,
        onSelect: () => {},
        onRemove: () => {},
        children: createElement('span', null, event.data?.instructor),
      }),
    )

    expect(markup).toContain('aria-label="Move"')
    expect(markup).toContain('aria-label="Remove"')
    expect(markup).toContain('1 h 30 min')
    expect(markup).toContain('Alice')
    expect(markup).toContain('scheduler-event-card')
  })

  it('omits the remove button when no onRemove is given', () => {
    const markup = render(
      createElement(DefaultEventCard<DemoEvent>, { event, tx: (_tr, en) => en }),
    )
    expect(markup).not.toContain('aria-label="Remove"')
    // Falls back to the event label when no children are supplied.
    expect(markup).toContain('Workshop')
  })

  it('renders a static (non-draggable) card without a DndContext', () => {
    const markup = renderToStaticMarkup(
      createElement(DefaultEventCard<DemoEvent>, {
        event,
        draggable: false,
        showDragHandle: true,
        tx: (_tr, en) => en,
      }),
    )
    // draggable=false suppresses the drag handle affordance entirely.
    expect(markup).not.toContain('aria-label="Move"')
    expect(markup).toContain('Workshop')
  })
})
