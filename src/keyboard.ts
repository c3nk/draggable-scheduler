import type { SchedulerA11yKey, SchedulerA11yText, Slot } from './types'
import type { SchedulerTimeGridColumn, SchedulerTimeGridRow } from './SchedulerGrid'

export interface SlotMatrixPosition {
  rowIndex: number
  columnIndex: number
}

export interface SlotMatrix {
  cells: Array<Array<Slot | null>>
  positionBySlotId: Map<string, SlotMatrixPosition>
}

export function buildSlotMatrix(input: {
  visibleColumns: SchedulerTimeGridColumn[]
  timeRows: SchedulerTimeGridRow[]
  slotByGrid: Map<string, Slot>
}): SlotMatrix {
  const cells: Array<Array<Slot | null>> = []
  const positionBySlotId = new Map<string, SlotMatrixPosition>()
  for (let rowIndex = 0; rowIndex < input.timeRows.length; rowIndex += 1) {
    const row = input.timeRows[rowIndex]
    const rowCells: Array<Slot | null> = []
    for (let columnIndex = 0; columnIndex < input.visibleColumns.length; columnIndex += 1) {
      const column = input.visibleColumns[columnIndex]
      const slot = input.slotByGrid.get(`${column.weekday}-${column.resourceId}-${row.startMinute}`) ?? null
      rowCells.push(slot)
      if (slot) {
        positionBySlotId.set(slot.id, { rowIndex, columnIndex })
      }
    }
    cells.push(rowCells)
  }
  return { cells, positionBySlotId }
}

export function resolveNextSlotId(input: {
  matrix: SlotMatrix
  currentSlotId: string
  key: string
}): string | null {
  const position = input.matrix.positionBySlotId.get(input.currentSlotId)
  if (!position) return null

  const { rowIndex, columnIndex } = position
  const { cells } = input.matrix
  const rowCount = cells.length
  const columnCount = cells[0]?.length ?? 0

  const findSlotInRow = (targetRowIndex: number, startColumnIndex: number, step: 1 | -1): string | null => {
    for (
      let targetColumnIndex = startColumnIndex;
      targetColumnIndex >= 0 && targetColumnIndex < columnCount;
      targetColumnIndex += step
    ) {
      const slot = cells[targetRowIndex]?.[targetColumnIndex] ?? null
      if (slot) return slot.id
    }
    return null
  }

  const findSlotInColumn = (targetColumnIndex: number, startRowIndex: number, step: 1 | -1): string | null => {
    for (
      let targetRow = startRowIndex;
      targetRow >= 0 && targetRow < rowCount;
      targetRow += step
    ) {
      const slot = cells[targetRow]?.[targetColumnIndex] ?? null
      if (slot) return slot.id
    }
    return null
  }

  switch (input.key) {
    case 'ArrowLeft':
      return findSlotInRow(rowIndex, columnIndex - 1, -1)
    case 'ArrowRight':
      return findSlotInRow(rowIndex, columnIndex + 1, 1)
    case 'ArrowUp':
      return findSlotInColumn(columnIndex, rowIndex - 1, -1)
    case 'ArrowDown':
      return findSlotInColumn(columnIndex, rowIndex + 1, 1)
    case 'Home':
      return findSlotInRow(rowIndex, 0, 1)
    case 'End':
      return findSlotInRow(rowIndex, columnCount - 1, -1)
    default:
      return null
  }
}

function formatTime(minuteOfDay: number): string {
  const hours = Math.floor(minuteOfDay / 60)
  const minutes = minuteOfDay % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function defaultA11yText(key: SchedulerA11yKey, context?: Record<string, string | number | boolean | null | undefined>): string {
  if (key === 'gridLabel') {
    return 'Scheduler grid'
  }
  if (key === 'gridInstructions') {
    return 'Use arrow keys to move between slots. Press Enter or Space to request placement. Press Escape to clear selection.'
  }
  if (key === 'slotAvailable') return 'available'
  if (key === 'slotOccupied') return 'occupied'
  if (key === 'slotWarning') return 'warning'
  if (key === 'slotConflict') return 'conflict'
  if (key === 'selectionRequired') return 'Select an event first.'
  if (key === 'selectionCleared') return 'Selection cleared.'
  if (key === 'placementRequested') return 'Placement requested.'
  if (key === 'removeRequested') return 'Removal requested.'
  if (key === 'focusMoved') return 'Focus moved.'

  if (key === 'slotLabel') {
    const parts = [
      'Slot',
      context?.dayLabel ? String(context.dayLabel) : null,
      context?.resourceLabel ? String(context.resourceLabel) : null,
      context?.range ? String(context.range) : null,
      context?.status ? String(context.status) : null,
      context?.selected ? 'selected' : null,
    ].filter(Boolean)
    return parts.join(', ')
  }

  return 'slot'
}

export function buildSlotA11yLabel(input: {
  slot: Slot
  status: string
  selected: boolean
  occupied: boolean
  a11yText?: SchedulerA11yText
}): string {
  const a11yText = input.a11yText ?? defaultA11yText
  const statusText = input.occupied
    ? a11yText('slotOccupied')
    : input.status === 'warning'
      ? a11yText('slotWarning')
      : input.status === 'conflict'
        ? a11yText('slotConflict')
        : a11yText('slotAvailable')
  const selectionText = input.selected ? 'selected' : null
  return a11yText('slotLabel', {
    dayLabel: input.slot.dayLabel,
    resourceLabel: input.slot.resourceLabel,
    range: `${formatTime(input.slot.startMinute)}-${formatTime(input.slot.endMinute)}`,
    status: statusText,
    selected: selectionText,
  })
}

export function getDefaultA11yText(): SchedulerA11yText {
  return defaultA11yText
}
