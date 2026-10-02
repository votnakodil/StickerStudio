import { Link, type LinkProps } from 'react-router-dom'
import { IconChevronLeft } from 'symbols-react'
import { Button, type ButtonProps } from '@/shared/ui/Button/Button'
import { cn } from '@/shared/lib/classNames'
import styles from './BackButton.module.css'

type BackButtonProps = ((Omit<ButtonProps, 'children'> & { to?: never }) | Omit<LinkProps, 'children'>) & { appearance?: 'plain' | 'circle' }

export function BackButton({ appearance = 'plain', ...props }: BackButtonProps) {
  const className = cn(styles.button, appearance === 'circle' && styles.circle, props.className)
  const icon = <IconChevronLeft width={13} height={17} fill="currentColor" aria-hidden="true" />
  if (props.to !== undefined) {
    return <Link {...props} className={cn(className, styles.link)} aria-label={props['aria-label'] ?? 'Back'}>{icon}</Link>
  }
  return <Button variant="ghost" size="icon" pressScale={0.95} {...props} className={className} aria-label={props['aria-label'] ?? 'Back'}>{icon}</Button>
}
