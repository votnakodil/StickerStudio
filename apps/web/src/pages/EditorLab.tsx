import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { flushSync } from 'react-dom'
import { FabricImage, Textbox } from 'fabric'
import { SPRING_EDITOR_REVEAL } from '../lib/ease'
import { commitStickerLayerScale, scaleSelectedStickerLayers, type StickerCanvas } from '@sticker-studio/editor'
import { EditorCanvas } from '../components/editor/EditorCanvas'
import { CanvasToolbar } from '../components/editor/CanvasToolbar/CanvasToolbar'
import { LayersPanel } from '../components/editor/LayersPanel/LayersPanel'
import { InspectorPanel } from '../components/editor/InspectorPanel/InspectorPanel'
import { useHeroArtworkTransition } from '../components/ui/useHeroArtworkTransition'
import { Link, useParams } from 'react-router-dom'
import { IconPhotoBadgeExclamationmark } from 'symbols-react'
import { EmptyView } from '../components/ui/EmptyView'
import { findStickerById, initialStickerImagePlacement } from '../data/stickers'
import { useEditorStore } from '../stores/editorStore'
import styles from './EditorLab.module.css'

function placementFromImage(image: FabricImage) {
  const center = image.getCenterPoint()
  const width = image.width * image.scaleX
  const height = image.height * image.scaleY
  return { left: center.x - width / 2, top: center.y - height / 2, width, height, angle: image.angle, opacity: image.opacity }
}

export function EditorLab({ leavingRoute = false }: { leavingRoute?: boolean }) {
  const reduceMotion = useReducedMotion()
  const { stickerId } = useParams()
  const sticker = findStickerById(stickerId)
  const stageRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const canvasSurfaceRef = useRef<HTMLDivElement>(null)
  const heroTitleRef = useRef<HTMLDivElement>(null)
  const heroDetailsRef = useRef<HTMLDivElement>(null)
  const [detailsSvg, setDetailsSvg] = useState('')
  const imageRef = useRef<FabricImage | null>(null)
  const topTextRef = useRef<Textbox | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const returnPrepared = useRef(false)
  const { flight, begin, landAt } = useHeroArtworkTransition()
  const canvasRef = useRef<StickerCanvas | null>(null)
  const savedImageOpacity = useRef(1)
  const pendingScale = useRef<{ canvas: StickerCanvas; timer: ReturnType<typeof setTimeout> } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [canvasSettled, setCanvasSettled] = useState(false)
  const [imagePlacement, setImagePlacement] = useState(() => sticker ? initialStickerImagePlacement(sticker) : null)
  const [titleLayout, setTitleLayout] = useState({
    text: sticker?.name.toUpperCase() ?? '',
    left: 512, top: 108, width: 400, fontSize: 72,
    fontFamily: 'Times New Roman', fontWeight: '700', color: undefined as string | undefined, svg: '',
  })
  const [leaving, setLeaving] = useState(false)
  useLayoutEffect(() => {
    if (!flight || !sticker || flight.id !== sticker.id || flight.direction !== 'open') return
    if (canvasSettled && !flight.to && heroRef.current && canvasSurfaceRef.current) {
      landAt(sticker.id, 'open', { artwork: heroRef.current, surface: canvasSurfaceRef.current, title: heroTitleRef.current, details: heroDetailsRef.current })
    }
  }, [flight, landAt, sticker, canvasSettled])

  const handleCanvasReady = useCallback((canvas: StickerCanvas, image: FabricImage) => {
    canvasRef.current = canvas
    imageRef.current = image
    topTextRef.current = canvas.getObjects()
      .filter((object): object is Textbox => object instanceof Textbox)
      .sort((a, b) => a.getCenterPoint().y - b.getCenterPoint().y)[0] ?? null
    savedImageOpacity.current = image.opacity
    const title = topTextRef.current
    setDetailsSvg(canvas.getObjects().filter((object) => object instanceof Textbox && object !== title && object.visible).map((object) => object.toSVG()).join(''))
    if (title) setTitleLayout({
      text: title.text, left: title.getCenterPoint().x, top: title.getCenterPoint().y,
      width: title.width * title.scaleX, fontSize: title.fontSize * title.scaleY,
      fontFamily: title.fontFamily, fontWeight: String(title.fontWeight),
      color: typeof title.fill === 'string' ? title.fill : undefined, svg: title.toSVG(),
    })
    canvas.renderAll()
    setCanvasSettled(true)
  }, [])
  const handleCanvasError = useCallback(() => setCanvasSettled(true), [])

  const prepareReturn = useCallback(() => {
    if (reduceMotion || !sticker || returnPrepared.current) return
    returnPrepared.current = true
    const image = imageRef.current
    const canvas = canvasRef.current
    if (image) savedImageOpacity.current = image.opacity
    const placement = image ? placementFromImage(image) : initialStickerImagePlacement(sticker)
    const topText = topTextRef.current && topTextRef.current.visible && canvas?.getObjects().includes(topTextRef.current) ? topTextRef.current : null
    flushSync(() => {
      setImagePlacement({ ...placement, opacity: savedImageOpacity.current })
      setDetailsSvg(canvas?.getObjects().filter((object) => object instanceof Textbox && object !== topText && object.visible).map((object) => object.toSVG()).join('') ?? '')
      if (topText) {
        setTitleLayout({
          text: topText.text,
          left: topText.getCenterPoint().x,
          top: topText.getCenterPoint().y,
          width: topText.width * topText.scaleX,
          fontSize: topText.fontSize * topText.scaleY,
          fontFamily: topText.fontFamily,
          fontWeight: String(topText.fontWeight),
          color: typeof topText.fill === 'string' ? topText.fill : undefined,
          svg: topText.toSVG(),
        })
      }
      setLeaving(true)
    })
    if (heroRef.current && canvasSurfaceRef.current) {
      flushSync(() => begin(sticker.id, sticker.preview.src, 'close',
        { artwork: heroRef.current!, surface: canvasSurfaceRef.current!, title: topText ? heroTitleRef.current : null, details: heroDetailsRef.current },
        savedImageOpacity.current, placement.angle))
    }
  }, [begin, reduceMotion, sticker])

  useLayoutEffect(() => {
    if (!leavingRoute || window.location.pathname !== '/library') return
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) prepareReturn() })
    return () => { cancelled = true }
  }, [leavingRoute, prepareReturn])

  useEffect(() => {
    const onBrowserBack = () => {
      if (window.location.pathname === '/library') prepareReturn()
    }
    window.addEventListener('popstate', onBrowserBack)
    return () => window.removeEventListener('popstate', onBrowserBack)
  }, [prepareReturn])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const zoomCanvas = (event: WheelEvent) => {
      event.preventDefault()
      const delta = Math.max(-80, Math.min(80, event.deltaY))
      const factor = Math.exp(-delta * 0.002)
      const canvas = useEditorStore.getState().canvas

      if (canvas?.getActiveObject() && frameRef.current?.contains(event.target as Node)) {
        if (scaleSelectedStickerLayers(canvas, factor)) {
          if (pendingScale.current) clearTimeout(pendingScale.current.timer)
          const timer = setTimeout(() => {
            commitStickerLayerScale(canvas)
            pendingScale.current = null
          }, 180)
          pendingScale.current = { canvas, timer }
        }
        return
      }

      setZoom((current) => Math.min(3, Math.max(0.4, current * factor)))
    }

    stage.addEventListener('wheel', zoomCanvas, { passive: false })
    return () => {
      stage.removeEventListener('wheel', zoomCanvas)
      if (pendingScale.current) {
        clearTimeout(pendingScale.current.timer)
        commitStickerLayerScale(pendingScale.current.canvas)
        pendingScale.current = null
      }
    }
  }, [stickerId])

  if (!sticker) {
    return (
      <main className={`${styles.page} ${styles.notFound}`}>
        <EmptyView
          icon={<IconPhotoBadgeExclamationmark width={40} height={40} fill="currentColor" />}
          title="Sticker not found"
          subtitle="This sticker isn't in the library. Choose another one to edit."
          action={<Link to="/library">Return to library</Link>}
        />
      </main>
    )
  }

  return (
    <motion.main className={styles.page}
      initial={false}
      style={{ pointerEvents: leavingRoute ? 'none' : 'auto' }}
    >
      <motion.div className={styles.backdrop} aria-hidden="true"
        animate={{ opacity: leavingRoute ? 0 : 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.32 }}
      />
      <motion.div className={styles.layers}
        initial={reduceMotion ? false : { x: '-130%' }}
        animate={reduceMotion ? { opacity: leavingRoute ? 0 : 1 } : { x: leavingRoute ? '-130%' : '0%' }}
        transition={reduceMotion ? { duration: 0 } : leavingRoute ? { type: 'spring', stiffness: 80, damping: 20, mass: 1.1 } : SPRING_EDITOR_REVEAL}
      >
        <LayersPanel stickerId={sticker.id} onBeforeBack={prepareReturn} />
      </motion.div>
      <motion.div className={styles.inspector}
        initial={reduceMotion ? false : { x: '130%' }}
        animate={reduceMotion ? { opacity: leavingRoute ? 0 : 1 } : { x: leavingRoute ? '130%' : '0%' }}
        transition={reduceMotion ? { duration: 0 } : leavingRoute ? { type: 'spring', stiffness: 80, damping: 20, mass: 1.1 } : SPRING_EDITOR_REVEAL}
      >
        <InspectorPanel />
      </motion.div>
      <div className={styles.stage} ref={stageRef}>
        <div className={styles.zoomFrame} ref={frameRef} style={{ transform: `scale(${zoom})` }}>
          <div ref={canvasSurfaceRef} className={styles.canvasFrame}
            style={{ visibility: flight?.id === sticker.id || leaving || leavingRoute ? 'hidden' : 'visible' }}>
            <motion.div className={styles.canvasContent} initial={false}
              animate={{ opacity: canvasSettled ? 1 : 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}>
              <EditorCanvas key={sticker.id} source={sticker.preview.src} topText={sticker.name.toUpperCase()} preset={sticker.editorDefaults} onReady={handleCanvasReady} onError={handleCanvasError} />
            </motion.div>
          </div>
          <div ref={heroDetailsRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }}
            dangerouslySetInnerHTML={{ __html: `<svg width="100%" height="100%" viewBox="0 0 1024 1024">${detailsSvg}</svg>` }} />
          <div ref={heroTitleRef} className={styles.heroTitle} aria-hidden="true"
            style={{
              inset: 0,
              transform: 'none',
              fontSize: `${titleLayout.fontSize / 1024 * 100}cqw`,
              fontFamily: titleLayout.fontFamily,
              fontWeight: titleLayout.fontWeight,
              color: titleLayout.color,
            }} dangerouslySetInnerHTML={{ __html: `<svg width="100%" height="100%" viewBox="0 0 1024 1024">${titleLayout.svg}</svg>` }} />
          {imagePlacement && <div ref={heroRef} className={styles.heroImage}
              style={{
                left: `${imagePlacement.left / 1024 * 100}%`,
                top: `${imagePlacement.top / 1024 * 100}%`,
                width: `${imagePlacement.width / 1024 * 100}%`,
                height: `${imagePlacement.height / 1024 * 100}%`,
                transform: `rotate(${imagePlacement.angle}deg)`,
                opacity: 0,
              }}
              >
              <img src={sticker.preview.src} alt="" draggable={false} />
            </div>}
        </div>
        <motion.div className={styles.toolbarLayer} animate={{ opacity: leavingRoute ? 0 : 1 }} transition={{ duration: reduceMotion ? 0 : 0.45 }}>
          <CanvasToolbar corner={14} />
        </motion.div>
      </div>
    </motion.main>
  )
}
