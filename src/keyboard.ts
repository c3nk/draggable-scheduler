import type { SchedulerA11yDictionary, SchedulerA11yText, Slot } from './types'
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

export function formatTimeOfDay(minute: number, timeFormat: '12h' | '24h' = '24h'): string {
  const hours24 = Math.floor(minute / 60)
  const minutes = String(minute % 60).padStart(2, '0')
  if (timeFormat === '12h') {
    const period = hours24 < 12 ? 'AM' : 'PM'
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
    return `${hours12}:${minutes} ${period}`
  }
  return `${String(hours24).padStart(2, '0')}:${minutes}`
}

const DEFAULT_A11Y_DICTIONARIES: Record<'en' | 'tr', SchedulerA11yDictionary> = {
  en: {
    gridLabel: 'Scheduler grid',
    gridInstructions: 'Use arrow keys to move between slots. Press Enter or Space to request placement. Press Escape to clear selection.',
    slotAvailable: 'available',
    slotOccupied: 'occupied',
    slotWarning: 'warning',
    slotConflict: 'conflict',
    selectionRequired: 'Select an event first.',
    selectionCleared: 'Selection cleared.',
    placementRequested: 'Placement requested.',
    removeRequested: 'Removal requested.',
    focusMoved: 'Focus moved.',
  },
  tr: {
    gridLabel: 'Zamanlama tablosu',
    gridInstructions: 'Slotlar arasında gezinmek için ok tuşlarını kullanın. Yerleştirme istemek için Enter veya Space tuşuna basın. Seçimi temizlemek için Escape tuşuna basın.',
    slotAvailable: 'boş',
    slotOccupied: 'dolu',
    slotWarning: 'uyarı',
    slotConflict: 'çakışma',
    selectionRequired: 'Önce bir öğe seçin.',
    selectionCleared: 'Seçim temizlendi.',
    placementRequested: 'Yerleştirme istendi.',
    removeRequested: 'Kaldırma istendi.',
    focusMoved: 'Odak taşındı.',
  },
}

function getDefaultA11yDictionary(locale: 'en' | 'tr'): SchedulerA11yDictionary {
  return DEFAULT_A11Y_DICTIONARIES[locale]
}

function createA11yTextFromDictionary(dictionary: SchedulerA11yDictionary, slotLabelPrefix: string): SchedulerA11yText {
  return (key, context) => {
    if (key === 'slotLabel') {
      const parts = [
        slotLabelPrefix,
        context?.dayLabel ? String(context.dayLabel) : null,
        context?.resourceLabel ? String(context.resourceLabel) : null,
        context?.range ? String(context.range) : null,
        context?.status ? String(context.status) : null,
        context?.selected ? 'selected' : null,
      ].filter(Boolean)
      return parts.join(', ')
    }
    return dictionary[key] ?? 'slot'
  }
}

export function createSchedulerA11yText(
  locale: 'en' | 'tr',
  overrides: SchedulerA11yDictionary = {},
): SchedulerA11yText {
  const slotLabelPrefix = locale === 'tr' ? 'Hücre' : 'Slot'
  return createA11yTextFromDictionary(
    {
      ...getDefaultA11yDictionary(locale),
      ...overrides,
    },
    slotLabelPrefix,
  )
}

export function buildSlotA11yLabel(input: {
  slot: Slot
  status: string
  selected: boolean
  occupied: boolean
  timeFormat?: '12h' | '24h'
  a11yText?: SchedulerA11yText
}): string {
  const a11yText = input.a11yText ?? createSchedulerA11yText('en')
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
    range: `${formatTimeOfDay(input.slot.startMinute, input.timeFormat)}-${formatTimeOfDay(input.slot.endMinute, input.timeFormat)}`,
    status: statusText,
    selected: selectionText,
  })
}

export function getDefaultA11yText(): SchedulerA11yText {
  return createSchedulerA11yText('en')
}
