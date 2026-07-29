// Generic scheduling model — the public shape of draggable-scheduler.
//
// No domain concepts (course, instructor, room, campus, semester, faculty, department, or any
// other business vocabulary) appear here. Anything domain-specific lives in the opaque `data`
// bag on Resource<TData>/SchedulerEvent<TData> — the host application supplies TData and reads
// it back in its own rendering (see `renderEventCard` in SchedulerGrid.tsx). This keeps the
// library usable for universities, meeting rooms, hospitals, manufacturing shifts, equipment
// booking, sports facilities, or any other weekday/time-slot resource-scheduling UI.
//
// The model is intentionally a recurring weekly grid (weekday + minute-of-day), not an absolute
// date/timezone calendar — that's what every current consumer needs, and it keeps the library
// small. Absolute-date scheduling would be a separate, later addition, not a v1 requirement.

export interface Resource<TData = unknown> {
  id: string
  label: string
  data?: TData
}

export interface SchedulerEvent<TData = unknown> {
  id: string
  durationMinutes: number
  label?: string
  data?: TData
}

export interface SchedulerConfig {
  workDays: number[]
  weekStartDay: number
  workStartMinute: number
  workEndMinute: number
  slotStepMinutes: number
}

export interface EventPlacement {
  eventId: string
  resourceId: string
  weekday: number
  startMinute: number
}

export interface Slot {
  id: string
  weekday: number
  resourceId: string
  resourceLabel: string
  startMinute: number
  endMinute: number
  dayLabel: string
}

export interface DragEventData {
  eventId: string
  slotId?: string
}

export type SlotStatus = 'idle' | 'available' | 'warning' | 'conflict'
