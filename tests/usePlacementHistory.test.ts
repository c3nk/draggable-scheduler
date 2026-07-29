import { describe, expect, it } from 'vitest'
import {
  clearPlacementHistory,
  createPlacementHistory,
  setPlacementHistory,
  undoPlacementHistory,
} from '../src/usePlacementHistory'
import type { EventPlacement } from '../src/types'

const initialPlacements: Record<string, EventPlacement | null> = {
  a: { eventId: 'a', resourceId: 'room-1', weekday: 1, startMinute: 540 },
  b: null,
}

describe('usePlacementHistory helpers', () => {
  it('creates an isolated history state', () => {
    const state = createPlacementHistory(initialPlacements)

    expect(state.placements).toEqual(initialPlacements)
    expect(state.placements).not.toBe(initialPlacements)
    expect(state.history).toEqual([])
  })

  it('pushes snapshots when placements change', () => {
    const state = createPlacementHistory(initialPlacements)
    const nextPlacements = {
      ...initialPlacements,
      a: { eventId: 'a', resourceId: 'room-2', weekday: 2, startMinute: 600 },
    }

    const updated = setPlacementHistory(state, nextPlacements)

    expect(updated.placements).toEqual(nextPlacements)
    expect(updated.history).toHaveLength(1)
    expect(updated.history[0]).toEqual(initialPlacements)
    expect(updated.history[0]).not.toBe(initialPlacements)
  })

  it('restores the previous snapshot on undo', () => {
    const state = createPlacementHistory(initialPlacements)
    const updated = setPlacementHistory(state, {
      ...initialPlacements,
      a: { eventId: 'a', resourceId: 'room-2', weekday: 2, startMinute: 600 },
    })

    const undone = undoPlacementHistory(updated)

    expect(undone.placements).toEqual(initialPlacements)
    expect(undone.history).toEqual([])
  })

  it('clears history without changing the current placements', () => {
    const state = createPlacementHistory(initialPlacements)
    const updated = setPlacementHistory(state, {
      ...initialPlacements,
      a: { eventId: 'a', resourceId: 'room-2', weekday: 2, startMinute: 600 },
    })

    const cleared = clearPlacementHistory(updated)

    expect(cleared.placements).toEqual(updated.placements)
    expect(cleared.history).toEqual([])
  })
})
