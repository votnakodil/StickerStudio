import { IconSquareAndArrowUp, IconXmark } from 'symbols-react'

export function ExportToggleIcon({ open }: { open: boolean }) {
  return open
    ? <IconXmark width={14} height={14} fill="currentColor" aria-hidden="true" />
    : <IconSquareAndArrowUp width={16} height={20} fill="currentColor" aria-hidden="true" />
}
