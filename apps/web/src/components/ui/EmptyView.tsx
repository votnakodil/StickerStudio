import type { ReactNode } from 'react'
import { cn } from './classNames'
import styles from './EmptyView.module.css'

interface EmptyViewProps {
  icon: ReactNode
  title: string
  subtitle: string
  className?: string
}

export function EmptyView({ icon, title, subtitle, className }: EmptyViewProps) {
  return (
    <div className={cn(styles.root, className)}>
      <span className={styles.icon} aria-hidden="true">{icon}</span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.subtitle}>{subtitle}</p>
    </div>
  )
}
