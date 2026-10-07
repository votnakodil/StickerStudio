import { useId, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'
import { Flipped, Flipper } from 'react-flip-toolkit'
import { SPRING_EXPORT_COLLAPSE } from '@/shared/lib/motion'
import { cn } from '@/shared/lib/classNames'
import styles from './GridList.module.css'

export type GridListLayout = 'grid' | 'list'

export interface GridListRenderContext {
  layout: GridListLayout
  flipId: string
}

export interface GridListProps<T> {
  items: readonly T[]
  getKey: (item: T) => string
  renderItem: (item: T, context: GridListRenderContext) => ReactNode
  layout: GridListLayout
  trailingItem?: (context: GridListRenderContext) => ReactNode
  label?: string
  className?: string
}

// FLIP uses unit mass; normalize the Export collapse spring to match its motion.
const layoutSpring = {
  stiffness: SPRING_EXPORT_COLLAPSE.stiffness / SPRING_EXPORT_COLLAPSE.mass,
  damping: SPRING_EXPORT_COLLAPSE.damping / SPRING_EXPORT_COLLAPSE.mass,
}

// Uses Alex Holachek's MIT-licensed List Transitions FLIP pattern:
// https://github.com/aholachek/react-flip-toolkit#list-transitions
export function GridList<T>({ items, getKey, renderItem, layout, trailingItem, label = 'Cards', className }: GridListProps<T>) {
  const scope = useId()
  const reduceMotion = useReducedMotion()
  const flipKey = JSON.stringify([layout, items.map(getKey)])
  return <section aria-label={label} className={className} data-grid-list-layout={layout}>
    <Flipper flipKey={reduceMotion ? 'reduced' : flipKey} spring={layoutSpring}>
      <div className={cn(styles.collection, layout === 'list' && styles.list)}>
        {items.map(item => {
          const key = getKey(item)
          const flipId = `${scope}-${key}`
          return <Flipped key={key} flipId={flipId} stagger={false} shouldFlip={() => !reduceMotion}>
            <div className={styles.item} data-grid-list-item={key}>
              <div className={styles.content}>{renderItem(item, { layout, flipId })}</div>
            </div>
          </Flipped>
        })}
        {trailingItem && <Flipped flipId={`${scope}-trailing`} shouldFlip={() => !reduceMotion}>
          <div className={styles.trailing}>
            <div className={styles.content}>{trailingItem({ layout, flipId: `${scope}-trailing` })}</div>
          </div>
        </Flipped>}
      </div>
    </Flipper>
  </section>
}
