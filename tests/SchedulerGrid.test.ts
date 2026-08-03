import { describe, expect, it } from 'vitest'
import {
  buildOccupyingIndex,
  buildOrderedWeekdays,
  buildSlots,
  buildStartIndex,
  clonePlacements,
  extractEventId,
  formatWeekday,
  isOverlap,
  isSamePlacement,
  resolveOverSlotId,
} from '../src/SchedulerGrid'
import type { EventPlacement, Resource, SchedulerEvent, Slot } from '../src/types'

type TestEvent = SchedulerEvent<{ kind: string }>

const resources: Resource[] = [
  { id: 'room-a', label: 'Room A' },
  { id: 'room-b', label: 'Room B' },
]

const events: TestEvent[] = [
  { id: 'event-a', durationMinutes: 60, label: 'Morning talk', data: { kind: 'talk' } },
  { id: 'event-b', durationMinutes: 90, label: 'Long workshop', data: { kind: 'workshop' } },
  { id: 'event-c', durationMinutes: 30, label: 'Short check-in', data: { kind: 'checkin' } },
]

const placements: Record<string, EventPlacement | null> = {
  'event-a': { eventId: 'event-a', resourceId: 'room-a', weekday: 1, startMinute: 9 * 60 },
  'event-b': { eventId: 'event-b', resourceId: 'room-a', weekday: 1, startMinute: 9 * 60 + 30 },
  'event-c': null,
}

const config = {
  workDays: [1, 2, 3, 4, 5],
  weekStartDay: 1,
  workStartMinute: 9 * 60,
  workEndMinute: 12 * 60,
  slotStepMinutes: 30,
}

function buildSlotMaps(slots: Slot[]) {
  return {
    slotById: new Map(slots.map((slot) => [slot.id, slot] as const)),
    slotByGrid: new Map(slots.map((slot) => [`${slot.weekday}-${slot.resourceId}-${slot.startMinute}`, slot] as const)),
  }
}

describe('formatting helpers', () => {
  it('formats weekdays in English and Turkish', () => {
    expect(formatWeekday(1, 'en')).toBe('Mon')
    expect(formatWeekday(3, 'tr')).toBe('Çar')
  })

  it('orders weekdays from the configured week start', () => {
    expect(buildOrderedWeekdays(1)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(buildOrderedWeekdays(0)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
})

describe('geometry helpers', () => {
  it('detects overlap boundaries correctly', () => {
    expect(isOverlap(10, 20, 15, 25)).toBe(true)
    expect(isOverlap(10, 20, 20, 30)).toBe(false)
    expect(isOverlap(10, 20, 0, 10)).toBe(false)
  })

  it('clones placements without sharing references', () => {
    const cloned = clonePlacements(placements)
    expect(cloned).toEqual(placements)
    expect(cloned).not.toBe(placements)
    expect(cloned['event-a']).not.toBe(placements['event-a'])
  })

  it('compares placements by weekday, resource, and start minute', () => {
    expect(isSamePlacement(placements['event-a'], { ...placements['event-a']! })).toBe(true)
    expect(isSamePlacement(placements['event-a'], placements['event-b'])).toBe(false)
    expect(isSamePlacement(null, null)).toBe(true)
  })
})

describe('slot indexes', () => {
  it('builds slots for every weekday/resource/time bucket', () => {
    const slots = buildSlots({
      config,
      resources,
      locale: 'en',
    })

    expect(slots).toHaveLength(7 * resources.length * 6)
    expect(slots[0]).toMatchObject({
      id: 'slot-0-room-a-540',
      weekday: 0,
      resourceId: 'room-a',
      resourceLabel: 'Room A',
      startMinute: 540,
      endMinute: 570,
      dayLabel: 'Sun',
    })
  })

  it('builds start and occupying slot indexes from placements', () => {
    const slots = buildSlots({
      config,
      resources,
      locale: 'en',
    })
    const startIndex = buildStartIndex({ events, placements, slots })
    const occupyingIndex = buildOccupyingIndex({ events, placements, slots })

    expect(startIndex.get('slot-1-room-a-540')?.map((event) => event.id)).toEqual(['event-a'])
    expect(startIndex.get('slot-1-room-a-570')?.map((event) => event.id)).toEqual(['event-b'])
    expect(occupyingIndex.get('slot-1-room-a-570')?.map((event) => event.id)).toEqual(['event-a'])
  })
})

describe('drag target resolution', () => {
  it('resolves slot ids from direct ids, dragged data, and placement fallback', () => {
    const slots = buildSlots({
      config,
      resources,
      locale: 'en',
    })
    const { slotById, slotByGrid } = buildSlotMaps(slots)

    expect(
      resolveOverSlotId({
        over: { id: 'slot-1-room-a-540', data: { current: {} } } as never,
        slotById,
        slotByGrid,
        placements,
      }),
    ).toBe('slot-1-room-a-540')

    expect(
      resolveOverSlotId({
        over: { id: 'anything', data: { current: { slotId: 'slot-1-room-a-570' } } } as never,
        slotById,
        slotByGrid,
        placements,
      }),
    ).toBe('slot-1-room-a-570')

    expect(
      resolveOverSlotId({
        over: { id: 'event-a', data: { current: { eventId: 'event-a' } } } as never,
        slotById,
        slotByGrid,
        placements,
      }),
    ).toBe('slot-1-room-a-540')
  })

  it('extracts event ids from dnd-kit drag events', () => {
    expect(
      extractEventId({
        active: { data: { current: { eventId: 'event-a' } } },
      } as never),
    ).toBe('event-a')
  })
})
