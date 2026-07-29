# Changelog

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
