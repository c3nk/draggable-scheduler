import type { ReactNode } from 'react'

export interface Preset<TState> {
  id: string
  label: string
  state: TState
  description?: string
  disabled?: boolean
}

export interface PresetToolbarProps<TState> {
  tx: (tr: string, en: string) => string
  presets: Preset<TState>[]
  activePresetId: string | null
  onPresetSelect: (preset: Preset<TState>) => void
  onClearSelection?: () => void
  title?: string
  emptyMessage?: string
  clearLabel?: string
  renderPresetLabel?: (preset: Preset<TState>) => ReactNode
  renderPresetDescription?: (preset: Preset<TState>) => ReactNode
}

export function PresetToolbar<TState>({
  tx,
  presets,
  activePresetId,
  onPresetSelect,
  onClearSelection,
  title = tx('Hazır görünümler', 'Presets'),
  emptyMessage = tx('Henüz kayıtlı preset yok.', 'No presets available yet.'),
  clearLabel = tx('Temizle', 'Clear'),
  renderPresetLabel,
  renderPresetDescription,
}: PresetToolbarProps<TState>) {
  return (
    <section className="rounded border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {onClearSelection ? (
          <button
            type="button"
            className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            onClick={onClearSelection}
          >
            {clearLabel}
          </button>
        ) : null}
      </div>
      {presets.length === 0 ? (
        <p className="text-xs text-slate-500">{emptyMessage}</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {presets.map((preset) => {
            const isActive = activePresetId === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                disabled={preset.disabled}
                className={[
                  'rounded-md border px-2 py-1 text-left transition',
                  isActive ? 'border-blue-500 bg-blue-100 text-blue-900' : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-50',
                  preset.disabled ? 'opacity-60' : '',
                ].join(' ')}
                onClick={() => onPresetSelect(preset)}
              >
                <div className="text-sm font-semibold">{renderPresetLabel ? renderPresetLabel(preset) : preset.label}</div>
                {preset.description ? (
                  <div className="mt-1 text-[11px] text-slate-500">
                    {renderPresetDescription ? renderPresetDescription(preset) : preset.description}
                  </div>
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
