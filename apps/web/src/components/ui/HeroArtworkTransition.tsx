import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useLocation } from 'react-router-dom'
import {
  HeroArtworkContextValue,
  type HeroBounds,
  type HeroDirection,
  type HeroElements,
  type HeroFlight,
  type HeroSnapshot,
  type HeroTitleGlyph,
} from './useHeroArtworkTransition'

const OPEN_SPRING = { type: 'spring', stiffness: 400, damping: 35, mass: 0.85 } as const
const CLOSE_SPRING = { type: 'spring', stiffness: 220, damping: 27, mass: 0.9 } as const

function boundsOf(element: HTMLElement): HeroBounds {
  const { left, top, width, height } = element.getBoundingClientRect()
  return { left, top, width, height }
}

function svgCharacterScreenY(text: SVGTextElement | null, index: number): number | null {
  if (!text?.isConnected) return null
  // Safari can expose an SVG text node before it has laid out its characters,
  // especially while the editor surface is hidden during a route transition.
  try {
    if (index >= text.getNumberOfChars()) return null
    const matrix = text.getScreenCTM()
    return matrix ? text.getStartPositionOfChar(index).matrixTransform(matrix).y : null
  } catch (error) {
    if (error instanceof DOMException && error.name === 'IndexSizeError') return null
    throw error
  }
}

function titleGlyphsOf(element: HTMLElement): HeroTitleGlyph[] {
  const flyingGlyphs = element.querySelectorAll<HTMLElement>('[data-hero-glyph]')
  if (flyingGlyphs.length) return [...flyingGlyphs].map((glyph) => {
    const text = glyph.querySelector('text')
    const bounds = boundsOf(glyph)
    const screenY = svgCharacterScreenY(text, 0)
    return { text: glyph.dataset.heroGlyph ?? '', bounds,
      baseline: screenY === null ? bounds.height * 0.8 : screenY - bounds.top }
  })
  const glyphs: HeroTitleGlyph[] = []
  const svgText = element.querySelector<SVGTextElement>('svg text')
  const walker = document.createTreeWalker(svgText ?? element, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  const style = getComputedStyle(svgText ?? element)
  const context = document.createElement('canvas').getContext('2d')!
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  const metrics = context.measureText('Mg')
  let characterIndex = 0
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? ''
    for (let index = 0; index < text.length; index++) {
      const glyphIndex = characterIndex++
      if (/\s/.test(text[index])) continue
      range.setStart(node, index)
      range.setEnd(node, index + 1)
      const { left, top, width, height } = range.getBoundingClientRect()
      const screenY = svgCharacterScreenY(svgText, glyphIndex)
      const baseline = screenY !== null
        ? screenY - top
        : (height - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 + metrics.fontBoundingBoxAscent
      glyphs.push({ text: text[index], bounds: { left, top, width, height }, baseline })
    }
  }
  return glyphs
}

function snapshotOf(elements: HeroElements): HeroSnapshot {
  const surface = getComputedStyle(elements.surface)
  const title = elements.title ? getComputedStyle(elements.title) : null
  const svgText = elements.title?.querySelector<SVGTextElement>('svg text')
  const svgStyle = svgText ? getComputedStyle(svgText) : null
  const matrix = svgText?.getScreenCTM()
  return {
    artwork: boundsOf(elements.artwork),
    surface: boundsOf(elements.surface),
    title: elements.title ? boundsOf(elements.title) : undefined,
    surfaceStyle: {
      backgroundColor: surface.backgroundColor,
      backgroundImage: surface.backgroundImage,
      backgroundPosition: surface.backgroundPosition,
      backgroundSize: surface.backgroundSize,
      borderColor: surface.borderColor,
      borderWidth: surface.borderWidth,
      borderStyle: surface.borderStyle,
    },
    titleStyle: title ? {
      color: title.color,
      fontFamily: title.fontFamily,
      fontSize: title.fontSize,
      fontWeight: title.fontWeight,
      letterSpacing: title.letterSpacing,
      lineHeight: title.lineHeight,
      stroke: svgStyle?.stroke,
      strokeWidth: svgStyle && matrix ? parseFloat(svgStyle.strokeWidth) * Math.hypot(matrix.a, matrix.b) : 0,
    } : undefined,
    titleText: elements.title?.textContent ?? undefined,
    titleGlyphs: elements.title ? titleGlyphsOf(elements.title) : undefined,
    detailsMarkup: elements.details?.innerHTML,
  }
}

function boundsChanged(previous: HeroBounds | undefined, next: HeroBounds | undefined) {
  if (!previous || !next) return previous !== next
  return Math.abs(previous.left - next.left) > 0.2 || Math.abs(previous.top - next.top) > 0.2
    || Math.abs(previous.width - next.width) > 0.2 || Math.abs(previous.height - next.height) > 0.2
}

function boundsNear(element: HTMLElement | null, target: HeroBounds | undefined) {
  if (!element || !target) return false
  const current = boundsOf(element)
  return Math.abs(current.left - target.left) < 1.5 && Math.abs(current.top - target.top) < 1.5
    && Math.abs(current.width - target.width) < 1.5 && Math.abs(current.height - target.height) < 1.5
}

function interpolate(from: number, to: number, unit = 'px') {
  return `calc(${from}${unit} + ${to - from}${unit} * var(--hero-progress))`
}

function geometryBetween(from: HeroBounds, to: HeroBounds): CSSProperties {
  return {
    left: interpolate(from.left, to.left), top: interpolate(from.top, to.top),
    width: interpolate(from.width, to.width), height: interpolate(from.height, to.height),
  }
}

function relativeTo(bounds: HeroBounds, parent: HeroBounds): HeroBounds {
  return { ...bounds, left: bounds.left - parent.left, top: bounds.top - parent.top }
}

/** One flight owns the card surface, artwork and title, so their motion stays in phase. */
export function HeroArtworkTransitionProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion()
  const location = useLocation()
  const previousPath = useRef(location.pathname)
  const [flight, setFlight] = useState<HeroFlight | null>(null)
  const flightRef = useRef<HeroFlight | null>(null)
  const targetRef = useRef<HeroElements | null>(null)
  const surfaceOverlayRef = useRef<HTMLDivElement>(null)
  const artworkOverlayRef = useRef<HTMLDivElement>(null)
  const titleOverlayRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => { flightRef.current = flight }, [flight])

  const finishIfLanded = useCallback((id: string, direction: HeroDirection) => {
    const current = flightRef.current
    if (!current?.to || current.id !== id || current.direction !== direction || current.settled) return
    if (!boundsNear(surfaceOverlayRef.current, current.to.surface)
      || !boundsNear(artworkOverlayRef.current, current.to.artwork)
      || (current.from.title && current.to.title && !boundsNear(titleOverlayRef.current, current.to.title))) return
    setFlight((active) => active?.id === id && active.direction === direction && !active.settled
      ? { ...active, to: targetRef.current ? snapshotOf(targetRef.current) : active.to, settled: true } : active)
  }, [])

  const begin = useCallback((id: string, src: string, direction: HeroDirection, source: HeroElements, opacity = 1, angle = 0) => {
    if (reduceMotion) return
    const previous = flightRef.current
    if (previous?.id === id && previous.direction === direction && !previous.settled) return
    targetRef.current = null
    const from = snapshotOf(source)
    if (previous?.id === id && previous.direction !== direction && surfaceOverlayRef.current && artworkOverlayRef.current) {
      from.surface = boundsOf(surfaceOverlayRef.current)
      from.artwork = boundsOf(artworkOverlayRef.current)
      from.surfaceStyle = previous.to?.surfaceStyle ?? previous.from.surfaceStyle
      if (titleOverlayRef.current && from.titleStyle) {
        from.title = boundsOf(titleOverlayRef.current)
        from.titleGlyphs = titleGlyphsOf(titleOverlayRef.current)
        from.titleStyle.fontSize = getComputedStyle(titleOverlayRef.current).fontSize
      }
    }
    setFlight({ id, src, direction, from, opacity, angle })
  }, [reduceMotion])

  useLayoutEffect(() => {
    const cameFromEditor = previousPath.current.startsWith('/editor/')
    previousPath.current = location.pathname
    const current = flightRef.current
    if (!cameFromEditor || location.pathname !== '/library' || current?.direction !== 'open'
      || !surfaceOverlayRef.current || !artworkOverlayRef.current) return
    begin(current.id, current.src, 'close', {
      surface: surfaceOverlayRef.current,
      artwork: artworkOverlayRef.current,
      title: titleOverlayRef.current,
    }, current.opacity, current.angle)
  }, [location.pathname, begin])

  const landAt = useCallback((id: string, direction: HeroDirection, target: HeroElements) => {
    targetRef.current = target
    setFlight((current) => current?.id === id && current.direction === direction
      ? { ...current, to: snapshotOf(target) }
      : current)
  }, [])

  const flightId = flight?.id
  const flightDirection = flight?.direction
  useEffect(() => {
    if (!flightId || !flightDirection) return
    let animationFrame = 0
    const trackTarget = () => {
      const target = targetRef.current
      if (target?.artwork.isConnected && target.surface.isConnected) {
        const next = snapshotOf(target)
        setFlight((current) => {
          if (!current || current.id !== flightId || current.direction !== flightDirection || !current.to || current.settled) return current
          return boundsChanged(current.to.artwork, next.artwork)
            || boundsChanged(current.to.surface, next.surface)
            || boundsChanged(current.to.title, next.title)
            ? { ...current, to: next } : current
        })
      }
      animationFrame = window.requestAnimationFrame(trackTarget)
    }
    animationFrame = window.requestAnimationFrame(trackTarget)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [flightId, flightDirection])

  useEffect(() => {
    if (!flight?.settled) return
    const id = flight.id
    const direction = flight.direction
    const timeout = window.setTimeout(() => setFlight((current) => current?.id === id && current.direction === direction ? null : current),
      direction === 'close' ? 400 : 0)
    return () => window.clearTimeout(timeout)
  }, [flight?.id, flight?.direction, flight?.settled])

  useEffect(() => {
    if (!flightId || !flightDirection) return
    const timeout = window.setTimeout(() => setFlight((current) => current?.id === flightId && current.direction === flightDirection ? null : current), 1600)
    return () => window.clearTimeout(timeout)
  }, [flightId, flightDirection])

  const value = useMemo(() => ({ flight, begin, landAt }), [flight, begin, landAt])
  const spring = flight?.direction === 'open' ? OPEN_SPRING : CLOSE_SPRING
  const to = flight?.to ?? flight?.from

  return (
    <HeroArtworkContextValue.Provider value={value}>
      {children}
      {flight && to && <motion.div
        key={`${flight.id}-${flight.direction}`}
        data-hero-part="flight"
        aria-hidden="true"
        // Keep the landed overlay briefly while the real card is painted beneath it.
        // An explicit tween avoids inheriting the library tabs' spring for opacity.
        initial={{ '--hero-progress': 0, opacity: 1 }}
        animate={{ '--hero-progress': flight.to ? 1 : 0, opacity: flight.direction === 'close' && flight.settled ? 0 : 1 }}
        transition={{ ...spring, opacity: { type: 'tween', duration: 0.08, ease: 'linear' } }}
        onAnimationComplete={() => finishIfLanded(flight.id, flight.direction)}
        style={{ position: 'fixed', inset: 0, zIndex: 100, pointerEvents: 'none' }}
      >
        <div
          ref={surfaceOverlayRef}
          data-hero-part="surface"
          data-hero-settled={flight.settled || undefined}
          style={{ position: 'fixed', overflow: 'hidden', borderRadius: 24, ...geometryBetween(flight.from.surface, to.surface) }}
        >
          <div style={{ position: 'absolute', inset: 0, ...flight.from.surfaceStyle }} />
          <div style={{ position: 'absolute', inset: 0, ...to.surfaceStyle, opacity: 'var(--hero-progress)' }} />
          <div
            ref={artworkOverlayRef}
            data-hero-part="artwork"
            style={{
              position: 'absolute', zIndex: 1, opacity: flight.opacity, transformOrigin: 'center',
              ...geometryBetween(relativeTo(flight.from.artwork, flight.from.surface), relativeTo(to.artwork, to.surface)),
              transform: `rotate(${interpolate(flight.direction === 'close' ? flight.angle : 0, 0, 'deg')})`,
            }}
          >
            <img src={flight.src} alt="" draggable={false} style={{ display: 'block', width: '100%', height: '100%' }} />
          </div>
          {(flight.direction === 'open' ? to.detailsMarkup : flight.from.detailsMarkup) && <div
            data-hero-part="details"
            style={{ position: 'absolute', inset: 0, zIndex: 2,
              opacity: flight.direction === 'open' ? 'var(--hero-progress)' : 'calc(1 - var(--hero-progress))' }}
            dangerouslySetInnerHTML={{ __html: (flight.direction === 'open' ? to.detailsMarkup : flight.from.detailsMarkup)! }}
          />}
        </div>
        {flight.from.title && to.title && flight.from.titleStyle && to.titleStyle && <div
          ref={titleOverlayRef}
          data-hero-part="title"
          style={{
            position: 'fixed', zIndex: 2, overflow: 'visible',
            ...geometryBetween(flight.from.title, to.title),
            fontSize: interpolate(parseFloat(String(flight.from.titleStyle.fontSize)), parseFloat(String(to.titleStyle.fontSize))),
          }}
        >
          {(to.titleGlyphs ?? []).map((targetGlyph, index) => {
            const sourceGlyph = flight.from.titleGlyphs?.[index] ?? targetGlyph
            const sourceStyle = flight.from.titleStyle!
            const targetStyle = to.titleStyle!
            return <span key={index} data-hero-glyph={targetGlyph.text} style={{
              position: 'absolute', whiteSpace: 'pre',
              ...geometryBetween(relativeTo(sourceGlyph.bounds, flight.from.title!), relativeTo(targetGlyph.bounds, to.title!)),
            }}>
              <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
              <text x="0" y="0" style={{
                transform: `translateY(${interpolate(sourceGlyph.baseline, targetGlyph.baseline)})`,
                fontFamily: sourceStyle.fontFamily, fontWeight: sourceStyle.fontWeight,
                fill: sourceStyle.color, opacity: 'calc(1 - var(--hero-progress))',
                stroke: sourceStyle.stroke, strokeWidth: interpolate(sourceStyle.strokeWidth ?? 0, targetStyle.strokeWidth ?? 0), paintOrder: 'stroke',
              }}>{sourceGlyph.text}</text>
              <text x="0" y="0" style={{
                transform: `translateY(${interpolate(sourceGlyph.baseline, targetGlyph.baseline)})`,
                fontFamily: targetStyle.fontFamily, fontWeight: targetStyle.fontWeight,
                fill: targetStyle.color, opacity: 'var(--hero-progress)',
                stroke: targetStyle.stroke, strokeWidth: interpolate(sourceStyle.strokeWidth ?? 0, targetStyle.strokeWidth ?? 0), paintOrder: 'stroke',
              }}>{targetGlyph.text}</text>
              </svg>
            </span>
          })}
        </div>}
      </motion.div>}
    </HeroArtworkContextValue.Provider>
  )
}
