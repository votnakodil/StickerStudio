import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/classNames'
import styles from './EmptyView.module.css'

interface EmptyViewProps {
  icon: ReactNode
  title: string
  subtitle: string
  action?: ReactNode
  theme?: 'default' | 'dark'
  className?: string
}

export function EmptyView({ icon, title, subtitle, action, theme = 'default', className }: EmptyViewProps) {
  return (
    <div className={cn(styles.root, theme === 'dark' && styles.dark, className)}>
      <span className={styles.icon} aria-hidden="true">{icon}</span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.subtitle}>{subtitle}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
