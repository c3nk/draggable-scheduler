// draggable-scheduler — core grid: rendering, drag/drop, scroll, selection, and callbacks only.
// No business logic lives here: this file never decides whether a move/swap is allowed, never
// computes conflicts, and never persists anything. The host application owns all of that and
// wires it in via props/callbacks (onBeforeMove-style validation, onEventMove-style persistence,
// getEventStatus-style styling). See README.md for the public API and usage.
//
// Card rendering is a host-supplied escape hatch: SlotCell/SchedulerTimeGrid are generic over
// TEvent and take a `renderEventCard`/`renderOccupyingEvent` prop instead of hardcoding any
// particular card shape — this file has zero knowledge of what a "course", "meeting", or "shift"
// looks like beyond the generic Resource/SchedulerEvent/EventPlacement/Slot model in ./types.
//
// Extracted from a production course-scheduling application, field-for-field, not redesigned.

import { Fragment, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent, Over } from '@dnd-kit/core'
import type {
  Resource,
  SchedulerEvent,
  SchedulerConfig,
  EventPlacement,
  Slot,
  DragEventData,
  SlotStatus,
  SchedulerA11yText,
} from './types'
import {
  buildSlotA11yLabel,
  buildSlotMatrix,
  getDefaultA11yText,
  resolveNextSlotId,
} from './keyboard'

const ALL_WEEK_DAYS: number[] = [0, 1, 2, 3, 4, 5, 6]

// ---------------------------------------------------------------------------
// Pure formatting / geometry helpers — generic, no domain knowledge.
// ---------------------------------------------------------------------------

export function formatWeekday(day: number, locale: 'tr' | 'en'): string {
  if (locale === 'tr') {
    if (day === 0) return 'Paz'
    if (day === 1) return 'Pzt'
    if (day === 2) return 'Sal'
    if (day === 3) return 'Çar'
    if (day === 4) return 'Per'
    if (day === 5) return 'Cum'
    if (day === 6) return 'Cmt'
    return `Gün ${day}`
  }
  if (day === 0) return 'Sun'
  if (day === 1) return 'Mon'
  if (day === 2) return 'Tue'
  if (day === 3) return 'Wed'
  if (day === 4) return 'Thu'
  if (day === 5) return 'Fri'
  if (day === 6) return 'Sat'
  return `Day ${day}`
}

export function buildSlots<TData = unknown>(input: {
  config: SchedulerConfig
  resources: Resource<TData>[]
  locale: 'tr' | 'en'
  timeFormat: '12h' | '24h'
}): Slot[] {
  const result: Slot[] = []
  for (const day of ALL_WEEK_DAYS) {
    for (const resource of input.resources) {
      for (let minute = input.config.workStartMinute; minute < input.config.workEndMinute; minute += input.config.slotStepMinutes) {
        result.push({
          id: `slot-${day}-${resource.id}-${minute}`,
          weekday: day,
          resourceId: resource.id,
          resourceLabel: resource.label,
          startMinute: minute,
          endMinute: minute + input.config.slotStepMinutes,
          dayLabel: formatWeekday(day, input.locale),
        })
      }
    }
  }
  return result
}

export function buildOrderedWeekdays(weekStartDay: number): number[] {
  const normalizedStart = ALL_WEEK_DAYS.includes(weekStartDay) ? weekStartDay : 1
  const startIndex = ALL_WEEK_DAYS.indexOf(normalizedStart)
  return [...ALL_WEEK_DAYS.slice(startIndex), ...ALL_WEEK_DAYS.slice(0, startIndex)]
}

export function resolveSlotClassName(status: SlotStatus): string {
  if (status === 'available') return 'border-emerald-500 bg-emerald-100/85'
  if (status === 'warning') return 'border-amber-500 bg-amber-100/90'
  if (status === 'conflict') return 'border-rose-500 bg-rose-100/90'
  return 'border-slate-200 bg-slate-50'
}

export function isOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA
}

export function clonePlacements(source: Record<string, EventPlacement | null>): Record<string, EventPlacement | null> {
  const cloned: Record<string, EventPlacement | null> = {}
  for (const [eventId, placement] of Object.entries(source)) {
    cloned[eventId] = placement ? { ...placement } : null
  }
  return cloned
}

export function isSamePlacement(left: EventPlacement | null | undefined, right: EventPlacement | null | undefined): boolean {
  if (!left && !right) return true
  if (!left || !right) return false
  return left.weekday === right.weekday && left.resourceId === right.resourceId && left.startMinute === right.startMinute
}

export function extractEventId(event: DragStartEvent | DragEndEvent): string | null {
  const data = event.active.data.current as DragEventData | undefined
  return data?.eventId ?? null
}

export function resolveOverSlotId(input: {
  over: Over | null
  slotById: Map<string, Slot>
  slotByGrid: Map<string, Slot>
  placements: Record<string, EventPlacement | null>
  onDebug?: (payload: {
    branch: 'missing-over' | 'direct-slot-id' | 'slot-from-data' | 'missing-course-id' | 'missing-placement' | 'slot-from-placement'
    overId: string | null
    dataSlotId: string | null
    inferredCourseId: string | null
    resolvedSlotId: string | null
  }) => void
}): string | null {
  const overId = input.over?.id ? String(input.over.id) : null
  const overData = input.over?.data.current as DragEventData | undefined
  const dataSlotId = overData?.slotId ?? null
  const inferredCourseId = overData?.eventId ?? (overId && overId.startsWith('slot-') ? overId.slice('slot-'.length) : null)
  if (!overId) {
    input.onDebug?.({
      branch: 'missing-over',
      overId: null,
      dataSlotId,
      inferredCourseId,
      resolvedSlotId: null,
    })
    return null
  }
  if (input.slotById.has(overId)) {
    input.onDebug?.({
      branch: 'direct-slot-id',
      overId,
      dataSlotId,
      inferredCourseId,
      resolvedSlotId: overId,
    })
    return overId
  }
  if (dataSlotId && input.slotById.has(dataSlotId)) {
    input.onDebug?.({
      branch: 'slot-from-data',
      overId,
      dataSlotId,
      inferredCourseId,
      resolvedSlotId: dataSlotId,
    })
    return dataSlotId
  }
  if (!inferredCourseId) {
    input.onDebug?.({
      branch: 'missing-course-id',
      overId,
      dataSlotId,
      inferredCourseId: null,
      resolvedSlotId: null,
    })
    return null
  }
  const placement = input.placements[inferredCourseId]
  if (!placement) {
    input.onDebug?.({
      branch: 'missing-placement',
      overId,
      dataSlotId,
      inferredCourseId,
      resolvedSlotId: null,
    })
    return null
  }
  const resolvedSlotId = input.slotByGrid.get(`${placement.weekday}-${placement.resourceId}-${placement.startMinute}`)?.id ?? null
  input.onDebug?.({
    branch: 'slot-from-placement',
    overId,
    dataSlotId,
    inferredCourseId,
    resolvedSlotId,
  })
  return resolvedSlotId
}

export function buildStartIndex<TEvent extends SchedulerEvent<unknown>>(input: {
  events: TEvent[]
  placements: Record<string, EventPlacement | null>
  slots: Slot[]
}): Map<string, TEvent[]> {
  const byEvent = new Map(input.events.map((item) => [item.id, item]))
  const slotsByDayResource = new Map<string, Slot[]>()
  for (const slot of input.slots) {
    const key = `${slot.weekday}-${slot.resourceId}`
    const current = slotsByDayResource.get(key) ?? []
    current.push(slot)
    slotsByDayResource.set(key, current)
  }
  const result = new Map<string, TEvent[]>()
  for (const [eventId, placement] of Object.entries(input.placements)) {
    if (!placement) continue
    const dayResourceSlots = slotsByDayResource.get(`${placement.weekday}-${placement.resourceId}`) ?? []
    const anchorSlot = dayResourceSlots.find(
      (slot) => placement.startMinute >= slot.startMinute && placement.startMinute < slot.endMinute,
    )
    const slotId = anchorSlot?.id
    if (!slotId) continue
    const event = byEvent.get(eventId)
    if (!event) continue
    const items = result.get(slotId) ?? []
    items.push(event)
    result.set(slotId, items)
  }
  return result
}

export function buildOccupyingIndex<TEvent extends SchedulerEvent<unknown>>(input: {
  events: TEvent[]
  placements: Record<string, EventPlacement | null>
  slots: Slot[]
}): Map<string, TEvent[]> {
  const byEvent = new Map(input.events.map((item) => [item.id, item]))
  const slotsByDayResource = new Map<string, Slot[]>()
  for (const slot of input.slots) {
    const key = `${slot.weekday}-${slot.resourceId}`
    const items = slotsByDayResource.get(key) ?? []
    items.push(slot)
    slotsByDayResource.set(key, items)
  }
  const result = new Map<string, TEvent[]>()
  for (const [eventId, placement] of Object.entries(input.placements)) {
    if (!placement) continue
    const event = byEvent.get(eventId)
    if (!event) continue
    const dayResourceSlots = slotsByDayResource.get(`${placement.weekday}-${placement.resourceId}`) ?? []
    const anchorSlotId = dayResourceSlots.find(
      (slot) => placement.startMinute >= slot.startMinute && placement.startMinute < slot.endMinute,
    )?.id
    for (const slot of dayResourceSlots) {
      if (slot.id === anchorSlotId) continue
      if (!isOverlap(placement.startMinute, placement.startMinute + event.durationMinutes, slot.startMinute, slot.endMinute)) continue
      const items = result.get(slot.id) ?? []
      items.push(event)
      result.set(slot.id, items)
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// SlotCell — a single droppable grid cell. Rendering of the actual placed
// event card is entirely delegated to the host via `renderEventCard` (the
// package only owns the droppable behavior, the shared/conflict badge, and
// the empty-state hint text). `renderOccupyingEvent` is an optional override
// for events that span into this slot without starting here; defaults to a
// plain label + "continues" hint if the host doesn't supply one.
// ---------------------------------------------------------------------------

export interface RenderEventCardContext {
  slotId: string
  selected: boolean
  onSelect: (eventId: string | null) => void
  onRemove: () => void
}

export function SlotCell<TEvent extends SchedulerEvent<unknown>>({
  slot,
  status,
  slotHint,
  startCourses,
  occupyingCourses,
  selectedCourseId,
  canConvertToSwap,
  tx,
  tabIndex,
  ariaLabel,
  ariaSelected,
  isFocused,
  renderEventCard,
  renderOccupyingEvent,
  onClickSlot,
  onSelectCourse,
  onRemoveCourse,
  onConvertSharedSlotToSwap,
  onFocusSlot,
  onKeyDownSlot,
  onRegisterNode,
}: {
  slot: Slot
  status: SlotStatus
  slotHint: string
  startCourses: TEvent[]
  occupyingCourses: TEvent[]
  selectedCourseId: string | null
  canConvertToSwap: boolean
  tx: (tr: string, en: string) => string
  tabIndex: number
  ariaLabel: string
  ariaSelected: boolean
  isFocused: boolean
  renderEventCard: (event: TEvent, context: RenderEventCardContext) => ReactNode
  renderOccupyingEvent?: (event: TEvent) => ReactNode
  onClickSlot: (event: { shiftKey: boolean }) => void
  onSelectCourse: (courseId: string | null) => void
  onRemoveCourse: (courseId: string) => void
  onConvertSharedSlotToSwap: () => void
  onFocusSlot: (slotId: string) => void
  onKeyDownSlot: (event: ReactKeyboardEvent<HTMLDivElement>, slotId: string) => void
  onRegisterNode: (slotId: string, node: HTMLDivElement | null) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slot.id })
  const hasPlacedCourse = startCourses.length > 0 || occupyingCourses.length > 0
  const stackedCount = startCourses.length + occupyingCourses.length
  const baseSlotClass = hasPlacedCourse ? 'border-slate-300 bg-slate-100/85' : resolveSlotClassName(status)
  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        onRegisterNode(slot.id, node)
      }}
      role="gridcell"
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      aria-selected={ariaSelected}
      data-focused={isFocused ? 'true' : 'false'}
      className={`min-h-[116px] rounded-lg border p-3 ${isOver ? 'border-blue-500 bg-blue-100/85' : baseSlotClass}`}
      onFocus={() => onFocusSlot(slot.id)}
      onKeyDown={(event) => onKeyDownSlot(event, slot.id)}
      onClick={(event) => {
        const target = event.target as HTMLElement | null
        if (target?.closest('[data-course-card="true"]')) return
        if (target?.closest('[data-shared-slot-action="true"]')) return
        onFocusSlot(slot.id)
        onClickSlot({ shiftKey: event.shiftKey })
      }}
    >
      {stackedCount > 1 ? (
        <div className="mb-1 flex items-center gap-1">
          <span className="inline-flex rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
            {tx('Paylaşımlı slot', 'Shared slot')} ({stackedCount})
          </span>
          {canConvertToSwap ? (
            <button
              type="button"
              data-shared-slot-action="true"
              className="inline-flex items-center gap-0.5 rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 hover:bg-blue-100"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onConvertSharedSlotToSwap()
              }}
              title={tx('Bu paylaşımı takasa dönüştürür', 'Convert this shared slot into a swap')}
            >
              ⇄ {tx('Takasa çevir', 'Convert to swap')}
            </button>
          ) : null}
        </div>
      ) : null}
      {startCourses.length > 0 || occupyingCourses.length > 0 ? (
        <div className="space-y-1.5">
          {startCourses.map((startCourse) => (
            <div key={startCourse.id} data-course-card="true">
              {renderEventCard(startCourse, {
                slotId: slot.id,
                selected: selectedCourseId === startCourse.id,
                onSelect: onSelectCourse,
                onRemove: () => onRemoveCourse(startCourse.id),
              })}
            </div>
          ))}
          {occupyingCourses.map((occupyingCourse) => (
            <div key={occupyingCourse.id} className={`mt-2 rounded-md border px-2 py-1 text-[11px] font-semibold ${selectedCourseId === occupyingCourse.id ? 'border-blue-500 bg-blue-100 text-blue-900' : 'border-slate-400 bg-slate-100 text-slate-800'}`}>
              {renderOccupyingEvent
                ? renderOccupyingEvent(occupyingCourse)
                : <>{occupyingCourse.label ?? occupyingCourse.id} {tx('devam ediyor', 'continues')}</>}
            </div>
          ))}
        </div>
      ) : (
        <p className={`mt-3 text-xs ${status === 'conflict' ? 'text-rose-700' : 'text-slate-500'}`}>{slotHint}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SchedulerTimeGrid — the day x resource slot grid itself (time axis + columns
// of SlotCell). DndContext, sensors, collision detection and all business-rule
// handlers (attemptPlaceCourse, handleUnassignCourse, handleConvertSharedSlotToSwap,
// etc.) stay in the container and are passed in here as props/callbacks.
// ---------------------------------------------------------------------------

export interface SchedulerTimeGridColumn {
  weekday: number
  resourceId: string
  dayLabel: string
  resourceLabel: string
}

export interface SchedulerTimeGridRow {
  startMinute: number
  endMinute: number
  label: string
}

export interface SchedulerSlotFeedback {
  status: SlotStatus
  message: string
}

export function SchedulerTimeGrid<TEvent extends SchedulerEvent<unknown>>({
  tx,
  visibleColumns,
  timeRows,
  slotByGrid,
  startCourseBySlot,
  occupyingCourseBySlot,
  slotFeedbackById,
  savedPlacements,
  placements,
  selectedCourseId,
  isShiftPressed,
  showEmptyPlacementNotice,
  renderEventCard,
  renderOccupyingEvent,
  onSelectCourse,
  onRemoveCourse,
  onConvertSharedSlotToSwap,
  onRequireCourseSelection,
  onAttemptPlaceCourse,
  a11yText,
}: {
  tx: (tr: string, en: string) => string
  visibleColumns: SchedulerTimeGridColumn[]
  timeRows: SchedulerTimeGridRow[]
  slotByGrid: Map<string, Slot>
  startCourseBySlot: Map<string, TEvent[]>
  occupyingCourseBySlot: Map<string, TEvent[]>
  slotFeedbackById: Map<string, SchedulerSlotFeedback>
  savedPlacements: Record<string, EventPlacement | null>
  placements: Record<string, EventPlacement | null>
  selectedCourseId: string | null
  isShiftPressed: boolean
  showEmptyPlacementNotice: boolean
  renderEventCard: (event: TEvent, context: RenderEventCardContext) => ReactNode
  renderOccupyingEvent?: (event: TEvent) => ReactNode
  onSelectCourse: (courseId: string | null) => void
  onRemoveCourse: (courseId: string) => void
  onConvertSharedSlotToSwap: (slotCourseIds: string[]) => void
  onRequireCourseSelection: () => void
  onAttemptPlaceCourse: (input: { courseId: string; slotId: string; forceSharedSlot: boolean }) => void
  a11yText?: SchedulerA11yText
}) {
  const resolvedA11yText = a11yText ?? getDefaultA11yText()
  const instructionsId = useId()
  const liveRegionId = useId()
  const slotMatrix = useMemo(
    () => buildSlotMatrix({ visibleColumns, timeRows, slotByGrid }),
    [slotByGrid, timeRows, visibleColumns],
  )
  const firstSlotId = slotMatrix.cells[0]?.find((slot) => slot != null)?.id ?? null
  const [focusedSlotId, setFocusedSlotId] = useState<string | null>(firstSlotId)
  const [liveMessage, setLiveMessage] = useState<string>('')
  const slotNodeById = useRef(new Map<string, HTMLDivElement | null>())

  useEffect(() => {
    setFocusedSlotId((current) => {
      if (current && slotMatrix.positionBySlotId.has(current)) return current
      return firstSlotId
    })
  }, [firstSlotId, slotMatrix.positionBySlotId])

  const announce = (message: string) => {
    setLiveMessage(message)
  }

  const focusSlot = (slotId: string) => {
    setFocusedSlotId(slotId)
    const node = slotNodeById.current.get(slotId)
    node?.focus()
  }

  const handleSlotKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>, slotId: string) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const nextSlotId = resolveNextSlotId({ matrix: slotMatrix, currentSlotId: slotId, key: event.key })
      if (nextSlotId) {
        focusSlot(nextSlotId)
        announce(resolvedA11yText('focusMoved'))
      }
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!selectedCourseId) {
        onRequireCourseSelection()
        announce(resolvedA11yText('selectionRequired'))
        return
      }
      onAttemptPlaceCourse({
        courseId: selectedCourseId,
        slotId,
        forceSharedSlot: Boolean(event.shiftKey),
      })
      announce(resolvedA11yText('placementRequested'))
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      onSelectCourse(null)
      announce(resolvedA11yText('selectionCleared'))
      return
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      if (!selectedCourseId) return
      event.preventDefault()
      onRemoveCourse(selectedCourseId)
      onSelectCourse(null)
      announce(resolvedA11yText('removeRequested'))
    }
  }

  const gridLabel = resolvedA11yText('gridLabel')
  const instructions = resolvedA11yText('gridInstructions')
  return (
    <div className="mt-3 min-h-0 flex-1 overflow-auto">
      <div id={liveRegionId} aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap' }}>
        {liveMessage}
      </div>
      {visibleColumns.length === 0 ? (
        <div className="rounded border border-dashed border-slate-300 p-3 text-sm text-slate-500">
          {tx('Görüntülemek için en az bir gün ve bir mekan seçin.', 'Select at least one day and one room.')}
        </div>
      ) : (
        <div
          role="grid"
          aria-label={gridLabel}
          aria-describedby={`${instructionsId} ${liveRegionId}`}
          aria-rowcount={timeRows.length}
          aria-colcount={visibleColumns.length}
          className="grid min-w-[1200px] gap-x-2 gap-y-1"
          style={{ gridTemplateColumns: `72px repeat(${visibleColumns.length}, minmax(170px, 1fr))` }}
        >
          <span id={instructionsId} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap' }}>
            {instructions}
          </span>
          <div className="sticky left-0 z-10 rounded border border-slate-200 bg-slate-100 p-2 text-center text-xs font-semibold">{tx('Saat', 'Time')}</div>
          {visibleColumns.map((column) => (
            <div key={`${column.weekday}-${column.resourceId}`} className="rounded border border-slate-200 bg-slate-100 p-2 text-center text-xs font-semibold">
              {column.dayLabel} • {column.resourceLabel}
            </div>
          ))}
          {timeRows.map((row) => (
            <Fragment key={row.startMinute}>
              <div className="sticky left-0 z-10 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold">
                <div className="flex min-h-[110px] items-center justify-center text-center leading-tight text-slate-700">
                  <span>{row.label}</span>
                </div>
              </div>
              {visibleColumns.map((column) => {
                const slot = slotByGrid.get(`${column.weekday}-${column.resourceId}-${row.startMinute}`)
                if (!slot) {
                  return <div key={`${column.weekday}-${column.resourceId}-${row.startMinute}`} className="rounded border border-slate-200 bg-slate-50/50" />
                }
                const startCourses = startCourseBySlot.get(slot.id) ?? []
                const occupyingCourses = occupyingCourseBySlot.get(slot.id) ?? []
                const feedback = slotFeedbackById.get(slot.id) ?? {
                  status: 'idle' as SlotStatus,
                  message: tx('Seçili dersi bu slota bırakın.', 'Drop selected course into this slot.'),
                }
                const slotCourseIds = [...startCourses.map((item) => item.id), ...occupyingCourses.map((item) => item.id)]
                const canConvertToSwap = slotCourseIds.length === 2
                  && slotCourseIds.every((id) => savedPlacements[id] != null)
                  && slotCourseIds.some((id) => isSamePlacement(savedPlacements[id] ?? null, placements[id] ?? null))
                  && slotCourseIds.some((id) => !isSamePlacement(savedPlacements[id] ?? null, placements[id] ?? null))
                const isFocused = focusedSlotId === slot.id
                return (
                  <SlotCell
                    key={slot.id}
                    slot={slot}
                    status={feedback.status}
                    slotHint={feedback.message}
                    startCourses={startCourses}
                    occupyingCourses={occupyingCourses}
                    selectedCourseId={selectedCourseId}
                    canConvertToSwap={canConvertToSwap}
                    tx={tx}
                    tabIndex={isFocused || focusedSlotId == null ? 0 : -1}
                    ariaLabel={buildSlotA11yLabel({
                      slot,
                      status: feedback.status,
                      selected: isFocused,
                      occupied: startCourses.length > 0 || occupyingCourses.length > 0,
                      a11yText: resolvedA11yText,
                    })}
                    ariaSelected={isFocused}
                    isFocused={isFocused}
                    renderEventCard={renderEventCard}
                    renderOccupyingEvent={renderOccupyingEvent}
                    onSelectCourse={onSelectCourse}
                    onRemoveCourse={onRemoveCourse}
                    onConvertSharedSlotToSwap={() => onConvertSharedSlotToSwap(slotCourseIds)}
                    onFocusSlot={(slotId) => {
                      setFocusedSlotId(slotId)
                      const focusedSlot = slotByGrid.get(`${column.weekday}-${column.resourceId}-${row.startMinute}`)
                      if (focusedSlot) {
                        announce(buildSlotA11yLabel({
                          slot: focusedSlot,
                          status: feedback.status,
                          selected: true,
                          occupied: startCourses.length > 0 || occupyingCourses.length > 0,
                          a11yText: resolvedA11yText,
                        }))
                      }
                    }}
                    onKeyDownSlot={handleSlotKeyDown}
                    onRegisterNode={(slotId, node) => {
                      slotNodeById.current.set(slotId, node)
                    }}
                    onClickSlot={(event) => {
                      if (!selectedCourseId) {
                        onRequireCourseSelection()
                        announce(resolvedA11yText('selectionRequired'))
                        return
                      }
                      const clickShift = Boolean(event.shiftKey) || isShiftPressed
                      onAttemptPlaceCourse({ courseId: selectedCourseId, slotId: slot.id, forceSharedSlot: clickShift })
                      announce(resolvedA11yText('placementRequested'))
                    }}
                  />
                )
              })}
            </Fragment>
          ))}
        </div>
      )}
      {showEmptyPlacementNotice ? (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {tx('Seçili sınıflarda henüz atanmış ders görünmüyor. Farklı sınıflar ekleyebilirsiniz.', 'No placed course is visible in selected classrooms yet. You can add different classrooms.')}
        </div>
      ) : null}
    </div>
  )
}
