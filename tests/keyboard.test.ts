import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { DndContext } from '@dnd-kit/core'
import { describe, expect, it } from 'vitest'
import {
  buildSlotA11yLabel,
  buildSlotMatrix,
  createSchedulerA11yText,
  resolveNextSlotId,
} from '../src/keyboard'
import { SchedulerTimeGrid } from '../src/SchedulerGrid'
import type { Resource, SchedulerEvent, EventPlacement, Slot } from '../src/types'

const resources: Resource[] = [
  { id: 'room-a', label: 'Room A' },
  { id: 'room-b', label: 'Room B' },
]

const events: SchedulerEvent[] = [
  { id: 'event-a', durationMinutes: 60, label: 'Event A' },
]

const placements: Record<string, EventPlacement | null> = {
  'event-a': { eventId: 'event-a', resourceId: 'room-a', weekday: 1, startMinute: 540 },
}

const visibleColumns = [
  { weekday: 1, resourceId: 'room-a', dayLabel: 'Mon', resourceLabel: 'Room A' },
  { weekday: 1, resourceId: 'room-b', dayLabel: 'Mon', resourceLabel: 'Room B' },
]

const timeRows = [
  { startMinute: 540, endMinute: 570, label: '09:00-09:30' },
  { startMinute: 570, endMinute: 600, label: '09:30-10:00' },
]

const slotByGrid = new Map<string, Slot>([
  ['1-room-a-540', { id: 'slot-a', weekday: 1, resourceId: 'room-a', resourceLabel: 'Room A', startMinute: 540, endMinute: 570, dayLabel: 'Mon' }],
  ['1-room-b-540', { id: 'slot-b', weekday: 1, resourceId: 'room-b', resourceLabel: 'Room B', startMinute: 540, endMinute: 570, dayLabel: 'Mon' }],
  ['1-room-a-570', { id: 'slot-c', weekday: 1, resourceId: 'room-a', resourceLabel: 'Room A', startMinute: 570, endMinute: 600, dayLabel: 'Mon' }],
  ['1-room-b-570', { id: 'slot-d', weekday: 1, resourceId: 'room-b', resourceLabel: 'Room B', startMinute: 570, endMinute: 600, dayLabel: 'Mon' }],
])

describe('keyboard helpers', () => {
  it('builds slot matrices and resolves arrow-key navigation', () => {
    const matrix = buildSlotMatrix({ visibleColumns, timeRows, slotByGrid })

    expect(resolveNextSlotId({ matrix, currentSlotId: 'slot-a', key: 'ArrowRight' })).toBe('slot-b')
    expect(resolveNextSlotId({ matrix, currentSlotId: 'slot-a', key: 'ArrowDown' })).toBe('slot-c')
    expect(resolveNextSlotId({ matrix, currentSlotId: 'slot-d', key: 'Home' })).toBe('slot-c')
    expect(resolveNextSlotId({ matrix, currentSlotId: 'slot-b', key: 'End' })).toBe('slot-b')
  })

  it('builds generic slot labels for screen readers', () => {
    const slot = slotByGrid.get('1-room-a-540')
    expect(slot).toBeTruthy()
    expect(
      buildSlotA11yLabel({
        slot: slot as Slot,
        status: 'available',
        selected: false,
        occupied: true,
      }),
    ).toContain('occupied')
  })

  it('supports generic helper overrides for accessibility text', () => {
    const a11yText = createSchedulerA11yText('tr', {
      gridLabel: 'Planlama tablosu',
      gridInstructions: 'Ok tuşları ile gezin.',
    })

    expect(a11yText('gridLabel')).toBe('Planlama tablosu')
    expect(a11yText('gridInstructions')).toBe('Ok tuşları ile gezin.')
    expect(
      a11yText('slotLabel', {
        dayLabel: 'Pzt',
        resourceLabel: 'Oda A',
        range: '09:00-09:30',
        status: 'dolu',
      }),
    ).toContain('Hücre')
  })
})

describe('SchedulerTimeGrid keyboard surface', () => {
  it('renders the grid with focusable cells and generic aria labels', () => {
    const markup = renderToStaticMarkup(
      createElement(
        DndContext,
        null,
        createElement(SchedulerTimeGrid, {
          tx: (_tr, en) => en,
          visibleColumns,
          timeRows,
          slotByGrid,
          startCourseBySlot: new Map([[slotByGrid.get('1-room-a-540')!.id, events]]),
          occupyingCourseBySlot: new Map(),
          slotFeedbackById: new Map(),
          savedPlacements: placements,
          placements,
          selectedCourseId: null,
          isShiftPressed: false,
          showEmptyPlacementNotice: false,
          renderEventCard: (event: SchedulerEvent) => createElement('span', null, event.label),
          onSelectCourse: () => {},
          onRemoveCourse: () => {},
          onConvertSharedSlotToSwap: () => {},
          onRequireCourseSelection: () => {},
          onAttemptPlaceCourse: () => {},
        }),
      ),
    )

    expect(markup).toContain('role="grid"')
    expect(markup).toContain('role="gridcell"')
    expect(markup).toContain('tabindex="0"')
    expect(markup).toContain('Scheduler grid')
    expect(markup).toContain('Use arrow keys')
  })
})
