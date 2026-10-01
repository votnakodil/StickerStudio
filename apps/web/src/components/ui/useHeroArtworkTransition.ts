import { createContext, useContext, type CSSProperties } from 'react'

export type HeroDirection = 'open' | 'close'
export type HeroBounds = { left: number; top: number; width: number; height: number }
export type HeroElements = {
  artwork: HTMLElement
  surface: HTMLElement
  title: HTMLElement | null
  details?: HTMLElement | null
}
export type HeroSurfaceStyle = Pick<CSSProperties, 'backgroundColor' | 'backgroundImage' | 'backgroundPosition' | 'backgroundSize' | 'borderColor' | 'borderWidth' | 'borderStyle'>
export type HeroTitleStyle = Pick<CSSProperties, 'color' | 'fontFamily' | 'fontSize' | 'fontWeight' | 'letterSpacing' | 'lineHeight'> & { stroke?: string; strokeWidth?: number }
export type HeroTitleGlyph = { text: string; bounds: HeroBounds; baseline: number }
export type HeroSnapshot = {
  artwork: HeroBounds
  surface: HeroBounds
  title?: HeroBounds
  surfaceStyle: HeroSurfaceStyle
  titleStyle?: HeroTitleStyle
  titleText?: string
  titleGlyphs?: HeroTitleGlyph[]
  detailsMarkup?: string
}
export type HeroFlight = {
  id: string
  src: string
  direction: HeroDirection
  from: HeroSnapshot
  to?: HeroSnapshot
  opacity: number
  angle: number
  settled?: boolean
}

export type HeroArtworkContext = {
  flight: HeroFlight | null
  begin: (id: string, src: string, direction: HeroDirection, source: HeroElements, opacity?: number, angle?: number) => void
  landAt: (id: string, direction: HeroDirection, target: HeroElements) => void
}

export const HeroArtworkContextValue = createContext<HeroArtworkContext | null>(null)

export function useHeroArtworkTransition() {
  const context = useContext(HeroArtworkContextValue)
  if (!context) throw new Error('HeroArtworkTransitionProvider is missing')
  return context
}
