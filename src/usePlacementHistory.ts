import { useMemo, useState } from 'react'
import type { EventPlacement } from './types'
import { clonePlacements } from './SchedulerGrid'

export type PlacementMap = Record<string, EventPlacement | null>
export type PlacementMapUpdater = PlacementMap | ((current: PlacementMap) => PlacementMap)

export interface PlacementHistoryState {
  placements: PlacementMap
  history: PlacementMap[]
}

export function createPlacementHistory(initialPlacements: PlacementMap): PlacementHistoryState {
  return {
    placements: clonePlacements(initialPlacements),
    history: [],
  }
}

export function setPlacementHistory(
  state: PlacementHistoryState,
  nextPlacements: PlacementMap,
): PlacementHistoryState {
  return {
    placements: clonePlacements(nextPlacements),
    history: [...state.history, clonePlacements(state.placements)],
  }
}

export function undoPlacementHistory(state: PlacementHistoryState): PlacementHistoryState {
  const previous = state.history[state.history.length - 1]
  if (!previous) {
    return state
  }
  return {
    placements: clonePlacements(previous),
    history: state.history.slice(0, -1),
  }
}

export function clearPlacementHistory(state: PlacementHistoryState): PlacementHistoryState {
  return {
    placements: clonePlacements(state.placements),
    history: [],
  }
}

export function usePlacementHistory(initialPlacements: PlacementMap) {
  const [state, setState] = useState<PlacementHistoryState>(() => createPlacementHistory(initialPlacements))

  const api = useMemo(
    () => ({
      placements: state.placements,
      history: state.history,
      canUndo: state.history.length > 0,
      setPlacements: (nextPlacements: PlacementMapUpdater) => {
        setState((current) => {
          const resolvedNextPlacements =
            typeof nextPlacements === 'function'
              ? nextPlacements(current.placements)
              : nextPlacements
          return setPlacementHistory(current, resolvedNextPlacements)
        })
      },
      undo: () => {
        setState((current) => undoPlacementHistory(current))
      },
      reset: (nextPlacements: PlacementMap) => {
        setState(createPlacementHistory(nextPlacements))
      },
      clearHistory: () => {
        setState((current) => clearPlacementHistory(current))
      },
    }),
    [state],
  )

  return api
}
