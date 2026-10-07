import { Flipped } from 'react-flip-toolkit'
import type { GridListRenderContext } from '@/shared/ui/GridList'
import { motion, useReducedMotion } from 'motion/react'
import { SPRING_PHOTO_ARRIVAL, motionTokens } from '@/shared/lib/motion'
import { useHeroArtworkTransition } from '@/shared/ui/HeroArtworkTransition/useHeroArtworkTransition'
import { useCallback, useLayoutEffect, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { measureCanvasDestination } from '@/shared/lib/motion/measureCanvasDestination'
import { useGlowExpansion } from '@/shared/ui/GlowExpansion/useGlowExpansion'
import { useNavigate } from 'react-router-dom'
import { usePhotoSelection, usePhotoArrival, isCustomPhotoId } from '@/features/custom-photo'
import { useDropzone } from 'react-dropzone'
import { IconPlus } from 'symbols-react'
import { IntelligenceGlow } from '@/shared/ui/IntelligenceGlow/index'
import styles from './AddPhotoCard.module.css'

const acceptedTypes = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
}

export function AddPhotoCard({ layout = 'grid', flipId }: Partial<GridListRenderContext>) {
  const navigate = useNavigate()
  const [glowDismissed, setGlowDismissed] = useState(false)
  const expandGlow = useGlowExpansion()
  const navigationFrame = useRef(0)
  useEffect(() => () => cancelAnimationFrame(navigationFrame.current), [])
  const cardRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const borderRef = useRef<SVGSVGElement>(null)
  const artworkRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { flight, begin, landAt } = useHeroArtworkTransition()
  const launch = useCallback((id: string, src: string) => {
    if (surfaceRef.current && artworkRef.current) {
      const surface = surfaceRef.current
      const source = { surface, artwork: artworkRef.current, title: null, border: borderRef.current }
      const destination = measureCanvasDestination()
      const startTime = document.timeline.currentTime
      if (reduce) begin(id, src, 'open', source, 1, 0, true, destination, startTime)
      else flushSync(() => {
        begin(id, src, 'open', source, 1, 0, true, destination, startTime)
        expandGlow(surface, startTime, destination)
      })
    }
    const openEditor = () => navigate(`/editor/${id}`, { state: { fromPhotoUpload: true } })
    if (reduce) openEditor()
    else navigationFrame.current = requestAnimationFrame(() => {
      navigationFrame.current = requestAnimationFrame(openEditor)
    })
  }, [navigate, begin, expandGlow, reduce])
  const { preview, prepareArrival, advance, completeArrival } = usePhotoArrival(launch)
  useLayoutEffect(() => { if (reduce && preview) completeArrival() }, [reduce, preview, completeArrival])
  useLayoutEffect(() => {
    if (flight?.direction === 'close' && flight.dissolveOnLanding && isCustomPhotoId(flight.id) && !flight.to && cardRef.current) {
      landAt(flight.id, 'close', { surface: cardRef.current, artwork: cardRef.current, title: null })
    }
  }, [flight, landAt])
  const { selectPhoto, busy, error, setError } = usePhotoSelection(prepareArrival)
  const { getRootProps, getInputProps, inputRef, isDragActive, isDragReject, isFileDialogActive, isProcessing } = useDropzone({
    accept: acceptedTypes,
    multiple: false,
    maxSize: 20 * 1024 * 1024,
    disabled: busy || Boolean(preview) || flight?.direction === 'open',
    onFileDialogOpen: () => setGlowDismissed(false),
    onFileDialogCancel: () => setGlowDismissed(true),
    onDropAccepted: ([file]) => { if (file) { setGlowDismissed(false); void selectPhoto(file) } },
    onDropRejected: (files) => setError(files.some((file) => file.errors.some((error) => error.code === 'file-too-large'))
      ? 'Choose an image smaller than 20 MB.' : 'Choose a PNG, JPG, or WebP image.'),
  })

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const dismissGlow = () => setGlowDismissed(true)
    input.addEventListener('cancel', dismissGlow)
    return () => input.removeEventListener('cancel', dismissGlow)
  }, [inputRef])

  const holdGlow = (!glowDismissed && isFileDialogActive) || isProcessing || busy || Boolean(preview)
  const className = [styles.dropzone, layout === 'list' && styles.list, (isDragActive || holdGlow) && styles.active, isDragReject && styles.reject].filter(Boolean).join(' ')

  return (
    <div className={styles.wrap} ref={cardRef}>
      <div {...getRootProps({ className, onPointerEnter: () => setGlowDismissed(false), style: { visibility: flight?.loading && flight.direction === 'open' ? 'hidden' : undefined }, role: 'button', 'aria-label': 'Add your photo. Click or drop a PNG, JPG, or WebP image.' })}>
        <input {...getInputProps()} />
        <svg className={styles.dashedBorder} aria-hidden="true">
          <rect x="1.5" y="1.5" width="100%" height="100%" rx="22.5" style={{ width: 'calc(100% - 3px)', height: 'calc(100% - 3px)' }} />
        </svg>
        <IntelligenceGlow active={holdGlow ? true : glowDismissed ? false : undefined} />
        <Flipped inverseFlipId={flipId}>
        <div className={styles.contents}>
        <span className={styles.content}>
          <Flipped flipId={`${flipId}-plus`} shouldFlip={() => !reduce}>
            <span className={styles.addIcon}><IconPlus width={28} height={28} fill="currentColor" aria-hidden="true" /></span>
          </Flipped>
          <span className={styles.title}>
            {busy || isDragActive ? <Flipped flipId={`${flipId}-status`} shouldFlip={() => !reduce}><span>{busy ? 'Preparing photo…' : 'Drop photo here'}</span></Flipped> : <>
              <Flipped flipId={`${flipId}-prompt`} shouldFlip={() => !reduce}><span>Click or drop</span></Flipped>
              <Flipped flipId={`${flipId}-here`} shouldFlip={() => !reduce}><span>here</span></Flipped>
            </>}
          </span>
          <Flipped flipId={`${flipId}-formats`} shouldFlip={() => !reduce}>
            <span className={styles.types}>PNG, JPG or WebP</span>
          </Flipped>
        </span>
        </div>
        </Flipped>
      </div>
      {preview && <div className={styles.previewClip} data-slot="photo-arrival-clip"><motion.div ref={surfaceRef} className={styles.preview} data-slot="photo-arrival" data-phase={preview.phase}
        initial={reduce ? false : { scale: 0.72, y: -44, opacity: 0 }}
        animate={{ scale: preview.phase === 'drop' ? 0.7 : preview.phase === 'compress' ? 0.63 : 1, y: 0, opacity: 1 }}
        transition={reduce ? { duration: 0 } : { ...SPRING_PHOTO_ARRIVAL, opacity: { type: 'tween', duration: motionTokens.duration.instant } }}
        onUpdate={(latest) => {
          if (preview.phase === 'drop' && typeof latest.y === 'number' && latest.y >= 0) advance()
          if (preview.phase === 'compress' && typeof latest.scale === 'number' && latest.scale <= 0.635) advance()
        }}
        onAnimationComplete={advance}
        style={{ visibility: flight?.id === preview.id ? 'hidden' : 'visible' }}>
        <div ref={artworkRef} className={styles.previewArtwork}><img src={preview.src} alt="Your selected photo" draggable={false} /></div>
      </motion.div></div>}
      {preview && <svg ref={borderRef} className={`${styles.dashedBorder} ${styles.previewBorder}`} aria-hidden="true" data-slot="photo-arrival-border">
        <rect x="1.5" y="1.5" width="100%" height="100%" rx="22.5" style={{ width: 'calc(100% - 3px)', height: 'calc(100% - 3px)' }} />
      </svg>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {busy && <span className={styles.srOnly} role="status">Preparing your canvas.</span>}
    </div>
  )
}
