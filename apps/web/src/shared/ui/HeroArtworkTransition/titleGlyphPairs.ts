import type { HeroTitleGlyph } from './useHeroArtworkTransition'

/** Preserve both titles when an edited canvas name differs from its library label. */
export function pairTitleGlyphs(from: readonly HeroTitleGlyph[] = [], to: readonly HeroTitleGlyph[] = []) {
  const pairs: { sourceGlyph: HeroTitleGlyph; targetGlyph: HeroTitleGlyph }[] = []
  for (let index = 0; index < Math.max(from.length, to.length); index++) {
    const reference = from[index] ?? to[index]
    if (!reference) continue
    pairs.push({
      sourceGlyph: from[index] ?? { ...reference, text: '' },
      targetGlyph: to[index] ?? { ...reference, text: '' },
    })
  }
  return pairs
}
