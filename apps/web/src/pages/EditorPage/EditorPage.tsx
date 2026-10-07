import { CanvasTexture } from '@/shared/ui/CanvasTexture/CanvasTexture'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { flushSync } from 'react-dom'
import { FabricImage, Textbox } from 'fabric'
import { SPRING_EDITOR_REVEAL } from '@/shared/lib/motion'
import { commitStickerLayerScale, scaleSelectedStickerLayers, type StickerCanvas } from '@sticker-studio/editor'
import { EditorCanvas, flushSavedStickerAutosave, useStickerArtworkSnapshot } from '@/features/editor'
import { CanvasToolbar } from '@/features/editor'
import { LayersPanel } from '@/features/editor'
import { InspectorPanel } from '@/features/editor'
import { useHeroArtworkTransition } from '@/shared/ui/HeroArtworkTransition/useHeroArtworkTransition'
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom'
import { IconPhotoBadgeExclamationmark } from 'symbols-react'
import { EmptyView } from '@/shared/ui/EmptyView/EmptyView'
import { findStickerById, initialStickerImagePlacement, useLibraryGalleryStore, useLibraryStore, loadMyLibrary, type StickerTemplate } from '@/features/library'
import { isCustomPhotoId, useCustomPhoto, useCustomPhotoTemplates, PhotoCutoutStatus, CustomPhotoCanvas, snapshotPhotoProcessingSurface } from '@/features/custom-photo'
import { BackButton } from '@/shared/ui/BackButton/BackButton'
import styles from './EditorPage.module.css'

function placementFromImage(image: FabricImage) {
  const center = image.getCenterPoint()
  const width = image.width * image.scaleX
  const height = image.height * image.scaleY
  return { left: center.x - width / 2, top: center.y - height / 2, width, height, angle: image.angle, opacity: image.opacity }
}

export function EditorPage({ leavingRoute = false }: { leavingRoute?: boolean }) {
  const reduceMotion = useReducedMotion()
  const location = useLocation()
  const navigate = useNavigate()
  const photoArrival = location.state?.fromPhotoUpload === true
  const photoTargetRef = useRef<HTMLDivElement>(null)
  const { stickerId } = useParams()
  const savedTemplateId = location.state?.fromSavedLibrary === true ? stickerId : undefined
  useEffect(() => {
    if (savedTemplateId) {
      useLibraryGalleryStore.getState().setCollection('library')
      void loadMyLibrary()
    }
  }, [savedTemplateId])
  const customId = isCustomPhotoId(stickerId) ? stickerId : undefined
  const savedPreview = useLibraryStore(state => savedTemplateId ? state.previews[savedTemplateId] : undefined)
  const savedIds = useLibraryStore(state => state.templateIds)
  const savedCustomTemplates = useCustomPhotoTemplates(savedIds)
  const savedCustomSticker = savedTemplateId ? savedCustomTemplates.find(template => template.id === savedTemplateId) : undefined
  const photo = useCustomPhoto(savedTemplateId ? undefined : customId)
  const cancelProcessingPhoto = photo.cancel
  const customSticker = useMemo<StickerTemplate | undefined>(() => photo.resultUrl && photo.photo ? {
    id: photo.photo.id, name: photo.photo.name,
    preview: { src: photo.resultUrl, visibleBounds: { left: 0, top: 0, width: 512, height: 512 } },
  } : undefined, [photo.resultUrl, photo.photo])
  const sticker: StickerTemplate | undefined = findStickerById(stickerId) ?? savedCustomSticker ?? customSticker
  const editorId = sticker?.id ?? customId ?? ''
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasSurfaceRef = useRef<HTMLDivElement>(null)
  const heroTitleRef = useRef<HTMLDivElement>(null)
  const heroDetailsRef = useRef<HTMLDivElement>(null)
  const [detailsSvg, setDetailsSvg] = useState('')
  const [outlinedArtwork, setOutlinedArtwork] = useState<{ source: HTMLCanvasElement; left: number; top: number; width: number; height: number } | null>(null)
  const [textArtwork, setTextArtwork] = useState<{ textSource: HTMLCanvasElement; titleSource: HTMLCanvasElement } | null>(null)
  const { prepareArtworkSnapshot, prepareTextSnapshot } = useStickerArtworkSnapshot()
  const layoutCanvasRef = useRef<StickerCanvas | null>(null)
  const imageRef = useRef<FabricImage | null>(null)
  const topTextRef = useRef<Textbox | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const returnPrepared = useRef(false)
  const { flight, begin, landAt, cancelFlight } = useHeroArtworkTransition()
  const canvasRef = useRef<StickerCanvas | null>(null)
  const savedImageOpacity = useRef(1)
  const pendingScale = useRef<{ canvas: StickerCanvas; timer: ReturnType<typeof setTimeout> } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [canvasLayoutReady, setCanvasLayoutReady] = useState(false)
  const [canvasSettled, setCanvasSettled] = useState(false)
  const [imagePlacement, setImagePlacement] = useState(() => sticker ? initialStickerImagePlacement(sticker) : null)
  const [titleLayout, setTitleLayout] = useState({
    text: sticker?.name.toUpperCase() ?? '',
    left: 512, top: 108, width: 400, fontSize: 72,
    fontFamily: 'Times New Roman', fontWeight: '700', color: undefined as string | undefined, svg: '',
  })
  const [leaving, setLeaving] = useState(false)
  const activeFlightId = flight?.id
  const activeFlightDirection = flight?.direction
  const arrivingArtwork = activeFlightId === editorId && activeFlightDirection === 'open' && !flight?.settled
  const waitingForArtwork = !reduceMotion && activeFlightId === editorId && activeFlightDirection === 'open' && !flight?.to
  const panelsHidden = leavingRoute || waitingForArtwork
  const inspectorHidden = panelsHidden || Boolean(customId && !savedTemplateId && !canvasSettled)
  useLayoutEffect(() => {
    if (leavingRoute) return
    if (customId && !savedTemplateId && activeFlightId === customId && activeFlightDirection === 'open' && canvasSurfaceRef.current && photoTargetRef.current) {
      landAt(customId, 'open', { surface: canvasSurfaceRef.current, artwork: photoTargetRef.current, title: null })
      return
    }
    if (!sticker || activeFlightId !== sticker.id || activeFlightDirection !== 'open') return
    if (canvasLayoutReady && canvasSettled && heroRef.current && canvasSurfaceRef.current) {
      landAt(sticker.id, 'open', { artwork: heroRef.current, surface: canvasSurfaceRef.current, title: heroTitleRef.current, details: heroDetailsRef.current }, canvasSettled)
    }
  }, [leavingRoute, activeFlightId, activeFlightDirection, landAt, sticker, customId, savedTemplateId, canvasLayoutReady, canvasSettled])

  const handleCanvasLayoutReady = useCallback((canvas: StickerCanvas, image: FabricImage) => {
    canvasRef.current = canvas
    layoutCanvasRef.current = canvas
    imageRef.current = image
    topTextRef.current = canvas.getObjects()
      .filter((object): object is Textbox => object instanceof Textbox)
      .sort((a, b) => a.getCenterPoint().y - b.getCenterPoint().y)[0] ?? null
    savedImageOpacity.current = image.opacity
    setImagePlacement(placementFromImage(image))
    const title = topTextRef.current
    setDetailsSvg(canvas.getObjects().filter((object) => object instanceof Textbox && object !== title && object.visible).map((object) => object.toSVG()).join(''))
    if (title) setTitleLayout({
      text: title.text, left: title.getCenterPoint().x, top: title.getCenterPoint().y,
      width: title.width * title.scaleX, fontSize: title.fontSize * title.scaleY,
      fontFamily: title.fontFamily, fontWeight: String(title.fontWeight),
      color: typeof title.fill === 'string' ? title.fill : undefined, svg: title.toSVG(),
    })
    setTextArtwork(prepareTextSnapshot(canvas))
    setCanvasLayoutReady(true)
  }, [prepareTextSnapshot])

  const handleCanvasReady = useCallback((canvas: StickerCanvas, image: FabricImage) => {
    if (layoutCanvasRef.current !== canvas) handleCanvasLayoutReady(canvas, image)
    try {
      setOutlinedArtwork(prepareArtworkSnapshot(canvas, image, Boolean(savedTemplateId)))
      canvas.renderAll()
    } finally { setCanvasSettled(true) }
  }, [handleCanvasLayoutReady, prepareArtworkSnapshot, savedTemplateId])
  const handleCanvasAvailable = useCallback((canvas: StickerCanvas) => { canvasRef.current = canvas }, [])
  const handleCanvasError = useCallback(() => { cancelFlight(editorId); setCanvasSettled(true) }, [cancelFlight, editorId])
  useEffect(() => {
    if (savedTemplateId && customId && photo.stage === 'error') cancelFlight(editorId)
  }, [savedTemplateId, customId, photo.stage, cancelFlight, editorId])

  const prepareReturn = useCallback((processingSnapshot?: HTMLCanvasElement) => {
    if (savedTemplateId && canvasRef.current) void flushSavedStickerAutosave(canvasRef.current)
    if (customId && !savedTemplateId) {
      if (processingSnapshot && !reduceMotion && !returnPrepared.current && canvasSurfaceRef.current) {
        returnPrepared.current = true
        begin(customId, '', 'close', { artwork: canvasSurfaceRef.current, surface: canvasSurfaceRef.current, title: null, previewTexture: processingSnapshot, dissolveOnLanding: true })
      }
      flushSync(() => setLeaving(true))
      return
    }
    if (reduceMotion || !sticker || returnPrepared.current) return
    returnPrepared.current = true
    const image = imageRef.current
    const canvas = canvasRef.current
    if (image) savedImageOpacity.current = image.opacity
    const placement = image ? placementFromImage(image) : initialStickerImagePlacement(sticker)
    const topText = topTextRef.current && topTextRef.current.visible && canvas?.getObjects().includes(topTextRef.current) ? topTextRef.current : null
    const artworkSnapshot = canvas && image ? prepareArtworkSnapshot(canvas, image, Boolean(savedTemplateId)) : undefined
    flushSync(() => {
      setImagePlacement({ ...placement, opacity: savedImageOpacity.current })
      if (canvas) {
        setTextArtwork(prepareTextSnapshot(canvas))
        if (artworkSnapshot) setOutlinedArtwork(artworkSnapshot)
      }
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
        savedTemplateId ? 1 : savedImageOpacity.current, savedTemplateId ? 0 : placement.angle))
    }
  }, [begin, customId, savedTemplateId, reduceMotion, sticker, prepareTextSnapshot, prepareArtworkSnapshot])

  const cancelPhoto = useCallback(async () => {
    const snapshot = !reduceMotion && canvasSurfaceRef.current ? snapshotPhotoProcessingSurface(canvasSurfaceRef.current) : undefined
    if (!await cancelProcessingPhoto()) return
    prepareReturn(snapshot)
    navigate('/library')
  }, [cancelProcessingPhoto, prepareReturn, navigate, reduceMotion])

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
      const canvas = canvasRef.current

      if (canvas?.getActiveObject()) {
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

  if (!sticker && (!customId || savedTemplateId && photo.stage === 'error')) {
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
      data-leaving={leavingRoute || undefined}
      data-preparing={customId && !savedTemplateId && (photo.stage !== 'ready' || !canvasSettled) || undefined}
      initial={false}
      style={{ pointerEvents: leavingRoute ? 'none' : 'auto' }}
    >
      <motion.div className={styles.backdrop} aria-hidden="true" initial={false}
        animate={{ opacity: leavingRoute || arrivingArtwork ? 0 : 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.32 }}
      />
      {customId && !savedTemplateId && (photo.stage !== 'ready' || !canvasSettled) && <div className={styles.photoBack}>
        <BackButton to="/library" aria-label="Back to sticker library" onClick={(event) => {
          if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) prepareReturn()
        }} />
      </div>}
      <motion.div className={styles.layers} inert={waitingForArtwork} aria-hidden={waitingForArtwork}
        initial={reduceMotion ? false : { x: '-130%' }}
        animate={reduceMotion ? { opacity: panelsHidden ? 0 : 1 } : { x: panelsHidden ? '-130%' : '0%' }}
        transition={reduceMotion ? { duration: 0 } : leavingRoute ? { type: 'spring', stiffness: 80, damping: 20, mass: 1.1 } : SPRING_EDITOR_REVEAL}
      >
        <LayersPanel editingEnabled={canvasSettled} stickerId={editorId} stickerName={sticker?.name} onBeforeBack={prepareReturn} />
      </motion.div>
      <motion.div className={styles.inspector} inert={!canvasSettled}
        initial={reduceMotion ? false : { x: '130%' }}
        aria-hidden={inspectorHidden}
        animate={reduceMotion ? { opacity: inspectorHidden ? 0 : 1 } : { x: inspectorHidden ? '130%' : '0%' }}
        transition={reduceMotion ? { duration: 0 } : leavingRoute ? { type: 'spring', stiffness: 80, damping: 20, mass: 1.1 } : SPRING_EDITOR_REVEAL}
      >
        {(!customId || savedTemplateId || canvasSettled) && <InspectorPanel />}
      </motion.div>
      <div className={styles.stage} ref={stageRef}>
        <div className={styles.zoomFrame} style={{ transform: `scale(${zoom})` }}>
          <div ref={canvasSurfaceRef} className={styles.canvasFrame}
            style={{ visibility: flight?.id === editorId || leaving || leavingRoute ? 'hidden' : 'visible' }}>
            {customId && !savedTemplateId ? <div className={styles.canvasContent}>
              <CustomPhotoCanvas savedTemplateId={savedTemplateId} key={editorId} state={photo} arriving={photoArrival} inTransit={flight?.id === editorId && flight.direction === 'open'} source={sticker?.preview.src} onCanvasAvailable={handleCanvasAvailable} onReady={handleCanvasReady} onError={handleCanvasError} />
            </div> : sticker && <motion.div className={styles.canvasContent} initial={false}
              animate={{ opacity: canvasSettled ? 1 : 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}>
              <EditorCanvas savedTemplateId={savedTemplateId} key={sticker.id} source={sticker.preview.src} topText={sticker.name.toUpperCase()} preset={sticker.editorDefaults} onLayoutReady={handleCanvasLayoutReady} onReady={handleCanvasReady} onError={handleCanvasError} />
            </motion.div>}
            <AnimatePresence>
              {customId && !savedTemplateId && photo.stage !== 'loading' && !(photo.stage === 'ready' && photo.resultSource === 'storage') && (photo.stage !== 'ready' || !canvasSettled) && <PhotoCutoutStatus key={customId} state={photo}
                onCancel={() => { void cancelPhoto() }} onRetry={() => { void photo.retry() }} cancelBusy={photo.cancelBusy} />}
            </AnimatePresence>
          </div>
          {customId && !savedTemplateId && flight?.id === customId && <div ref={photoTargetRef} aria-hidden="true" style={{
            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
            width: `${Math.min(1, flight.from.artwork.width / flight.from.artwork.height) * 100}%`,
            height: `${Math.min(1, flight.from.artwork.height / flight.from.artwork.width) * 100}%`,
          }} />}
          <div ref={heroDetailsRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }}>
            <svg width="100%" height="100%" viewBox="0 0 1024 1024" dangerouslySetInnerHTML={{ __html: detailsSvg }} />
            {textArtwork && <CanvasTexture kind="title" source={textArtwork.titleSource}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />}
            {textArtwork && <CanvasTexture kind="text" source={textArtwork.textSource}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />}
          </div>
          <div ref={heroTitleRef} className={styles.heroTitle} aria-hidden="true"
            style={{
              inset: 0,
              transform: 'none',
              fontSize: `${titleLayout.fontSize / 1024 * 100}cqw`,
              fontFamily: titleLayout.fontFamily,
              fontWeight: titleLayout.fontWeight,
              color: titleLayout.color,
            }} dangerouslySetInnerHTML={{ __html: `<svg width="100%" height="100%" viewBox="0 0 1024 1024">${titleLayout.svg}</svg>` }} />
          {(!customId || savedTemplateId) && sticker && imagePlacement && <div ref={heroRef} className={styles.heroImage}
              style={{
                left: `${savedTemplateId ? 0 : imagePlacement.left / 1024 * 100}%`,
                top: `${savedTemplateId ? 0 : imagePlacement.top / 1024 * 100}%`,
                width: `${savedTemplateId ? 100 : imagePlacement.width / 1024 * 100}%`,
                height: `${savedTemplateId ? 100 : imagePlacement.height / 1024 * 100}%`,
                transform: `rotate(${savedTemplateId ? 0 : imagePlacement.angle}deg)`,
                opacity: 0,
              }}
              >
              <img src={savedPreview ?? sticker.preview.src} alt="" draggable={false} />
              {outlinedArtwork && <CanvasTexture kind="artwork" source={outlinedArtwork.source}
                style={{ position: 'absolute', maxWidth: 'none', left: `${outlinedArtwork.left}%`, top: `${outlinedArtwork.top}%`,
                  width: `${outlinedArtwork.width}%`, height: `${outlinedArtwork.height}%` }} />}
            </div>}
        </div>
        {(!customId || savedTemplateId || canvasSettled && photo.stage === 'ready') && <motion.div className={styles.toolbarLayer} initial={false} inert={!canvasSettled || waitingForArtwork} animate={{ opacity: panelsHidden ? 0 : 1 }} transition={{ duration: reduceMotion ? 0 : 0.45 }}>
          <CanvasToolbar corner={14} />
        </motion.div>}
      </div>
    </motion.main>
  )
}
