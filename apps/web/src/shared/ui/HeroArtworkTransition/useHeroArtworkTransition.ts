import { createContext, useContext, type CSSProperties } from 'react'

export type HeroDirection = 'open' | 'close'
export type HeroBounds = { left: number; top: number; width: number; height: number }
export type HeroElements = {
  artwork: HTMLElement
  previewTexture?: HTMLCanvasElement
  dissolveOnLanding?: boolean
  surface: HTMLElement
  title: HTMLElement | null
  details?: HTMLElement | null
  border?: SVGSVGElement | null
}
export type HeroSurfaceStyle = Pick<CSSProperties, 'backgroundColor' | 'backgroundImage' | 'backgroundPosition' | 'backgroundSize' | 'borderColor' | 'borderWidth' | 'borderStyle'>
export type HeroTitleStyle = Pick<CSSProperties, 'color' | 'fontFamily' | 'fontSize' | 'fontWeight' | 'letterSpacing' | 'lineHeight'> & { stroke?: string; strokeWidth?: number }
export type HeroTitleGlyph = { text: string; bounds: HeroBounds; baseline: number }
export type HeroSnapshot = {
  previewSrc?: string
  artwork: HeroBounds
  border?: { bounds: HeroBounds; markup: string }
  previewTexture?: HTMLCanvasElement
  surface: HeroBounds
  title?: HeroBounds
  surfaceStyle: HeroSurfaceStyle
  titleStyle?: HeroTitleStyle
  titleText?: string
  titleGlyphs?: HeroTitleGlyph[]
  titleTexture?: { source: HTMLCanvasElement; style: CSSProperties }
  textTexture?: { source: HTMLCanvasElement; style: CSSProperties }
  artworkTexture?: { source: HTMLCanvasElement; style: CSSProperties }
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
  ready?: boolean
  startTime?: CSSNumberish | null
  loading?: boolean
  settled?: boolean
  dissolveOnLanding?: boolean
}

export type HeroArtworkContext = {
  flight: HeroFlight | null
  cancelFlight: (id: string) => void
  begin: (id: string, src: string, direction: HeroDirection, source: HeroElements, opacity?: number, angle?: number, loading?: boolean, destination?: HeroBounds, startTime?: CSSNumberish | null) => void
  landAt: (id: string, direction: HeroDirection, target: HeroElements, ready?: boolean) => void
}

export const HeroArtworkContextValue = createContext<HeroArtworkContext | null>(null)

export function useHeroArtworkTransition() {
  const context = useContext(HeroArtworkContextValue)
  if (!context) throw new Error('HeroArtworkTransitionProvider is missing')
  return context
}
