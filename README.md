# draggable-scheduler

A headless(-ish), drag-and-drop weekly resource-scheduling grid for React. Built on [`@dnd-kit/core`](https://dndkit.com/).

It renders a weekday x resource grid of time slots, lets users drag events between slots, and notifies your app of what happened — nothing more. It never decides whether a move or swap is *allowed*; your app does that and tells the grid the answer.

Useful for: university timetables, meeting room booking, hospital shift/resource scheduling, manufacturing scheduling, employee shifts, equipment booking, sports facility booking, or any other weekday/time-slot resource-scheduling UI.

## Status

`v0.1.0` — freshly extracted from a production course-scheduling application, field-for-field, not redesigned. What's still in progress:

- ✅ Generic grid rendering, drag/drop, selection, slot status display — done.
- ✅ Host-supplied card rendering via `renderEventCard`/`renderOccupyingEvent` — done.
- 🚧 Generic in-memory undo hook (`usePlacementHistory`) — planned, not yet ported.
- 🚧 Generic preset toolbar (`FilterPresetToolbar<TState>`) — planned, not yet ported.
- 🚧 Compiled CSS distribution (`dist/style.css`) — the grid currently ships raw Tailwind utility class strings; your app's Tailwind `content` config needs to include this package's files until compiled CSS shipping lands.

## Install

```bash
npm install draggable-scheduler @dnd-kit/core react react-dom
```

`@dnd-kit/core`, `react`, and `react-dom` are peer dependencies.

## The model

The grid is a **recurring weekly** schedule — weekday + minute-of-day, not absolute dates. That's what every current consumer needs, and it keeps the library small. There are three core concepts:

```ts
// A bookable thing: a room, a bed, a machine, an employee...
interface Resource<TData> {
  id: string
  label: string
  data?: TData // anything your app cares about — opaque to the library
}

// A thing to be scheduled: a class, a meeting, a shift...
interface SchedulerEvent<TData> {
  id: string
  durationMinutes: number
  label?: string
  data?: TData // anything your app cares about — opaque to the library
}

// Where an event currently sits.
interface EventPlacement {
  eventId: string
  resourceId: string
  weekday: number     // 0-6
  startMinute: number // minutes since midnight
}
```

The library never reads `data` itself — it's yours. Put your course/meeting/shift-specific fields there and read them back in `renderEventCard`.

## Usage

```tsx
import { DndContext } from '@dnd-kit/core'
import {
  SchedulerTimeGrid,
  buildSlots,
  buildStartIndex,
  buildOccupyingIndex,
} from 'draggable-scheduler'
import type { Resource, SchedulerEvent, EventPlacement } from 'draggable-scheduler'

interface MeetingData { title: string; organizer: string }
type MeetingEvent = SchedulerEvent<MeetingData> & { data: MeetingData }

function MyScheduler() {
  const resources: Resource<{ building: string }>[] = [
    { id: 'room-1', label: 'Room 101', data: { building: 'A' } },
  ]
  const events: MeetingEvent[] = [
    { id: 'evt-1', durationMinutes: 60, data: { title: 'Standup', organizer: 'Alice' } },
  ]
  const placements: Record<string, EventPlacement | null> = {
    'evt-1': { eventId: 'evt-1', resourceId: 'room-1', weekday: 1, startMinute: 9 * 60 },
  }

  const config = { workDays: [1, 2, 3, 4, 5], weekStartDay: 1, workStartMinute: 8 * 60, workEndMinute: 18 * 60, slotStepMinutes: 30 }
  const slots = buildSlots({ config, resources, locale: 'en', timeFormat: '24h' })
  const eventsBySlot = buildStartIndex({ events, placements, slots })
  const occupyingBySlot = buildOccupyingIndex({ events, placements, slots })

  return (
    <DndContext onDragEnd={/* resolve slot, call your onBeforeMove, then onEventMove */ () => {}}>
      <SchedulerTimeGrid
        tx={(_tr, en) => en}
        visibleColumns={/* derive from resources x config.workDays */ []}
        timeRows={/* derive from config */ []}
        slotByGrid={new Map(slots.map((s) => [`${s.weekday}-${s.resourceId}-${s.startMinute}`, s]))}
        startCourseBySlot={eventsBySlot}
        occupyingCourseBySlot={occupyingBySlot}
        slotFeedbackById={new Map()}
        savedPlacements={placements}
        placements={placements}
        selectedCourseId={null}
        isShiftPressed={false}
        showEmptyPlacementNotice={false}
        renderEventCard={(event, ctx) => (
          <div onClick={() => ctx.onSelect(event.id)}>{event.data.title}</div>
        )}
        onSelectCourse={() => {}}
        onRemoveCourse={() => {}}
        onConvertSharedSlotToSwap={() => {}}
        onRequireCourseSelection={() => {}}
        onAttemptPlaceCourse={(input) => {
          // your app decides: call onBeforeMove-style validation here, then persist.
        }}
      />
    </DndContext>
  )
}
```

A fuller worked example is planned for `examples/basic`.

## Public API

```
Resource<TData>, SchedulerEvent<TData>, EventPlacement, Slot, SchedulerConfig, DragEventData, SlotStatus

SchedulerTimeGrid<TEvent>   — the grid itself (time axis + resource columns + slot cells)
SlotCell<TEvent>            — a single droppable cell (used internally by SchedulerTimeGrid)

buildSlots, buildOrderedWeekdays, buildStartIndex, buildOccupyingIndex, resolveOverSlotId
isOverlap, clonePlacements, isSamePlacement, extractEventId, resolveSlotClassName, formatWeekday
```

Everything about *why* a move is allowed, *what* a conflict means, and *how* it's persisted is your application's job. This library renders, drags, scrolls, and selects — it notifies you via callbacks and never makes a business decision on its own.

## Philosophy

- No business logic. No conflict detection. No persistence. No fetching.
- Prefer many small, composable pieces over one big configurable component.
- Preserve behavior over introducing "nice to have" abstractions — see `MIGRATION_PLAN.md` for what's deliberately deferred.

## License

Apache-2.0. See [LICENSE](./LICENSE).
