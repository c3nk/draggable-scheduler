# draggable-scheduler

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![npm version](https://img.shields.io/npm/v/draggable-scheduler.svg)](https://www.npmjs.com/package/draggable-scheduler)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

A headless(-ish), drag-and-drop weekly resource-scheduling grid for React, built on [`@dnd-kit/core`](https://dndkit.com/).

It renders a weekday x resource grid of time slots, lets users drag events between slots, and notifies your app of what happened — nothing more. It never decides whether a move or swap is *allowed*; your app does that and tells the grid the answer.

Useful for university timetables, meeting room booking, hospital shift/resource scheduling, manufacturing scheduling, employee shifts, equipment booking, sports facility booking, or any other weekday/time-slot resource-scheduling UI.

Originally developed for and used in production by [Plansoar](https://plansoar.com), maintained by [c3nk](https://c3nk.com).

## Why

Most scheduling UI libraries try to own your business rules — conflict detection, validation, persistence — bundled with the rendering. That coupling is exactly what makes them hard to adapt: your conflict rules are never quite the library's conflict rules.

`draggable-scheduler` takes the opposite approach: it only renders, drags, scrolls, and selects. It notifies your app via callbacks (`onEventMove`, `onBeforeMove`, `onSelectionChange`, ...) and your app decides everything else. This keeps the library small, predictable, and usable well outside its original domain.

## Features

- Weekday x resource grid rendering with a customizable time axis
- Drag-and-drop event placement via `@dnd-kit/core`
- Slot selection, shared-slot ("double-booked") indication, and swap-candidate detection
- A `renderEventCard` escape hatch — you fully control how a placed event looks and whether/how it's draggable
- Zero business logic: no conflict detection, no persistence, no fetching, no opinions about your domain
- A generic `Resource<TData>`/`SchedulerEvent<TData>` model — attach any data shape and read it back in your own rendering

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
import { useState } from 'react'
import { DndContext } from '@dnd-kit/core'
import {
  SchedulerTimeGrid,
  PresetToolbar,
  buildSlots,
  buildStartIndex,
  buildOccupyingIndex,
  usePlacementHistory,
} from 'draggable-scheduler'
import 'draggable-scheduler/style.css'
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
  const history = usePlacementHistory(placements)
  const [activePresetId, setActivePresetId] = useState<string | null>('all')

  const presets = [
    { id: 'all', label: 'All', state: { view: 'all' }, description: 'Show everything' },
    { id: 'today', label: 'Today', state: { view: 'today' }, description: 'Show today only' },
  ]

  const config = { workDays: [1, 2, 3, 4, 5], weekStartDay: 1, workStartMinute: 8 * 60, workEndMinute: 18 * 60, slotStepMinutes: 30 }
  const slots = buildSlots({ config, resources, locale: 'en', timeFormat: '24h' })
  const eventsBySlot = buildStartIndex({ events, placements, slots })
  const occupyingBySlot = buildOccupyingIndex({ events, placements, slots })

  return (
    <>
      <PresetToolbar
        tx={(_tr, en) => en}
        presets={presets}
        activePresetId={activePresetId}
        onPresetSelect={(preset) => {
          setActivePresetId(preset.id)
          // your app decides how to apply preset.state
        }}
        onClearSelection={() => setActivePresetId(null)}
      />

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
            history.setPlacements((current) => ({
              ...current,
              [input.courseId]: { eventId: input.courseId, resourceId: 'room-1', weekday: 1, startMinute: 9 * 60 },
            }))
          }}
        />
      </DndContext>
    </>
  )
}
```

A fuller worked example lives in [`examples/basic/BasicSchedulerExample.tsx`](./examples/basic/BasicSchedulerExample.tsx).

The package ships a precompiled stylesheet at `draggable-scheduler/style.css`, which you should import once in your app if you want the grid to render with the bundled defaults.

## Browser Support

`draggable-scheduler` is supported on the latest two stable versions of Chrome, Edge, Firefox, Safari, and iOS Safari.

The published package targets these browsers in `package.json` via `browserslist`, and the support matrix is covered by tests so it does not drift accidentally.

## Public API

```
Resource<TData>, SchedulerEvent<TData>, EventPlacement, Slot, SchedulerConfig, DragEventData, SlotStatus

SchedulerTimeGrid<TEvent>   — the grid itself (time axis + resource columns + slot cells)
SlotCell<TEvent>            — a single droppable cell (used internally by SchedulerTimeGrid)

buildSlots, buildOrderedWeekdays, buildStartIndex, buildOccupyingIndex, resolveOverSlotId
isOverlap, clonePlacements, isSamePlacement, extractEventId, resolveSlotClassName, formatWeekday
usePlacementHistory, createPlacementHistory, setPlacementHistory, undoPlacementHistory, clearPlacementHistory
Preset<TState>, PresetToolbar
```

Everything about *why* a move is allowed, *what* a conflict means, and *how* it's persisted is your application's job. This library renders, drags, scrolls, and selects — it notifies you via callbacks and never makes a business decision on its own.

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
