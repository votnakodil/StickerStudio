"use client";

// Adapted from BeUI Radio Group (MIT): https://beui.dev/r/radio/raw
import { MotionConfig, motion, useReducedMotion } from 'motion/react'
import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'
import { SPRING_LAYOUT, SPRING_PRESS } from '@/shared/lib/motion'
import { cn } from '@/shared/lib/classNames'
import styles from './RadioGroup.module.css'

type RadioContextValue = { value: string; setValue: (value: string) => void; layoutId: string }
const RadioContext = createContext<RadioContextValue | null>(null)

export interface RadioGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: ReactNode
  orientation?: 'vertical' | 'horizontal'
}

export function RadioGroup({ value, defaultValue = '', onValueChange, children, className, orientation = 'vertical', onKeyDown, ...rest }: RadioGroupProps) {
  const [internal, setInternal] = useState(defaultValue)
  const layoutId = useId()
  const reducedMotion = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const controlled = value !== undefined
  const current = controlled ? value : internal
  const setValue = useCallback((next: string) => {
    if (!controlled) setInternal(next)
    onValueChange?.(next)
  }, [controlled, onValueChange])
  const context = useMemo(() => ({ value: current, setValue, layoutId }), [current, setValue, layoutId])
  useLayoutEffect(() => {
    const items = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)') ?? [])
    const active = items.find(item => item.getAttribute('aria-checked') === 'true') ?? items[0]
    items.forEach(item => { item.tabIndex = item === active ? 0 : -1 })
  }, [current, children])
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented) return
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'))
    const index = items.findIndex(item => item === event.target)
    if (index < 0 || !items.length) return
    const next = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (index + 1) % items.length
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : -1
    if (next < 0) return
    event.preventDefault()
    items[next].focus()
    items[next].click()
  }
  return <MotionConfig transition={reducedMotion ? { duration: 0 } : SPRING_LAYOUT}>
    <RadioContext.Provider value={context}>
      <div {...rest} ref={root} role="radiogroup" aria-orientation={orientation} className={cn(styles.group, className)} data-orientation={orientation} onKeyDown={handleKeyDown}>{children}</div>
    </RadioContext.Provider>
  </MotionConfig>
}

export interface RadioGroupItemProps {
  value: string
  label?: string
  description?: ReactNode
  disabled?: boolean
  className?: string
  id?: string
}

export function RadioGroupItem({ value, label, description, disabled, className, id: idProp }: RadioGroupItemProps) {
  const context = useContext(RadioContext)
  if (!context) throw new Error('RadioGroupItem must be used inside RadioGroup')
  const autoId = useId()
  const id = idProp ?? autoId
  const labelId = `${id}-label`, descriptionId = `${id}-description`
  const reducedMotion = useReducedMotion()
  const selected = context.value === value
  return <label htmlFor={id} className={cn(styles.item, disabled && styles.disabled, className)}>
    <motion.button id={id} type="button" role="radio" aria-checked={selected} aria-labelledby={label ? labelId : undefined} aria-label={label ? undefined : value} aria-describedby={description ? descriptionId : undefined} disabled={disabled} tabIndex={selected ? 0 : -1} onClick={() => context.setValue(value)} whileTap={reducedMotion || disabled ? undefined : { scale: 0.92 }} transition={SPRING_PRESS} data-state={selected ? 'checked' : 'unchecked'} className={styles.control}>
      {selected && <motion.span layoutId={context.layoutId} className={styles.indicator} transition={reducedMotion ? { duration: 0 } : SPRING_LAYOUT} />}
    </motion.button>
    {(label || description) && <span className={styles.content}>
      {label && <span id={labelId} className={styles.label}>{label}</span>}
      {description && <span id={descriptionId} className={styles.description}>{description}</span>}
    </span>}
  </label>
}
