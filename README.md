# draggable-scheduler

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![npm version](https://img.shields.io/npm/v/draggable-scheduler.svg)](https://www.npmjs.com/package/draggable-scheduler)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

A headless(-ish), drag-and-drop weekly resource-scheduling grid for React, built on [`@dnd-kit/core`](https://dndkit.com/).

| Browser | Support |
| --- | --- |
| Chrome | Latest 2 stable versions |
| Edge | Latest 2 stable versions |
| Firefox | Latest 2 stable versions |
| Safari | Latest 2 stable versions |
| iOS Safari | Latest 2 stable versions |

It renders a weekday x resource grid of time slots, lets users drag events between slots, and notifies your app of what happened — nothing more. It never decides whether a move or swap is *allowed*; your app does that and tells the grid the answer.

Useful for university timetables, meeting room booking, hospital shift/resource scheduling, manufacturing scheduling, employee shifts, equipment booking, sports facility booking, or any other weekday/time-slot resource-scheduling UI.

Originally developed for and used in production by [Plansoar](https://plansoar.com), maintained by [c3nk](https://c3nk.com).

## Why

Most scheduling UI libraries try to own your business rules — conflict detection, validation, persistence — bundled with the rendering. That coupling is exactly what makes them hard to adapt: your conflict rules are never quite the library's conflict rules.

`draggable-scheduler` takes the opposite approach: it only renders, drags, scrolls, and selects. Your app decides everything else. This keeps the library small, predictable, and usable well outside its original domain.

It comes in two layers you can pick between:

- **`<Scheduler>`** — batteries-included. It owns the `DndContext`, sensors, collision detection and drag-end resolution; you pass data + rules and it drives `onBeforeMove` / `onEventMove` / `onEventRemove` for you.
- **`<SchedulerTimeGrid>`** — the low-level grid. You bring your own `DndContext` and resolve drops yourself. Use this when you need full control (a tuned collision strategy, async rule engines, swap/unassign workflows).

## Features

- Weekday x resource grid rendering with a customizable time axis
- Drag-and-drop event placement via `@dnd-kit/core`
- A bundled, draggable **`DefaultEventCard`** with the UI affordances you expect — a move/drag handle, a remove (delete) icon, a selection frame and a duration badge — all with inline SVG icons and no icon dependency (draggable from the whole card by default; `dragActivator="handle"` to require the grip)
- 12h / 24h time axis via a single `timeFormat` prop (drives both the visible labels and the screen-reader slot ranges)
- Slot selection, shared-slot ("double-booked") indication, and swap-candidate detection
- A `renderEventCard` escape hatch — override the default card entirely, or wrap it and pass your domain fields as `children`
- Zero business logic: no conflict detection, no persistence, no fetching, no opinions about your domain
- A generic `Resource<TData>`/`SchedulerEvent<TData>` model — attach any data shape and read it back in your own rendering
- Keyboard navigation + generic, overridable screen-reader text

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

The quickest path is the `<Scheduler>` wrapper: give it data, a config, and an `onEventMove`, and it handles the drag-and-drop plumbing for you.

```tsx
import { useState } from 'react'
import { Scheduler, DefaultEventCard } from 'draggable-scheduler'
import 'draggable-scheduler/style.css'
import type {
  Resource,
  SchedulerEvent,
  SchedulerConfig,
  EventPlacement,
  DropTarget,
} from 'draggable-scheduler'

interface MeetingData { title: string; organizer: string }
type MeetingEvent = SchedulerEvent<MeetingData>

const resources: Resource[] = [{ id: 'room-1', label: 'Room 101' }]
const events: MeetingEvent[] = [
  { id: 'evt-1', durationMinutes: 60, label: 'Standup', data: { title: 'Standup', organizer: 'Alice' } },
]
const config: SchedulerConfig = {
  workDays: [1, 2, 3, 4, 5], weekStartDay: 1,
  workStartMinute: 8 * 60, workEndMinute: 18 * 60, slotStepMinutes: 30,
}

function MyScheduler() {
  const [placements, setPlacements] = useState<Record<string, EventPlacement | null>>({
    'evt-1': { eventId: 'evt-1', resourceId: 'room-1', weekday: 1, startMinute: 9 * 60 },
  })
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  return (
    <Scheduler<MeetingEvent>
      resources={resources}
      events={events}
      placements={placements}
      config={config}
      selectedEventId={selectedEventId}
      onSelectEvent={setSelectedEventId}
      // Your business rules. Return { allowed: false, message } to reject a drop.
      onBeforeMove={(_eventId, _target: DropTarget) => ({ allowed: true })}
      onEventMove={(eventId, target) => {
        setPlacements((current) => ({
          ...current,
          [eventId]: { eventId, resourceId: target.resourceId, weekday: target.weekday, startMinute: target.startMinute },
        }))
      }}
      onEventRemove={(eventId) => setPlacements((current) => ({ ...current, [eventId]: null }))}
      // Optional: omit renderEventCard to get the bundled default card as-is.
      // Here we keep its affordances (move handle, delete icon, duration) and add domain fields.
      renderEventCard={(event, ctx) => (
        <DefaultEventCard event={event} selected={ctx.selected} onSelect={ctx.onSelect} onRemove={ctx.onRemove}>
          <div className="text-sm font-semibold">{event.data?.title}</div>
          <div className="text-xs text-slate-600">{event.data?.organizer}</div>
        </DefaultEventCard>
      )}
    />
  )
}
```

Omit `renderEventCard` entirely and each placed event renders with the bundled `DefaultEventCard` — a draggable card with a move handle, a delete icon and a duration badge — out of the box.

Two worked examples ship in the repo:

- [`examples/wrapper/WrapperSchedulerExample.tsx`](./examples/wrapper/WrapperSchedulerExample.tsx) — the `<Scheduler>` path above.
- [`examples/basic/BasicSchedulerExample.tsx`](./examples/basic/BasicSchedulerExample.tsx) — the low-level `<SchedulerTimeGrid>` path with a host-owned `DndContext` and a fully custom card.

If you want a no-install preview you can open directly in a browser, download [`examples/standalone-demo.html`](./examples/standalone-demo.html). It is a single self-contained file (React, dnd-kit and this package inlined — no network, no build step for the viewer) built from the real package via `npm run build:demo` (source in [`examples/standalone/main.tsx`](./examples/standalone/main.tsx)), so it shows the actual `DefaultEventCard` (move handle + delete icon) and `<Scheduler>` Shift behavior.

The package ships a precompiled stylesheet at `draggable-scheduler/style.css`, which you should import once in your app if you want the grid to render with the bundled defaults.

## Browser Support

`draggable-scheduler` is supported on the latest two stable versions of Chrome, Edge, Firefox, Safari, and iOS Safari.

The published package targets these browsers in `package.json` via `browserslist`, and the support matrix is covered by tests so it does not drift accidentally.

## Keyboard Support

The grid supports roving focus and generic keyboard navigation:

- `Arrow` keys move between slots
- `Home` and `End` move to the start or end of the current row
- `Enter` and `Space` request placement into the focused slot
- `Shift + Enter` and `Shift + Space` request shared-slot placement in the current contract; when that shared slot is valid, the inline `Convert to swap` action appears and the host app can complete the exchange
- `Escape` clears the current selection
- `Delete` and `Backspace` request removal of the selected event

Screen reader text is intentionally generic and domain-free. If you need custom wording, pass your own `a11yText` function.
For the common case, the package also exports `createSchedulerA11yText(locale, overrides)` so you can start from the built-in generic copy and override only the phrases you need.

```tsx
import { createSchedulerA11yText } from 'draggable-scheduler'

const a11yText = createSchedulerA11yText('tr', {
  gridLabel: 'Planlama tablosu',
  gridInstructions: 'Ok tuşları ile gezin. Enter ile yerleştirme iste.',
})
```

Use the helper when you want generic screen-reader wording with a few app-specific tweaks, without rewriting the whole accessibility dictionary.

## Public API

```
Types
  Resource<TData>, SchedulerEvent<TData>, EventPlacement, Slot, SchedulerConfig,
  DragEventData, SlotStatus, DropTarget, DropEvaluation

Components
  Scheduler<TEvent>          — batteries-included wrapper (owns DndContext + drag resolution)
                               props: resources, events, placements, config, onEventMove (required),
                               onBeforeMove?, onEventRemove?, onConvertSharedSlotToSwap?,
                               selectedEventId?, onSelectEvent?, slotFeedbackById?, renderEventCard?, ...
  SchedulerTimeGrid<TEvent>  — low-level grid (host owns DndContext)
                               props: visibleColumns, timeRows, slotByGrid, startEventBySlot,
                               occupyingEventBySlot, placements, savedPlacements, selectedEventId,
                               onSelectEvent, onRemoveEvent, onAttemptPlaceEvent, onRequireEventSelection,
                               onConvertSharedSlotToSwap, renderEventCard?, renderOccupyingEvent?, ...
  SlotCell<TEvent>           — a single droppable cell (used internally by SchedulerTimeGrid)
  DefaultEventCard<TEvent>   — bundled draggable card (move handle, delete icon, duration badge, children)
  PresetToolbar<TState>

Helpers
  schedulerCollisionDetection, formatDurationLabel
  buildSlots, buildOrderedWeekdays, buildStartIndex, buildOccupyingIndex, resolveOverSlotId
  isOverlap, clonePlacements, isSamePlacement, extractEventId, resolveSlotClassName, formatWeekday
  usePlacementHistory, createPlacementHistory, setPlacementHistory, undoPlacementHistory, clearPlacementHistory
  createSchedulerA11yText, getDefaultA11yText
```

Everything about *why* a move is allowed, *what* a conflict means, and *how* it's persisted is your application's job — `<Scheduler>` surfaces those decisions as `onBeforeMove`/`onEventMove` callbacks, and `<SchedulerTimeGrid>` leaves the drag wiring to you entirely. The library renders, drags, scrolls, and selects; it never makes a business decision on its own.

## Philosophy

- No business logic. No conflict detection. No persistence. No fetching.
- Prefer many small, composable pieces over one big configurable component.
- Preserve behavior over introducing "nice to have" abstractions.
- Don't chase abstract generality the current use cases don't need.

## Contributing

This is a young project and could use your eyes on it — bug reports, questions, and pull requests are all genuinely welcome, including from first-time contributors.

- Found a bug or have a use case that doesn't fit? [Open an issue](../../issues) — even a rough description helps.
- Want to add something? This project intentionally stays small (see [Philosophy](#philosophy)) — open an issue first for anything beyond a bug fix, so we can talk through the approach before you put work into it.
- Have a question, or built something with it? [Start a discussion](../../discussions) — it's genuinely nice to hear about it.

If you find this useful, a star on the repo helps others find it too.

## License

Apache-2.0. See [LICENSE](./LICENSE).
