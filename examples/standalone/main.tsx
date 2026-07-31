// Self-contained demo entry for the REAL package (Scheduler + DefaultEventCard).
// Bundled by scripts/build-standalone.mjs into examples/standalone-demo.html with
// React, react-dom and @dnd-kit inlined — no network, no build step for the viewer.
import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Scheduler,
  DefaultEventCard,
  type DropTarget,
  type EventPlacement,
  type Resource,
  type SchedulerConfig,
  type SchedulerEvent,
} from '../../src'

type DemoData = { title: string; instructor: string }
type DemoEvent = SchedulerEvent<DemoData>

const resources: Resource[] = [
  { id: 'room-a', label: 'Room A' },
  { id: 'room-b', label: 'Room B' },
  { id: 'room-c', label: 'Room C' },
]

const events: DemoEvent[] = [
  { id: 'e1', durationMinutes: 60, label: 'CS101', data: { title: 'CS101', instructor: 'Alice' } },
  { id: 'e2', durationMinutes: 90, label: 'MATH2', data: { title: 'MATH2', instructor: 'Bob' } },
  { id: 'e3', durationMinutes: 30, label: 'LAB-A', data: { title: 'LAB-A', instructor: 'Cem' } },
  { id: 'e4', durationMinutes: 60, label: 'PHYS1', data: { title: 'PHYS1', instructor: 'Deniz' } },
]

const config: SchedulerConfig = {
  workDays: [1, 2, 3, 4, 5],
  weekStartDay: 1,
  workStartMinute: 8 * 60,
  workEndMinute: 13 * 60,
  slotStepMinutes: 30,
}

const initial: Record<string, EventPlacement | null> = {
  e1: { eventId: 'e1', resourceId: 'room-a', weekday: 1, startMinute: 9 * 60 },
  e2: { eventId: 'e2', resourceId: 'room-b', weekday: 2, startMinute: 10 * 60 },
  e3: { eventId: 'e3', resourceId: 'room-c', weekday: 3, startMinute: 11 * 60 },
  e4: { eventId: 'e4', resourceId: 'room-b', weekday: 1, startMinute: 9 * 60 },
}

function Demo() {
  const [placements, setPlacements] = useState(initial)
  const [selectedEventId, setSelectedEventId] = useState<string | null>('e1')
  const [shift, setShift] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => setShift(e.shiftKey)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [])

  const placedCount = useMemo(() => Object.values(placements).filter(Boolean).length, [placements])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'system-ui, sans-serif' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20 }}>draggable-scheduler — real package demo</h1>
        <p style={{ margin: '4px 0', fontSize: 13, color: '#475569' }}>
          Each placed card shows the bundled <b>move handle</b> (⠿) and <b>delete icon</b> (🗑) from <code>DefaultEventCard</code>.
          Drag a card onto an empty slot to move it. Drag a card <b>onto another card</b> to <b>swap</b> the two.
          Hold <b>Shift</b> while dropping onto an occupied slot to force a <b>shared slot</b> instead of swapping.
        </p>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          Shift: <span style={{ color: shift ? '#059669' : '#dc2626' }}>{shift ? 'ON' : 'OFF'}</span>
          <span style={{ marginLeft: 16, color: '#475569' }}>Placed: {placedCount} · Selected: {selectedEventId ?? 'none'}</span>
        </div>
      </div>

      <Scheduler<DemoEvent>
        resources={resources}
        events={events}
        placements={placements}
        config={config}
        locale="en"
        selectedEventId={selectedEventId}
        onSelectEvent={setSelectedEventId}
        onBeforeMove={(_id, _t: DropTarget) => ({ allowed: true })}
        onEventMove={(eventId, target) => {
          setPlacements((cur) => {
            const from = cur[eventId] ?? null
            const moved: EventPlacement = { eventId, resourceId: target.resourceId, weekday: target.weekday, startMinute: target.startMinute }
            const occupant = target.occupantEventIds.find((id) => id !== eventId)
            // Host-owned rule (mirrors the original app): a plain drop onto a single
            // occupant SWAPS the two; holding Shift forces a shared (double-booked) slot.
            if (occupant && !target.forceSharedSlot && from) {
              const occupantTakes: EventPlacement = { eventId: occupant, resourceId: from.resourceId, weekday: from.weekday, startMinute: from.startMinute }
              return { ...cur, [eventId]: moved, [occupant]: occupantTakes }
            }
            return { ...cur, [eventId]: moved }
          })
          setSelectedEventId(eventId)
        }}
        onEventRemove={(eventId) => {
          setPlacements((cur) => ({ ...cur, [eventId]: null }))
          if (selectedEventId === eventId) setSelectedEventId(null)
        }}
        renderEventCard={(event, ctx) => (
          <DefaultEventCard event={event} selected={ctx.selected} onSelect={ctx.onSelect} onRemove={ctx.onRemove}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{event.data?.title}</div>
            <div style={{ fontSize: 12, color: '#475569' }}>{event.data?.instructor}</div>
          </DefaultEventCard>
        )}
      />
    </div>
  )
}

const root = document.getElementById('root')
if (root) createRoot(root).render(<Demo />)
