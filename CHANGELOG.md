# Changelog

## 0.2.0 - 2026-07-31

Generic API cleanup + batteries-included UI. **Breaking** — grid prop names moved from `course` to `event` vocabulary.

### Added

- `<Scheduler>` — a batteries-included wrapper that owns the `DndContext`, sensors, 3-tier collision detection and drag-end → slot resolution. Wire business rules through `onBeforeMove(eventId, target) → DropEvaluation` (sync or `Promise`), `onEventMove`, `onEventRemove`, and `onConvertSharedSlotToSwap`.
- `DefaultEventCard` — a composable, draggable default card shipping the UI affordances (drag/move handle, remove/delete icon, selection frame, duration badge) with inline SVG icons and zero icon dependency. Domain content is passed as `children`; every affordance is toggleable and every icon overridable.
- `schedulerCollisionDetection` — the `pointerWithin → rectIntersection → closestCenter` strategy, exported for low-level consumers.
- `formatDurationLabel`, `formatTimeOfDay`, `DropTarget`, `DropEvaluation`, `SchedulerProps`, `DefaultEventCardProps` exports.
- `renderEventCard` is now **optional** on `SchedulerTimeGrid`/`SlotCell` — it falls back to `DefaultEventCard`.
- Real 12h/24h support: `timeFormat` on `<Scheduler>` (and `SchedulerTimeGrid`) now drives the time-axis labels and the screen-reader slot ranges via the new `formatTimeOfDay` helper.
- `DefaultEventCard` `dragActivator` prop (`'card'` default, or `'handle'`): the whole card is draggable by default, matching typical card UX; the grip stays a visual cue. `<Scheduler>`'s pointer sensor uses a 4px activation distance so a plain click still selects.
- `renderRowLabel?(row)` on `SchedulerTimeGrid`/`<Scheduler>` to customize the time-axis label cell (e.g. a vertical `writing-mode` label), defaulting to a plain horizontal label.
- `<Scheduler>` now covers the richer host flows too: an `onRequireEventSelection` prop (fires when a click/keyboard placement is attempted with nothing selected), and `DropTarget` gained `forceSharedSlot` (Shift held during drag/click) and `occupantEventIds` (events already in the target slot) so the host can decide move-vs-swap and shared-slot placement from `onBeforeMove`/`onEventMove` without inspecting placements itself.

### Changed

- **Breaking:** `SchedulerTimeGrid`/`SlotCell` props renamed from `course` to generic `event` vocabulary: `selectedCourseId → selectedEventId`, `startCourseBySlot → startEventBySlot`, `occupyingCourseBySlot → occupyingEventBySlot`, `onSelectCourse → onSelectEvent`, `onRemoveCourse → onRemoveEvent`, `onRequireCourseSelection → onRequireEventSelection`, `onAttemptPlaceCourse({ courseId }) → onAttemptPlaceEvent({ eventId })`. The `resolveOverSlotId` debug payload field `inferredCourseId → inferredEventId`.
- Genericized the built-in default copy strings (removed "course"/"room"/"classroom" domain wording).
- **Breaking:** `buildSlots` no longer accepts `timeFormat` — it never used it (slots carry no time-of-day label). Time formatting now lives where labels are actually produced (`<Scheduler>` rows / `formatTimeOfDay`).

### Fixed

- `browserslist` used an invalid query `last 2 iOS Safari versions` (the canonical browserslist name is `iOS`), which broke any consumer whose autoprefixer processed the bundled `dist/style.css` ("Unknown browser query"). Changed to `last 2 iOS versions`.
- Bundled `style.css` was missing `text-slate-700`, `mb-2` and `leading-tight`; added them plus the classes the new default card needs. `scripts/build-style.mjs` now verifies every utility class used by components exists in the stylesheet and fails the build otherwise, so this can't silently drift again.
- Roving-tabindex initial focus now scans the whole slot matrix instead of only the first row, so a leading empty row no longer makes every cell tabbable.

## 0.1.2 - 2026-07-31

Generic accessibility text helper release.

### Added

- `createSchedulerA11yText(locale, overrides)` for locale-aware generic screen reader copy with optional overrides.
- Exported `SchedulerA11yDictionary` and the new accessibility helper from the package entrypoint.
- Keyboard accessibility docs showing how to customize generic a11y wording without rewriting the whole dictionary.

### Changed

- Bumped package version to `0.1.2` for the new public API surface.

## 0.1.1 - 2026-07-29

Patch release for npm republish.

### Changed

- Bumped package version to `0.1.1` so the package can be published after `0.1.0` was already released to npm.

## 0.1.0 - 2026-07-29

Initial public release of `draggable-scheduler`.

### Added

- Headless weekly resource-scheduling grid for React built on `@dnd-kit/core`.
- Generic models for `Resource<TData>`, `SchedulerEvent<TData>`, `EventPlacement`, `Slot`, `SchedulerConfig`, `DragEventData`, and `SlotStatus`.
- Core grid helpers:
  - `buildSlots`
  - `buildOrderedWeekdays`
  - `buildStartIndex`
  - `buildOccupyingIndex`
  - `resolveOverSlotId`
  - `isOverlap`
  - `clonePlacements`
  - `isSamePlacement`
  - `extractEventId`
  - `resolveSlotClassName`
  - `formatWeekday`
- Generic `usePlacementHistory` hook for in-memory placement undo/redo-style snapshots.
- Generic `PresetToolbar<TState>` and `Preset<TState>` model for host-managed preset state.
- Precompiled bundled stylesheet at `draggable-scheduler/style.css`.
- `examples/basic` demo showing how to wire the grid into a consuming app.
- Unit tests for helpers, history, and preset toolbar behavior.

### Notes

- The package stays headless and does not own persistence, validation, or business rules.
- Styling is shipped as a standalone CSS file so consumers do not need Tailwind just to render the default grid look.
