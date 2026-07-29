import { useMemo, useState } from 'react'
import {
  DndContext,
  useDraggable,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  buildOccupyingIndex,
  buildOrderedWeekdays,
  buildSlots,
  buildStartIndex,
  extractEventId,
  formatWeekday,
  resolveOverSlotId,
  SchedulerTimeGrid,
  type EventPlacement,
  type Resource,
  type SchedulerEvent,
  type SchedulerTimeGridColumn,
  type SchedulerTimeGridRow,
  type Slot,
} from '../../src'

type DemoEventData = {
  instructor: string
  roomHint: string
}

type DemoEvent = SchedulerEvent<DemoEventData>

const resources: Resource[] = [
  { id: 'room-a', label: 'Room A' },
  { id: 'room-b', label: 'Room B' },
  { id: 'room-c', label: 'Room C' },
]

const events: DemoEvent[] = [
  { id: 'event-1', durationMinutes: 60, label: 'Standup', data: { instructor: 'Alice', roomHint: 'Room A' } },
  { id: 'event-2', durationMinutes: 90, label: 'Workshop', data: { instructor: 'Bob', roomHint: 'Room B' } },
  { id: 'event-3', durationMinutes: 30, label: 'Check-in', data: { instructor: 'Cem', roomHint: 'Room C' } },
]

const config = {
  workDays: [1, 2, 3, 4, 5],
  weekStartDay: 1,
  workStartMinute: 8 * 60,
  workEndMinute: 17 * 60,
  slotStepMinutes: 30,
}

const initialPlacements: Record<string, EventPlacement | null> = {
  'event-1': { eventId: 'event-1', resourceId: 'room-a', weekday: 1, startMinute: 9 * 60 },
  'event-2': { eventId: 'event-2', resourceId: 'room-b', weekday: 2, startMinute: 10 * 60 },
  'event-3': { eventId: 'event-3', resourceId: 'room-c', weekday: 3, startMinute: 11 * 60 },
}

function formatMinute(minute: number) {
  const hours = String(Math.floor(minute / 60)).padStart(2, '0')
  const minutes = String(minute % 60).padStart(2, '0')
  return `${hours}:${minutes}`
}

function buildTimeRows(): SchedulerTimeGridRow[] {
  const rows: SchedulerTimeGridRow[] = []
  for (let minute = config.workStartMinute; minute < config.workEndMinute; minute += config.slotStepMinutes) {
    rows.push({
      startMinute: minute,
      endMinute: minute + config.slotStepMinutes,
      label: `${formatMinute(minute)}-${formatMinute(minute + config.slotStepMinutes)}`,
    })
  }
  return rows
}

function DemoDraggableCard({
  event,
  selected,
  onSelect,
  onRemove,
}: {
  event: DemoEvent
  selected: boolean
  onSelect: (eventId: string | null) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    data: { eventId: event.id },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={[
        'cursor-grab rounded-lg border p-3 shadow-sm transition',
        selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white',
        isDragging ? 'opacity-60' : '',
      ].join(' ')}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      onClick={() => onSelect(event.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{event.label}</div>
          <div className="text-xs text-slate-600">{event.data?.instructor}</div>
          <div className="mt-1 text-[11px] text-slate-500">Suggested room: {event.data?.roomHint}</div>
        </div>
        <button
          type="button"
          className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
        >
          Remove
        </button>
      </div>
    </div>
  )
}

export function BasicSchedulerExample() {
  const [placements, setPlacements] = useState<Record<string, EventPlacement | null>>(initialPlacements)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(events[0]?.id ?? null)

  const slots = useMemo(
    () => buildSlots({ config, resources, locale: 'en', timeFormat: '24h' }),
    [],
  )
  const slotById = useMemo(() => new Map(slots.map((slot) => [slot.id, slot] as const)), [slots])
  const slotByGrid = useMemo(
    () => new Map(slots.map((slot) => [`${slot.weekday}-${slot.resourceId}-${slot.startMinute}`, slot] as const)),
    [slots],
  )
  const startCourseBySlot = useMemo(
    () => buildStartIndex({ events, placements, slots }),
    [placements, slots],
  )
  const occupyingCourseBySlot = useMemo(
    () => buildOccupyingIndex({ events, placements, slots }),
    [placements, slots],
  )
  const visibleColumns = useMemo<SchedulerTimeGridColumn[]>(
    () =>
      buildOrderedWeekdays(config.weekStartDay)
        .flatMap((weekday) =>
          resources.map((resource) => ({
            weekday,
            resourceId: resource.id,
            dayLabel: formatWeekday(weekday, 'en'),
            resourceLabel: resource.label,
          })),
        )
        .filter((column) => config.workDays.includes(column.weekday)),
    [],
  )
  const timeRows = useMemo(() => buildTimeRows(), [])

  function commitPlacement(eventId: string, slotId: string) {
    const slot = slotById.get(slotId)
    if (!slot) return
    setPlacements((current) => ({
      ...current,
      [eventId]: {
        eventId,
        resourceId: slot.resourceId,
        weekday: slot.weekday,
        startMinute: slot.startMinute,
      },
    }))
  }

  function handleDragEnd(event: DragEndEvent) {
    const eventId = extractEventId(event)
    const slotId = resolveOverSlotId({
      over: event.over,
      slotById,
      slotByGrid,
      placements,
    })
    if (!eventId || !slotId) return
    commitPlacement(eventId, slotId)
    setSelectedCourseId(eventId)
  }

  return (
    <div className="flex min-h-screen gap-4 bg-slate-50 p-4 text-slate-900">
      <aside className="w-[320px] shrink-0 space-y-3">
        <div>
          <h1 className="text-xl font-semibold">Basic scheduler demo</h1>
          <p className="mt-1 text-sm text-slate-600">
            A minimal consumer example that wires draggable cards to the grid using `@dnd-kit/core`.
          </p>
        </div>

        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-600">
          Tip: click a card to select it, then click a slot to move it, or drag the card directly onto a slot.
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          Selected event: <span className="font-semibold">{selectedCourseId ?? 'none'}</span>
        </div>
      </aside>

      <DndContext onDragEnd={handleDragEnd}>
        <SchedulerTimeGrid<DemoEvent>
          tx={(tr, en) => en}
          visibleColumns={visibleColumns}
          timeRows={timeRows}
          slotByGrid={slotByGrid}
          startCourseBySlot={startCourseBySlot}
          occupyingCourseBySlot={occupyingCourseBySlot}
          slotFeedbackById={new Map()}
          savedPlacements={initialPlacements}
          placements={placements}
          selectedCourseId={selectedCourseId}
          isShiftPressed={false}
          showEmptyPlacementNotice={false}
          renderEventCard={(event, context) => (
            <DemoDraggableCard
              event={event}
              selected={context.selected}
              onSelect={context.onSelect}
              onRemove={context.onRemove}
            />
          )}
          renderOccupyingEvent={(event) => <span>{event.label}</span>}
          onSelectCourse={setSelectedCourseId}
          onRemoveCourse={(eventId) => {
            setPlacements((current) => ({ ...current, [eventId]: null }))
            if (selectedCourseId === eventId) setSelectedCourseId(null)
          }}
          onConvertSharedSlotToSwap={() => {}}
          onRequireCourseSelection={() => {}}
          onAttemptPlaceCourse={({ courseId, slotId }) => {
            commitPlacement(courseId, slotId)
            setSelectedCourseId(courseId)
          }}
        />
      </DndContext>
    </div>
  )
}
