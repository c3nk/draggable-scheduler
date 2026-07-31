// draggable-scheduler — <Scheduler>: the batteries-included wrapper.
//
// SchedulerTimeGrid is the low-level, host-owns-everything grid: you bring your
// own DndContext, sensors, collision detection and drag-end resolution. That is
// the right layer when you need full control (a tuned collision strategy, async
// rule engines, swap/unassign workflows).
//
// <Scheduler> is the easy layer on top: give it resources, events, placements
// and a config, and it owns the DndContext, the sensors, the (3-tier) collision
// detection and the drag-end → slot resolution for you. You wire your business
// rules through callbacks:
//
//   - onBeforeMove(eventId, target) → DropEvaluation | Promise<DropEvaluation>
//       optional validation. Return `{ allowed: false, message }` to reject a
//       drop; the package never decides *why* a move is (dis)allowed.
//   - onEventMove(eventId, target)   apply an accepted move (persist it).
//   - onEventRemove(eventId)         optional removal.
//   - onConvertSharedSlotToSwap(ids) optional: the host completes the swap.
//
// It still renders the same SchedulerTimeGrid underneath and forwards
// renderEventCard/renderOccupyingEvent, so the default card (and everything
// else) works identically — this wrapper only removes the dnd-kit boilerplate.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core'
import type {
  EventPlacement,
  Resource,
  SchedulerConfig,
  SchedulerEvent,
  SlotStatus,
  SchedulerA11yText,
} from './types'
import {
  SchedulerTimeGrid,
  buildOccupyingIndex,
  buildOrderedWeekdays,
  buildSlots,
  buildStartIndex,
  extractEventId,
  formatWeekday,
  resolveOverSlotId,
  type RenderEventCardContext,
  type SchedulerSlotFeedback,
  type SchedulerTimeGridColumn,
  type SchedulerTimeGridRow,
} from './SchedulerGrid'
import { formatTimeOfDay } from './keyboard'

/** The slot a drag/click resolved to, in both id and coordinate form. */
export interface DropTarget {
  slotId: string
  resourceId: string
  weekday: number
  startMinute: number
}

/** Host verdict for a proposed move. `allowed: false` cancels the move. */
export interface DropEvaluation {
  allowed: boolean
  status?: SlotStatus
  message?: string
}

/**
 * The same 3-tier collision strategy the original production grid used:
 * pointer-within first (most intuitive while dragging), then rectangle
 * intersection, then nearest-center as a last resort. Exported so low-level
 * (SchedulerTimeGrid + your own DndContext) consumers can reuse it.
 */
export const schedulerCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) return pointerCollisions
  const rectCollisions = rectIntersection(args)
  if (rectCollisions.length > 0) return rectCollisions
  return closestCenter(args)
}

export interface SchedulerProps<TEvent extends SchedulerEvent<unknown>> {
  resources: Resource<unknown>[]
  events: TEvent[]
  placements: Record<string, EventPlacement | null>
  config: SchedulerConfig
  locale?: 'tr' | 'en'
  timeFormat?: '12h' | '24h'
  tx?: (tr: string, en: string) => string
  a11yText?: SchedulerA11yText

  selectedEventId?: string | null
  onSelectEvent?: (eventId: string | null) => void

  /** Optional validation run before a move is applied (drag or click/keyboard). */
  onBeforeMove?: (eventId: string, target: DropTarget) => DropEvaluation | Promise<DropEvaluation>
  /** Apply an accepted move. This is where the host persists the new placement. */
  onEventMove: (eventId: string, target: DropTarget) => void
  onEventRemove?: (eventId: string) => void
  onConvertSharedSlotToSwap?: (eventIds: string[]) => void

  /** Precomputed per-slot conflict/warning coloring, keyed by slot id. */
  slotFeedbackById?: Map<string, SchedulerSlotFeedback>
  savedPlacements?: Record<string, EventPlacement | null>
  showEmptyPlacementNotice?: boolean

  renderEventCard?: (event: TEvent, context: RenderEventCardContext) => ReactNode
  renderOccupyingEvent?: (event: TEvent) => ReactNode
}

export function Scheduler<TEvent extends SchedulerEvent<unknown>>({
  resources,
  events,
  placements,
  config,
  locale = 'en',
  timeFormat = '24h',
  tx = (_tr, en) => en,
  a11yText,
  selectedEventId = null,
  onSelectEvent,
  onBeforeMove,
  onEventMove,
  onEventRemove,
  onConvertSharedSlotToSwap,
  slotFeedbackById,
  savedPlacements,
  showEmptyPlacementNotice = false,
  renderEventCard,
  renderOccupyingEvent,
}: SchedulerProps<TEvent>) {
  // A small activation distance so a plain click selects (and the remove button
  // works) instead of being swallowed as the start of a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  )
  const [isShiftPressed, setIsShiftPressed] = useState(false)

  useEffect(() => {
    const onKey = (nativeEvent: KeyboardEvent) => setIsShiftPressed(nativeEvent.shiftKey)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [])

  const slots = useMemo(
    () => buildSlots({ config, resources, locale }),
    [config, resources, locale],
  )
  const slotById = useMemo(() => new Map(slots.map((slot) => [slot.id, slot] as const)), [slots])
  const slotByGrid = useMemo(
    () => new Map(slots.map((slot) => [`${slot.weekday}-${slot.resourceId}-${slot.startMinute}`, slot] as const)),
    [slots],
  )
  const startEventBySlot = useMemo(
    () => buildStartIndex({ events, placements, slots }),
    [events, placements, slots],
  )
  const occupyingEventBySlot = useMemo(
    () => buildOccupyingIndex({ events, placements, slots }),
    [events, placements, slots],
  )

  const visibleColumns = useMemo<SchedulerTimeGridColumn[]>(
    () =>
      buildOrderedWeekdays(config.weekStartDay)
        .filter((weekday) => config.workDays.includes(weekday))
        .flatMap((weekday) =>
          resources.map((resource) => ({
            weekday,
            resourceId: resource.id,
            dayLabel: formatWeekday(weekday, locale),
            resourceLabel: resource.label,
          })),
        ),
    [config.weekStartDay, config.workDays, locale, resources],
  )

  const timeRows = useMemo<SchedulerTimeGridRow[]>(() => {
    const rows: SchedulerTimeGridRow[] = []
    for (let minute = config.workStartMinute; minute < config.workEndMinute; minute += config.slotStepMinutes) {
      const endMinute = minute + config.slotStepMinutes
      rows.push({
        startMinute: minute,
        endMinute,
        label: `${formatTimeOfDay(minute, timeFormat)}-${formatTimeOfDay(endMinute, timeFormat)}`,
      })
    }
    return rows
  }, [config.slotStepMinutes, config.workEndMinute, config.workStartMinute, timeFormat])

  const resolvedSavedPlacements = savedPlacements ?? placements

  async function commitMove(eventId: string, slotId: string) {
    const slot = slotById.get(slotId)
    if (!slot) return
    const target: DropTarget = {
      slotId,
      resourceId: slot.resourceId,
      weekday: slot.weekday,
      startMinute: slot.startMinute,
    }
    if (onBeforeMove) {
      const evaluation = await onBeforeMove(eventId, target)
      if (!evaluation.allowed) return
    }
    onEventMove(eventId, target)
  }

  function handleDragEnd(event: DragEndEvent) {
    const eventId = extractEventId(event)
    const slotId = resolveOverSlotId({ over: event.over, slotById, slotByGrid, placements })
    if (!eventId || !slotId) return
    void commitMove(eventId, slotId)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={schedulerCollisionDetection} onDragEnd={handleDragEnd}>
      <SchedulerTimeGrid<TEvent>
        tx={tx}
        a11yText={a11yText}
        timeFormat={timeFormat}
        visibleColumns={visibleColumns}
        timeRows={timeRows}
        slotByGrid={slotByGrid}
        startEventBySlot={startEventBySlot}
        occupyingEventBySlot={occupyingEventBySlot}
        slotFeedbackById={slotFeedbackById ?? new Map()}
        savedPlacements={resolvedSavedPlacements}
        placements={placements}
        selectedEventId={selectedEventId}
        isShiftPressed={isShiftPressed}
        showEmptyPlacementNotice={showEmptyPlacementNotice}
        renderEventCard={renderEventCard}
        renderOccupyingEvent={renderOccupyingEvent}
        onSelectEvent={(eventId) => onSelectEvent?.(eventId)}
        onRemoveEvent={(eventId) => onEventRemove?.(eventId)}
        onConvertSharedSlotToSwap={(eventIds) => onConvertSharedSlotToSwap?.(eventIds)}
        onRequireEventSelection={() => {}}
        onAttemptPlaceEvent={({ eventId, slotId }) => {
          void commitMove(eventId, slotId)
        }}
      />
    </DndContext>
  )
}
