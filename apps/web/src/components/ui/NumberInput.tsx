import { useState } from 'react'

export function NumberInput({ value, min, max, onValueChange, ariaLabel, readOnly = false }: {
  value: number
  min: number
  max: number
  onValueChange: (value: number) => void
  readOnly?: boolean
  ariaLabel: string
}) {
  const [draft, setDraft] = useState<string | null>(null)

  return <input type="number" inputMode="numeric" min={min} max={max} step={1}
    readOnly={readOnly} aria-disabled={readOnly || undefined} aria-label={ariaLabel} value={draft ?? String(value)}
    onFocus={(event) => setDraft(event.currentTarget.value)}
    onChange={(event) => setDraft(event.currentTarget.value)}
    onBlur={(event) => {
      const raw = event.currentTarget.value.trim()
      const next = Number(raw)
      if (raw && Number.isFinite(next)) {
        const normalized = Math.min(max, Math.max(min, Math.round(next)))
        if (normalized !== value) onValueChange(normalized)
      }
      setDraft(null)
    }}
    onKeyDown={(event) => {
      if (event.key !== 'Enter' && event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') event.currentTarget.value = String(value)
      event.currentTarget.blur()
    }}
  />
}
