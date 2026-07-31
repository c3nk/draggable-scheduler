// draggable-scheduler — DefaultEventCard: a composable, batteries-included card
// for a placed event. It ships the UI *affordances* a scheduler needs — a drag
// handle, a remove (delete) icon, a selection frame and a duration badge — while
// leaving the domain content (a course code, an instructor, a shift name, …) to
// the host, passed in as `children`. This keeps the "just import it and it
// works" path usable without giving up the host's own field rendering.
//
// It is entirely optional: SlotCell/SchedulerTimeGrid fall back to it only when
// no `renderEventCard` prop is supplied. Every affordance is toggleable
// (`showDragHandle`, `showRemove`, `showDuration`) and every icon is overridable
// (`renderDragHandle`, `renderRemoveIcon`). Icons are inline SVG — no icon
// dependency is added to consumers.
//
// When `draggable` is true (the default) the card wires `@dnd-kit/core`'s
// `useDraggable` itself, so the bundled card is draggable out of the box. Set
// `draggable={false}` for a static card (e.g. read-only views), which also skips
// the dnd-kit registration entirely.

import { type CSSProperties, type ReactNode } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { SchedulerEvent } from './types'

type Tx = (tr: string, en: string) => string

const defaultTx: Tx = (_tr, en) => en

export interface DefaultEventCardProps<TEvent extends SchedulerEvent<unknown>> {
  event: TEvent
  selected?: boolean
  /** Wire dnd-kit's useDraggable so the card is draggable on its own. Default: true. */
  draggable?: boolean
  /** What starts a drag: the whole card ('card', default) or only the grip handle ('handle'). */
  dragActivator?: 'card' | 'handle'
  tx?: Tx
  /** Override the auto-formatted duration badge text. */
  durationLabel?: string
  /** Show the duration badge. Default: true. */
  showDuration?: boolean
  /** Show the remove (delete) icon button. Default: true (when onRemove is given). */
  showRemove?: boolean
  /** Show the drag handle. Default: true (only meaningful when draggable). */
  showDragHandle?: boolean
  onSelect?: (eventId: string | null) => void
  onRemove?: () => void
  renderDragHandle?: () => ReactNode
  renderRemoveIcon?: () => ReactNode
  /** Host-owned domain content (course code, instructor, room hint, …). */
  children?: ReactNode
  className?: string
}

export function formatDurationLabel(durationMinutes: number, tx: Tx = defaultTx): string {
  if (durationMinutes <= 0) return ''
  const hours = Math.floor(durationMinutes / 60)
  const minutes = durationMinutes % 60
  if (hours === 0) return `${minutes}${tx(' dk', ' min')}`
  if (minutes === 0) return `${hours}${tx(' sa', ' h')}`
  return `${hours}${tx(' sa', ' h')} ${minutes}${tx(' dk', ' min')}`
}

function DragHandleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false" fill="currentColor">
      <circle cx="4" cy="2.5" r="1" />
      <circle cx="8" cy="2.5" r="1" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="8" cy="6" r="1" />
      <circle cx="4" cy="9.5" r="1" />
      <circle cx="8" cy="9.5" r="1" />
    </svg>
  )
}

function RemoveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M2.5 3.5h9" />
      <path d="M5.5 3.5V2.4h3v1.1" />
      <path d="M3.6 3.5l.5 8h5.8l.5-8" />
      <path d="M6 6v4M8 6v4" />
    </svg>
  )
}

function CardChrome<TEvent extends SchedulerEvent<unknown>>({
  event,
  selected,
  tx,
  durationLabel,
  showDuration,
  showRemove,
  showDragHandle,
  draggable,
  onRemove,
  renderDragHandle,
  renderRemoveIcon,
  children,
  className,
  dragActivator,
  dragHandleProps,
  rootDragProps,
  cardRef,
  cardStyle,
  dragging,
}: DefaultEventCardProps<TEvent> & {
  dragHandleProps?: Record<string, unknown>
  rootDragProps?: Record<string, unknown>
  cardRef?: (node: HTMLElement | null) => void
  cardStyle?: CSSProperties
  dragging?: boolean
}) {
  const resolvedTx = tx ?? defaultTx
  const duration = durationLabel ?? formatDurationLabel(event.durationMinutes, resolvedTx)
  const isDraggable = draggable !== false
  const showHandle = isDraggable && showDragHandle !== false
  const showRemoveButton = showRemove !== false && typeof onRemove === 'function'
  // By default the whole card is the drag activator (matching a typical card UX);
  // set dragActivator="handle" to require grabbing the grip.
  const grabWholeCard = isDraggable && dragActivator !== 'handle'
  return (
    <div
      ref={cardRef}
      style={cardStyle}
      className={[
        'scheduler-event-card rounded-lg border p-2 shadow-sm transition',
        selected ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-800',
        grabWholeCard ? 'cursor-grab' : '',
        dragging ? 'opacity-60' : '',
        className ?? '',
      ].join(' ')}
      {...(grabWholeCard ? (rootDragProps ?? {}) : {})}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1.5">
          {showHandle ? (
            <span
              className={`scheduler-drag-handle text-slate-400 hover:text-slate-600 ${grabWholeCard ? '' : 'cursor-grab'}`}
              aria-label={resolvedTx('Taşı', 'Move')}
              title={resolvedTx('Sürükleyerek taşı', 'Drag to move')}
              {...(grabWholeCard ? {} : (dragHandleProps ?? {}))}
            >
              {renderDragHandle ? renderDragHandle() : <DragHandleIcon />}
            </span>
          ) : null}
          <div className="min-w-0">
            {children ?? <span className="text-sm font-semibold">{event.label ?? event.id}</span>}
          </div>
        </div>
        {showRemoveButton ? (
          <button
            type="button"
            className="scheduler-remove-button shrink-0 rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 hover:text-rose-600"
            aria-label={resolvedTx('Kaldır', 'Remove')}
            title={resolvedTx('Kaldır', 'Remove')}
            onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
            onClick={(clickEvent) => {
              clickEvent.stopPropagation()
              onRemove?.()
            }}
          >
            {renderRemoveIcon ? renderRemoveIcon() : <RemoveIcon />}
          </button>
        ) : null}
      </div>
      {showDuration !== false && duration ? (
        <div className="mt-1 text-[10px] font-semibold text-slate-500">{duration}</div>
      ) : null}
    </div>
  )
}

function DraggableCard<TEvent extends SchedulerEvent<unknown>>(props: DefaultEventCardProps<TEvent>) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: props.event.id,
    data: { eventId: props.event.id },
  })
  const cardStyle: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
  }
  // Same activator props either way; CardChrome decides whether they land on the
  // card root (whole-card drag, default) or on the grip handle.
  const dragProps = { ...attributes, ...listeners }
  return (
    <CardChrome
      {...props}
      cardRef={setNodeRef}
      cardStyle={cardStyle}
      dragging={isDragging}
      rootDragProps={dragProps}
      dragHandleProps={dragProps}
    />
  )
}

export function DefaultEventCard<TEvent extends SchedulerEvent<unknown>>(props: DefaultEventCardProps<TEvent>) {
  // Selection is a plain click; keyboard selection/placement is owned by the grid
  // cell (Enter/Space on the focused slot), so the card stays a non-focusable
  // click target and avoids nesting interactive controls inside a button.
  return (
    <div onClick={() => props.onSelect?.(props.event.id)}>
      {props.draggable === false ? <CardChrome {...props} /> : <DraggableCard {...props} />}
    </div>
  )
}
