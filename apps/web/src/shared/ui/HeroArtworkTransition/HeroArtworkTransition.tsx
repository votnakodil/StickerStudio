import { ImageGeneration } from '@/shared/ui/ImageGeneration/ImageGeneration'
import { CanvasTexture } from '@/shared/ui/CanvasTexture/CanvasTexture'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useLocation } from 'react-router-dom'
import { motionTokens } from '@/shared/lib/motion'
import {
  HeroArtworkContextValue,
  type HeroBounds,
  type HeroDirection,
  type HeroElements,
  type HeroFlight,
  type HeroSnapshot,
  type HeroTitleGlyph,
} from '@/shared/ui/HeroArtworkTransition/useHeroArtworkTransition'

import { createHeroTargetTracker } from './heroTargetTracker'
import { pairTitleGlyphs } from './titleGlyphPairs'
import { hasUsableHeroBounds } from './heroBounds'
import { readTextureInkBounds, textureReadRegion } from './textureInkBounds'

const ARTWORK_SPRING = { type: 'spring', stiffness: 220, damping: 27, mass: 0.9 } as const

function boundsOf(element: Element): HeroBounds {
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

function textureOf(element: HTMLCanvasElement | null | undefined) {
  return element ? { source: element, style: {
    position: 'absolute' as const, maxWidth: element.style.maxWidth,
    left: element.style.left, top: element.style.top,
    width: element.style.width, height: element.style.height,
  } } : undefined
}

/** Keep the already decoded card pixels instead of requesting a new flight image. */
function previewOf(artwork: HTMLElement) {
  const flyingPreview = artwork.querySelector<HTMLCanvasElement>('[data-hero-texture="preview"]')
  if (flyingPreview) return flyingPreview
  const image = artwork.querySelector('img')
  if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return undefined
  const source = document.createElement('canvas')
  const context = source.getContext('2d')
  if (!context) return undefined
  if (getComputedStyle(image).objectFit === 'cover') {
    const bounds = image.getBoundingClientRect()
    const ratio = bounds.width / bounds.height
    const cropWidth = Math.min(image.naturalWidth, image.naturalHeight * ratio)
    const cropHeight = cropWidth / ratio
    const screenPixels = Math.max(bounds.width, bounds.height, Math.min(innerWidth, innerHeight)) * Math.min(devicePixelRatio || 1, 2)
    const downsample = Math.min(1, screenPixels / Math.max(cropWidth, cropHeight))
    source.width = Math.round(cropWidth * downsample)
    source.height = Math.round(cropHeight * downsample)
    context.drawImage(image, (image.naturalWidth - cropWidth) / 2,
      (image.naturalHeight - cropHeight) / 2, cropWidth, cropHeight,
      0, 0, source.width, source.height)
  } else {
    source.width = image.naturalWidth
    source.height = image.naturalHeight
    context.drawImage(image, 0, 0)
  }
  return source
}

function borderOf(border: SVGSVGElement | null | undefined) {
  if (!border) return undefined
  const clone = border.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('class')
  const style = getComputedStyle(border)
  clone.style.cssText = `display:block;width:100%;height:100%;overflow:visible;fill:none;stroke:${style.stroke};stroke-width:${style.strokeWidth}`
  clone.querySelectorAll<SVGElement>('path, rect').forEach((path, index) => {
    const original = border.querySelectorAll<SVGElement>('path, rect')[index]
    const computed = getComputedStyle(original)
    path.style.strokeDasharray = computed.strokeDasharray
    path.style.strokeDashoffset = computed.strokeDashoffset
    path.style.vectorEffect = computed.vectorEffect
  })
  return { bounds: boundsOf(border), markup: clone.outerHTML }
}

function snapshotOf(elements: HeroElements): HeroSnapshot {
  const surface = getComputedStyle(elements.surface)
  const title = elements.title ? getComputedStyle(elements.title) : null
  const svgText = elements.title?.querySelector<SVGTextElement>('svg text')
  const svgStyle = svgText ? getComputedStyle(svgText) : null
  const matrix = svgText?.getScreenCTM()
  const previewImage = elements.artwork.querySelector<HTMLImageElement>('img')
  // Reuse the decoded card image directly. Safari can rasterize a canvas at
  // its small starting CSS size and stretch that bitmap throughout the flight.
  const previewSrc = !elements.previewTexture && previewImage?.complete && previewImage.naturalWidth
    && getComputedStyle(previewImage).objectFit !== 'cover' ? previewImage.currentSrc || previewImage.src : undefined
  return {
    previewSrc,
    artwork: boundsOf(elements.artwork),
    border: borderOf(elements.border),
    previewTexture: elements.previewTexture ?? (previewSrc ? undefined : previewOf(elements.artwork)),
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
      color: svgStyle?.fill ?? title.color,
      fontFamily: svgStyle?.fontFamily ?? title.fontFamily,
      fontSize: svgStyle && matrix ? `${parseFloat(svgStyle.fontSize) * Math.hypot(matrix.a, matrix.b)}px` : title.fontSize,
      fontWeight: svgStyle?.fontWeight ?? title.fontWeight,
      letterSpacing: title.letterSpacing,
      lineHeight: title.lineHeight,
      stroke: svgStyle?.stroke,
      strokeWidth: svgStyle && matrix ? parseFloat(svgStyle.strokeWidth) * Math.hypot(matrix.a, matrix.b) : 0,
    } : undefined,
    titleText: elements.title?.textContent ?? undefined,
    titleGlyphs: elements.title ? titleGlyphsOf(elements.title) : undefined,
    detailsMarkup: elements.details?.querySelector('svg')?.outerHTML ?? elements.details?.innerHTML,
    titleTexture: textureOf(elements.details?.querySelector<HTMLCanvasElement>('[data-hero-texture="title"]')),
    textTexture: textureOf(elements.details?.querySelector<HTMLCanvasElement>('[data-hero-texture="text"]')),
    artworkTexture: textureOf(elements.artwork.querySelector<HTMLCanvasElement>('[data-hero-texture="artwork"]')),
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

function interpolate(from: number, to: number, unit = 'px', progress = '--hero-progress') {
  return `calc(${from}${unit} + ${to - from}${unit} * var(${progress}))`
}

function geometryBetween(from: HeroBounds, to: HeroBounds, progress = '--hero-progress'): CSSProperties {
  return {
    left: interpolate(from.left, to.left, 'px', progress), top: interpolate(from.top, to.top, 'px', progress),
    width: interpolate(from.width, to.width, 'px', progress), height: interpolate(from.height, to.height, 'px', progress),
  }
}

function relativeTo(bounds: HeroBounds, parent: HeroBounds): HeroBounds {
  return { ...bounds, left: bounds.left - parent.left, top: bounds.top - parent.top }
}

function glyphBounds(glyphs: HeroTitleGlyph[] | undefined) {
  if (!glyphs?.length) return undefined
  const left = Math.min(...glyphs.map(glyph => glyph.bounds.left))
  const top = Math.min(...glyphs.map(glyph => glyph.bounds.top))
  return {
    left, top,
    width: Math.max(...glyphs.map(glyph => glyph.bounds.left + glyph.bounds.width)) - left,
    height: Math.max(...glyphs.map(glyph => glyph.bounds.top + glyph.bounds.height)) - top,
  }
}

const textureInkBounds = new WeakMap<HTMLCanvasElement, HeroBounds | null>()

/** Measure the painted pixels once, rather than approximating Fabric text with SVG metrics. */
function titleTextureBounds(snapshot: HeroSnapshot): HeroBounds | undefined {
  const source = snapshot.titleTexture?.source
  if (!source) return undefined
  let ink = textureInkBounds.get(source)
  if (ink === undefined) {
    const context = source.getContext('2d')
    const fontSize = parseFloat(String(snapshot.titleStyle?.fontSize ?? 0)) || 0
    const padding = Math.max(4, fontSize * 0.25, (snapshot.titleStyle?.strokeWidth ?? 0) * 2)
    const region = textureReadRegion(snapshot.surface, glyphBounds(snapshot.titleGlyphs), source.width, source.height, padding)
    ink = context ? readTextureInkBounds(context, region) : null
    textureInkBounds.set(source, ink)
  }
  return ink ? {
    left: snapshot.surface.left + ink.left / source.width * snapshot.surface.width,
    top: snapshot.surface.top + ink.top / source.height * snapshot.surface.height,
    width: ink.width / source.width * snapshot.surface.width,
    height: ink.height / source.height * snapshot.surface.height,
  } : undefined
}

/** One flight owns the card surface, artwork and title, so their motion stays in phase. */
export function HeroArtworkTransitionProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion()
  const location = useLocation()
  const [flight, setFlight] = useState<HeroFlight | null>(null)
  const flightRef = useRef<HeroFlight | null>(null)
  const targetTracker = useRef(createHeroTargetTracker<HeroElements>())
  const openRouteSeen = useRef(false)
  const loadingOverlayRef = useRef<HTMLDivElement>(null)
  const flightOverlayRef = useRef<HTMLDivElement>(null)
  const textOverlayRef = useRef<HTMLDivElement>(null)
  const surfaceOverlayRef = useRef<HTMLDivElement>(null)
  const artworkOverlayRef = useRef<HTMLDivElement>(null)
  const outlineOverlayRef = useRef<HTMLDivElement>(null)
  const titleOverlayRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => { flightRef.current = flight }, [flight])

  const finishIfLanded = useCallback((id: string, direction: HeroDirection) => {
    const current = flightRef.current
    if (!current?.to || current.id !== id || current.direction !== direction || current.settled || current.ready === false) return
    if (current.loading && current.direction === 'open'
      && (!loadingOverlayRef.current || Number(getComputedStyle(loadingOverlayRef.current).opacity) < 0.999)) return
    if (Number(flightOverlayRef.current?.style.getPropertyValue('--hero-progress')) !== 1) return
    if (current.direction === 'open' && current.to.textTexture
      && (!textOverlayRef.current || Number(getComputedStyle(textOverlayRef.current).opacity) < 0.999)) return
    if (current.direction === 'open' && current.to.artworkTexture
      && (!outlineOverlayRef.current || Number(getComputedStyle(outlineOverlayRef.current).opacity) < 0.999)) return
    if (!boundsNear(surfaceOverlayRef.current, current.to.surface)
      || !boundsNear(artworkOverlayRef.current, current.to.artwork)
      || (current.from.title && current.to.title && !boundsNear(titleOverlayRef.current, current.to.title))) return
    const target = targetTracker.current.read(id, direction)
    setFlight((active) => active?.id === id && active.direction === direction && !active.settled
      ? { ...active, to: target ? snapshotOf(target) : active.to, settled: true } : active)
  }, [])

  const begin = useCallback((id: string, src: string, direction: HeroDirection, source: HeroElements, opacity = 1, angle = 0, loading = false, destination?: HeroBounds, startTime?: CSSNumberish | null) => {
    if (reduceMotion) return
    const previous = flightRef.current
    if (previous?.id === id && previous.direction === direction && !previous.settled) return
    targetTracker.current.begin(id, direction)
    if (direction === 'open') openRouteSeen.current = false
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
    if (!hasUsableHeroBounds(from.surface) || !hasUsableHeroBounds(from.artwork)) return
    const initialDestination = destination ? { surface: destination, artwork: destination } : undefined
    setFlight({ id, src, direction, from, opacity, angle, loading, startTime, dissolveOnLanding: source.dissolveOnLanding,
      ...(initialDestination ? { to: { ...from, ...initialDestination }, ready: false } : {}) })
  }, [reduceMotion])

  const reverseToLibrary = useCallback(() => {
    const current = flightRef.current
    if (window.location.pathname.startsWith('/editor/')) openRouteSeen.current = true
    if (!openRouteSeen.current) return
    // Router state can still describe the library while its concurrent editor
    // navigation is pending. The browser URL is already updated by that point.
    if (window.location.pathname !== '/library' || current?.direction !== 'open'
      || !surfaceOverlayRef.current || !artworkOverlayRef.current) return
    begin(current.id, current.src, 'close', {
      surface: surfaceOverlayRef.current,
      artwork: artworkOverlayRef.current,
      title: titleOverlayRef.current,
    }, current.opacity, current.angle)
  }, [begin])

  useLayoutEffect(() => {
    if (location.pathname === '/library') reverseToLibrary()
  }, [location.pathname, flight?.id, flight?.direction, reverseToLibrary])

  useEffect(() => {
    let frame = 0
    const onBrowserBack = () => {
      if (flightRef.current?.direction === 'open') openRouteSeen.current = true
      // A very fast Back can cancel the editor route before React commits it,
      // leaving no pathname change for the layout effect to observe.
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(reverseToLibrary)
    }
    window.addEventListener('popstate', onBrowserBack)
    return () => {
      window.removeEventListener('popstate', onBrowserBack)
      window.cancelAnimationFrame(frame)
    }
  }, [reverseToLibrary])

  const landAt = useCallback((id: string, direction: HeroDirection, target: HeroElements, ready = true) => {
    if (!hasUsableHeroBounds(boundsOf(target.artwork)) || !hasUsableHeroBounds(boundsOf(target.surface))) return
    // Outgoing routes can still run effects after a reversal starts. Reject
    // their destination before it can redirect the current frame tracker.
    if (!targetTracker.current.landAt(id, direction, target)) return
    if (direction === 'open') openRouteSeen.current = true
    setFlight((current) => current?.id === id && current.direction === direction
      ? { ...current, to: snapshotOf(target), ready }
      : current)
  }, [])

  useLayoutEffect(() => {
    if (flight?.ready) finishIfLanded(flight.id, flight.direction)
  }, [flight?.id, flight?.direction, flight?.ready, finishIfLanded])

  const flightId = flight?.id
  const flightDirection = flight?.direction
  useEffect(() => {
    if (!flightId || !flightDirection) return
    let animationFrame = 0
    const trackTarget = () => {
      const current = flightRef.current
      if (!current || current.id !== flightId || current.direction !== flightDirection || current.settled) return
      const target = targetTracker.current.read(flightId, flightDirection)
      if (current.to && target?.artwork.isConnected && target.surface.isConnected
        && hasUsableHeroBounds(boundsOf(target.artwork)) && hasUsableHeroBounds(boundsOf(target.surface))) {
        // Track geometry cheaply. Rebuilding SVG glyphs and a measuring canvas
        // every frame forced layout even when the destination had not moved.
        if (boundsChanged(current.to.artwork, boundsOf(target.artwork))
          || boundsChanged(current.to.surface, boundsOf(target.surface))
          || boundsChanged(current.to.title, target.title ? boundsOf(target.title) : undefined)) {
          const next = snapshotOf(target)
          setFlight((active) => active?.id === flightId && active.direction === flightDirection && !active.settled
            ? { ...active, to: next } : active)
        }
      }
      // Layout and hover can change after Motion's completion callback. Keep
      // checking the handoff until the live destination and all reveals agree.
      finishIfLanded(flightId, flightDirection)
      animationFrame = window.requestAnimationFrame(trackTarget)
    }
    animationFrame = window.requestAnimationFrame(trackTarget)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [flightId, flightDirection, finishIfLanded])

  useEffect(() => {
    if (!flight?.settled) return
    const id = flight.id
    const direction = flight.direction
    const timeout = window.setTimeout(() => setFlight((current) => current?.id === id && current.direction === direction ? null : current),
      direction === 'close' ? flight.dissolveOnLanding ? motionTokens.duration.processingDissolve * 1000 + 60 : 400 : 0)
    return () => window.clearTimeout(timeout)
  }, [flight?.id, flight?.direction, flight?.settled, flight?.dissolveOnLanding])

  useEffect(() => {
    if (!flightId || !flightDirection || flight?.settled || flightDirection === 'open' || flight?.ready === false && flight.to) return
    const timeout = window.setTimeout(() => setFlight((current) => current?.id === flightId && current.direction === flightDirection ? null : current), 1600)
    return () => window.clearTimeout(timeout)
  }, [flightId, flightDirection, flight?.ready, flight?.to, flight?.settled])

  const photoDestination = flight?.loading && flight.direction === 'open' ? flight.to?.surface : undefined
  const photoLeft = photoDestination?.left
  const photoTop = photoDestination?.top
  const photoWidth = photoDestination?.width
  const photoHeight = photoDestination?.height
  const photoFrom = flight?.from.surface
  const photoStartTime = flight?.startTime
  useLayoutEffect(() => {
    const surface = surfaceOverlayRef.current
    if (!surface || !photoFrom || photoLeft === undefined || photoTop === undefined || !photoWidth || !photoHeight) return
    // A compositor transform continues moving while React mounts the editor.
    // Keep the loading canvas at its final resolution instead of resizing it on
    // every animation frame.
    const animation = surface.animate([
      { transform: `translate(${photoFrom.left - photoLeft}px, ${photoFrom.top - photoTop}px) scale(${photoFrom.width / photoWidth}, ${photoFrom.height / photoHeight})` },
      { transform: 'translate(0px, 0px) scale(1, 1)' },
    ], { duration: motionTokens.duration.photoTravel * 1000, easing: `cubic-bezier(${motionTokens.ease.photoTravel.join(',')})`, fill: 'both' })
    animation.startTime = photoStartTime ?? document.timeline.currentTime
    animation.onfinish = () => { if (flightRef.current) finishIfLanded(flightRef.current.id, flightRef.current.direction) }
    return () => { animation.onfinish = null; animation.cancel() }
  }, [photoFrom, photoLeft, photoTop, photoWidth, photoHeight, photoStartTime, finishIfLanded])

  const cancelFlight = useCallback((id: string) => setFlight(current => current?.id === id ? null : current), [])
  const value = useMemo(() => ({ flight, begin, landAt, cancelFlight }), [flight, begin, landAt, cancelFlight])
  const spring = ARTWORK_SPRING
  const to = flight?.to ?? flight?.from
  const titleFrom = glyphBounds(flight?.from.titleGlyphs)
  const titleSnapshot = flight?.direction === 'open' ? to : flight?.from
  const titleInk = titleSnapshot ? titleTextureBounds(titleSnapshot) : undefined
  const titleTexture = titleSnapshot?.titleTexture
  const titleStart = flight?.direction === 'close' ? titleInk : titleFrom
  const titleEnd = flight?.direction === 'close' ? glyphBounds(to?.titleGlyphs) : titleInk
  // Both handoffs start with the exact painted pixels. Re-rendering Fabric's
  // title as SVG on Back can change its baseline before the flight even moves.
  const texturedTitle = titleTexture && titleInk && titleStart && titleEnd
  const photoPreview = flight?.direction === 'close' ? to : flight?.from

  return (
    <HeroArtworkContextValue.Provider value={value}>
      {children}
      {flight && to && <motion.div
        key={`${flight.id}-${flight.direction}`}
        ref={flightOverlayRef}
        data-hero-part="flight"
        aria-hidden="true"
        // Keep the landed overlay briefly while the real card is painted beneath it.
        // An explicit tween avoids inheriting the library tabs' spring for opacity.
        initial={{ '--hero-progress': 0, '--hero-text-reveal': 0, opacity: 1 }}
        animate={{ '--hero-progress': flight.to ? 1 : 0, '--hero-text-reveal': flight.direction === 'open' && to.textTexture ? 1 : 0, opacity: flight.direction === 'close' && flight.settled ? 0 : 1 }}
        transition={{ ...spring, '--hero-text-reveal': { type: 'tween', duration: motionTokens.duration.standard, ease: motionTokens.ease.inOut }, opacity: { type: 'tween', duration: flight.dissolveOnLanding ? motionTokens.duration.processingDissolve : 0.08, ease: flight.dissolveOnLanding ? motionTokens.ease.inOut : 'linear' } }}
        onAnimationComplete={() => finishIfLanded(flight.id, flight.direction)}
        style={{ position: 'fixed', inset: 0, zIndex: 100, pointerEvents: 'none' }}
      >
        <div
          ref={surfaceOverlayRef}
          data-hero-part="surface"
          data-hero-settled={flight.settled || undefined}
          style={{ position: 'fixed', overflow: photoDestination ? 'visible' : 'hidden', borderRadius: 24,
            opacity: flight.dissolveOnLanding ? 'calc(1 - clamp(0, var(--hero-progress) / 0.85, 1) * 0.5)' : undefined,
            ...(photoDestination ? { ...photoDestination, transformOrigin: '0 0', willChange: 'transform' } : geometryBetween(flight.from.surface, to.surface)) }}
        >
          <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', ...flight.from.surfaceStyle }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', ...to.surfaceStyle, opacity: 'var(--hero-progress)' }} />
          <div
            ref={artworkOverlayRef}
            data-hero-part="artwork"
            style={{
              position: 'absolute', zIndex: 1, opacity: flight.opacity, transformOrigin: 'center',
              ...(photoDestination ? { overflow: 'hidden', borderRadius: 'inherit' } : {}),
              ...(photoDestination ? { left: 0, top: 0, width: '100%', height: '100%' }
                : geometryBetween(relativeTo(flight.from.artwork, flight.from.surface), relativeTo(to.artwork, to.surface))),
              transform: `rotate(${interpolate(flight.direction === 'close' ? flight.angle : 0, 0, 'deg')})`,
            }}
          >
            <div data-hero-part="photo-preview" style={{ position: 'absolute', inset: 0,
              opacity: flight.direction === 'close' && flight.from.artworkTexture ? 'var(--hero-progress)' : 1 }}>
              {photoPreview?.previewSrc
                ? <img src={photoPreview.previewSrc} alt="" decoding="sync" draggable={false} style={{ display: 'block', width: '100%', height: '100%' }} />
                : photoPreview?.previewTexture
                  ? <CanvasTexture kind="preview" source={photoPreview.previewTexture} style={{ display: 'block', width: '100%', height: '100%' }} />
                  : <img src={flight.src} alt="" draggable={false} style={{ display: 'block', width: '100%', height: '100%' }} />}
            </div>
            {flight.direction === 'close' && flight.from.artworkTexture && <div
              data-hero-part="outline"
              style={{ position: 'absolute', inset: 0, opacity: 'calc(1 - var(--hero-progress))' }}>
              <CanvasTexture kind="artwork" source={flight.from.artworkTexture.source} style={flight.from.artworkTexture.style} />
            </div>}
            {flight.direction === 'open' && to.artworkTexture && <motion.div
              ref={outlineOverlayRef}
              data-hero-part="outline"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ type: 'tween', duration: reduceMotion ? 0 : motionTokens.duration.standard, ease: motionTokens.ease.inOut }}
              onAnimationComplete={() => finishIfLanded(flight.id, flight.direction)}
              style={{ position: 'absolute', inset: 0 }}
              ><CanvasTexture kind="artwork" source={to.artworkTexture.source} style={to.artworkTexture.style} /></motion.div>}
          </div>
          {flight.loading && flight.direction === 'open' && <motion.div
            ref={loadingOverlayRef} data-hero-part="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ type: 'tween', duration: motionTokens.duration.standard, ease: motionTokens.ease.inOut }}
            onAnimationComplete={() => finishIfLanded(flight.id, flight.direction)}
            style={{ position: 'absolute', inset: 0, zIndex: 4, borderRadius: 'inherit' }}>
            <ImageGeneration status="queued" label="Preparing your custom sticker" appear={false} />
          </motion.div>}
          {photoDestination && flight.from.border && <motion.div data-hero-part="upload-border"
            initial={{ opacity: 1 }} animate={{ opacity: 0 }}
            transition={{ type: 'tween', duration: motionTokens.duration.photoTravel, ease: motionTokens.ease.inOut }}
            style={{ position: 'absolute', zIndex: 6,
              left: `${(flight.from.border.bounds.left - flight.from.surface.left) / flight.from.surface.width * 100}%`,
              top: `${(flight.from.border.bounds.top - flight.from.surface.top) / flight.from.surface.height * 100}%`,
              width: `${flight.from.border.bounds.width / flight.from.surface.width * 100}%`,
              height: `${flight.from.border.bounds.height / flight.from.surface.height * 100}%` }}
            dangerouslySetInnerHTML={{ __html: flight.from.border.markup }} />}
        </div>
        <div style={{ position: 'fixed', inset: 0, zIndex: 2, isolation: 'isolate' }}>
          {(flight.direction === 'open' ? !to.textTexture && to.detailsMarkup : !flight.from.textTexture && flight.from.detailsMarkup) && <div
            data-hero-part="details"
            style={{ position: 'fixed', ...geometryBetween(flight.from.surface, to.surface), mixBlendMode: 'plus-lighter',
              opacity: flight.direction === 'open' ? 'calc(var(--hero-progress) * (1 - var(--hero-text-reveal)))' : 'calc(1 - var(--hero-progress))' }}
            dangerouslySetInnerHTML={{ __html: (flight.direction === 'open' ? to.detailsMarkup : flight.from.detailsMarkup)! }}
          />}
          {flight.direction === 'close' && flight.from.textTexture && <div
            data-hero-part="text-texture"
            style={{ position: 'fixed', ...geometryBetween(flight.from.surface, to.surface), opacity: 'calc(1 - var(--hero-progress))' }}>
            <CanvasTexture kind="text" source={flight.from.textTexture.source} style={flight.from.textTexture.style} />
          </div>}
          {flight.direction === 'open' && to.textTexture && <div
            ref={textOverlayRef} data-hero-part="text-texture"
            style={{ position: 'fixed', ...geometryBetween(flight.from.surface, to.surface), mixBlendMode: 'plus-lighter', opacity: 'var(--hero-text-reveal)' }}>
            <CanvasTexture kind="text" source={to.textTexture.source} style={to.textTexture.style} />
          </div>}
          {texturedTitle && titleSnapshot && <div
            data-hero-part="title-texture"
            style={{ position: 'fixed', ...geometryBetween(titleStart, titleEnd), opacity: flight.direction === 'close' ? 'calc(1 - var(--hero-progress))' : 1 }}>
            <CanvasTexture kind="title" source={titleTexture.source} style={{
              position: 'absolute', maxWidth: 'none',
              left: `${(titleSnapshot.surface.left - titleInk.left) / titleInk.width * 100}%`,
              top: `${(titleSnapshot.surface.top - titleInk.top) / titleInk.height * 100}%`,
              width: `${titleSnapshot.surface.width / titleInk.width * 100}%`,
              height: `${titleSnapshot.surface.height / titleInk.height * 100}%`,
            }} />
          </div>}
        {flight.from.title && to.title && flight.from.titleStyle && to.titleStyle && <div
          ref={titleOverlayRef}
          data-hero-part="title"
          style={{
            position: 'fixed', zIndex: 2, overflow: 'visible', mixBlendMode: 'plus-lighter',
            opacity: texturedTitle && flight.direction === 'open' ? 0 : 1,
            ...geometryBetween(flight.from.title, to.title, '--hero-progress'),
            fontSize: interpolate(parseFloat(String(flight.from.titleStyle.fontSize)), parseFloat(String(to.titleStyle.fontSize)), 'px', '--hero-progress'),
          }}
        >
          {pairTitleGlyphs(flight.from.titleGlyphs, to.titleGlyphs).map(({ sourceGlyph, targetGlyph }, index) => {
            const sourceStyle = flight.from.titleStyle!
            const targetStyle = to.titleStyle!
            return <span key={index} data-hero-glyph={targetGlyph.text} style={{
              position: 'absolute', whiteSpace: 'pre',
              ...geometryBetween(relativeTo(sourceGlyph.bounds, flight.from.title!), relativeTo(targetGlyph.bounds, to.title!), '--hero-progress'),
            }}>
              <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
              <text x="0" y="0" style={{
                transform: `translateY(${interpolate(sourceGlyph.baseline, targetGlyph.baseline, 'px', '--hero-progress')})`,
                fontFamily: sourceStyle.fontFamily, fontWeight: sourceStyle.fontWeight,
                fill: sourceStyle.color, opacity: flight.direction === 'open' ? 1 : texturedTitle ? 0 : 'calc(1 - var(--hero-progress))',
                stroke: sourceStyle.stroke, strokeWidth: interpolate(sourceStyle.strokeWidth ?? 0, targetStyle.strokeWidth ?? 0, 'px', '--hero-progress'), paintOrder: 'stroke',
              }}>{sourceGlyph.text}</text>
              <text x="0" y="0" style={{
                transform: `translateY(${interpolate(sourceGlyph.baseline, targetGlyph.baseline, 'px', '--hero-progress')})`,
                fontFamily: targetStyle.fontFamily, fontWeight: targetStyle.fontWeight,
                fill: targetStyle.color, opacity: flight.direction === 'open' ? 0 : 'var(--hero-progress)',
                stroke: targetStyle.stroke, strokeWidth: interpolate(sourceStyle.strokeWidth ?? 0, targetStyle.strokeWidth ?? 0, 'px', '--hero-progress'), paintOrder: 'stroke',
              }}>{targetGlyph.text}</text>
              </svg>
            </span>
          })}
        </div>}
        </div>
      </motion.div>}
    </HeroArtworkContextValue.Provider>
  )
}
