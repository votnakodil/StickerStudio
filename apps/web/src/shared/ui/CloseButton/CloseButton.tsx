import { forwardRef } from 'react'
import { IconXmark } from 'symbols-react'
import { Button, type ButtonProps } from '@/shared/ui/Button/Button'
import { cn } from '@/shared/lib/classNames'
import styles from './CloseButton.module.css'

export const CloseButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'children'>>(function CloseButton(
  { className, 'aria-label': label = 'Close', ...props }, ref,
) {
  return <Button ref={ref} variant="ghost" size="icon" className={cn(styles.button, className)} aria-label={label} {...props}>
    <IconXmark width={12} height={12} fill="currentColor" aria-hidden="true" />
  </Button>
})
