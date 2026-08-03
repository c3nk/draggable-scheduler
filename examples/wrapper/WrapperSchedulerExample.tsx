// The batteries-included path: <Scheduler> owns the DndContext, sensors,
// collision detection and drag-end resolution, so a consumer only supplies data
// and a few callbacks. Domain fields (here: instructor + room hint) are rendered
// through DefaultEventCard's `children`, which keeps the bundled move handle,
// remove icon, selection frame and duration badge while letting the host own the
// actual content. This is the shape a host app (e.g. a course planner) would use
// to drop the grid in with minimal wiring.

import { useState } from 'react'
import {
  Scheduler,
  DefaultEventCard,
  type DropTarget,
  type EventPlacement,
  type Resource,
  type SchedulerConfig,
  type SchedulerEvent,
} from '../../src'

type DemoEventData = { instructor: string; roomHint: string }
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

const config: SchedulerConfig = {
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

export function WrapperSchedulerExample() {
  const [placements, setPlacements] = useState(initialPlacements)
  const [selectedEventId, setSelectedEventId] = useState<string | null>('event-1')

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <h1 className="text-xl font-semibold">Wrapper scheduler demo</h1>
      <p className="mt-1 text-sm text-slate-600">
        Uses the batteries-included &lt;Scheduler&gt; wrapper — no DndContext wiring in the host.
      </p>

      <Scheduler<DemoEvent>
        resources={resources}
        events={events}
        placements={placements}
        config={config}
        locale="en"
        selectedEventId={selectedEventId}
        onSelectEvent={setSelectedEventId}
        // Your business rules go here. Return { allowed: false, message } to reject.
        onBeforeMove={(_eventId, _target: DropTarget) => ({ allowed: true })}
        onEventMove={(eventId, target) => {
          setPlacements((current) => ({
            ...current,
            [eventId]: {
              eventId,
              resourceId: target.resourceId,
              weekday: target.weekday,
              startMinute: target.startMinute,
            },
          }))
          setSelectedEventId(eventId)
        }}
        onEventRemove={(eventId) => {
          setPlacements((current) => ({ ...current, [eventId]: null }))
          if (selectedEventId === eventId) setSelectedEventId(null)
        }}
        renderEventCard={(event, ctx) => (
          <DefaultEventCard
            event={event}
            selected={ctx.selected}
            onSelect={ctx.onSelect}
            onRemove={ctx.onRemove}
          >
            <div className="text-sm font-semibold">{event.label}</div>
            <div className="text-xs text-slate-600">{event.data?.instructor}</div>
            <div className="mt-1 text-[11px] text-slate-500">Suggested: {event.data?.roomHint}</div>
          </DefaultEventCard>
        )}
      />
    </div>
  )
}
