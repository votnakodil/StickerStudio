import type { HeroBounds } from './useHeroArtworkTransition'

/** Detached cards and unfinished layouts must not become flight endpoints. */
export function hasUsableHeroBounds(bounds: HeroBounds): boolean {
  return Number.isFinite(bounds.left) && Number.isFinite(bounds.top)
    && Number.isFinite(bounds.width) && Number.isFinite(bounds.height)
    && bounds.width > 0 && bounds.height > 0
}
