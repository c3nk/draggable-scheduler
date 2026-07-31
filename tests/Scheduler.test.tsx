import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Scheduler, schedulerCollisionDetection } from '../src/Scheduler'
import type { EventPlacement, Resource, SchedulerConfig, SchedulerEvent } from '../src/types'

const resources: Resource[] = [
  { id: 'room-a', label: 'Room A' },
  { id: 'room-b', label: 'Room B' },
]

const events: SchedulerEvent[] = [
  { id: 'evt-1', durationMinutes: 60, label: 'Standup' },
]

const placements: Record<string, EventPlacement | null> = {
  'evt-1': { eventId: 'evt-1', resourceId: 'room-a', weekday: 1, startMinute: 9 * 60 },
}

const config: SchedulerConfig = {
  workDays: [1, 2, 3, 4, 5],
  weekStartDay: 1,
  workStartMinute: 9 * 60,
  workEndMinute: 11 * 60,
  slotStepMinutes: 30,
}

describe('Scheduler wrapper', () => {
  it('derives columns/rows and renders the grid with the bundled default card', () => {
    const markup = renderToStaticMarkup(
      createElement(Scheduler<SchedulerEvent>, {
        resources,
        events,
        placements,
        config,
        onEventMove: () => {},
      }),
    )

    expect(markup).toContain('role="grid"')
    // A derived column header (dayLabel • resourceLabel).
    expect(markup).toContain('Room A')
    // The placed event shows through the DefaultEventCard fallback.
    expect(markup).toContain('Standup')
    expect(markup).toContain('aria-label="Remove"')
  })

  it('only builds columns for configured work days', () => {
    const markup = renderToStaticMarkup(
      createElement(Scheduler<SchedulerEvent>, {
        resources,
        events,
        placements,
        config: { ...config, workDays: [1] },
        onEventMove: () => {},
      }),
    )
    // Monday present, Tuesday column absent.
    expect(markup).toContain('Mon')
    expect(markup).not.toContain('Tue')
  })
})

describe('schedulerCollisionDetection', () => {
  it('returns an array and does not throw with empty droppables', () => {
    const collisions = schedulerCollisionDetection({
      active: { id: 'evt-1', data: { current: {} }, rect: { current: { initial: null, translated: null } } },
      collisionRect: { top: 0, left: 0, right: 10, bottom: 10, width: 10, height: 10 },
      droppableRects: new Map(),
      droppableContainers: [],
      pointerCoordinates: null,
    } as never)
    expect(Array.isArray(collisions)).toBe(true)
    expect(collisions).toHaveLength(0)
  })
})
