import { warmSavedStickerCanvas } from '../../model/libraryStore'
import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Link, useNavigate } from 'react-router-dom'
import { flushSync } from 'react-dom'
import { Flipped } from 'react-flip-toolkit'
import type { GridListLayout } from '@/shared/ui/GridList'
import type { StickerTemplate } from '@/features/library/model/stickers'
import { motionTokens } from '@/shared/lib/motion'
import { useHeroArtworkTransition } from '@/shared/ui/HeroArtworkTransition/useHeroArtworkTransition'
import styles from './StickerCard.module.css'

interface StickerCardProps {
  sticker: StickerTemplate
  saved?: boolean
  transitionArtwork?: boolean
  layout?: GridListLayout
  flipId?: string
}

export function StickerCard({ sticker, saved = false, transitionArtwork = true, layout = 'grid', flipId }: StickerCardProps) {
  const reduceMotion = useReducedMotion()
  const navigate = useNavigate()
  const navigationFrame = useRef(0)
  useEffect(() => () => cancelAnimationFrame(navigationFrame.current), [])
  const cardRef = useRef<HTMLAnchorElement>(null)
  const imageRef = useRef<HTMLPictureElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const { flight, begin, landAt } = useHeroArtworkTransition()
  const artworkInFlight = flight?.id === sticker.id
  const departingFlight = artworkInFlight && flight.direction === 'open'
  const returningFlight = artworkInFlight && flight.direction === 'close'
  const artworkHidden = artworkInFlight && !flight.settled
  const chromeOpacity = departingFlight || (returningFlight && !flight.settled) ? 0 : 1
  useLayoutEffect(() => {
    if (flight?.id === sticker.id && flight.direction === 'close' && !flight.to && imageRef.current && cardRef.current) {
      landAt(sticker.id, 'close', { artwork: imageRef.current, surface: cardRef.current, title: labelRef.current })
    }
  }, [flight, landAt, sticker.id, sticker.name])
  const framing = sticker.preview.framing
  const previewScale = framing?.scale ?? 1
  const x = framing?.x ?? 0
  const y = framing?.y ?? 0
  const imageStyle = {
    '--image-left': `${(1 - previewScale) * 50 + x}%`,
    '--image-top': `${(1 - previewScale) * 50 + y}%`,
    '--image-size': `${previewScale * 100}%`,
    '--image-hover-duration': `${motionTokens.duration.considered}s`,
    '--image-hover-ease': `cubic-bezier(${motionTokens.ease.standard.join(',')})`,
  } as CSSProperties

  return (
    <div className={`${styles.sharedCard} ${layout === 'list' ? styles.list : ''}`}>
      <Link ref={cardRef} className={styles.card} style={{ visibility: artworkHidden ? 'hidden' : 'visible' }} to={`/editor/${encodeURIComponent(sticker.id)}`} state={{ fromLibrary: true, fromSavedLibrary: saved }} aria-label={`Edit ${sticker.name} sticker`}
        onPointerEnter={() => { if (saved) void warmSavedStickerCanvas(sticker.id) }}
        onFocus={() => { if (saved) void warmSavedStickerCanvas(sticker.id) }}
        onClick={(event) => {
          if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
            if (transitionArtwork && imageRef.current && cardRef.current) {
              if (!reduceMotion) {
                event.preventDefault()
                if (navigationFrame.current) return
                const artwork = imageRef.current
                const surface = cardRef.current
                flushSync(() => begin(sticker.id, sticker.preview.src, 'open',
                  { artwork, surface, title: labelRef.current }))
                navigationFrame.current = requestAnimationFrame(() => {
                  navigationFrame.current = requestAnimationFrame(() => {
                    navigationFrame.current = 0
                    navigate(`/editor/${encodeURIComponent(sticker.id)}`, { state: { fromLibrary: true, fromSavedLibrary: saved } })
                  })
                })
              }
            }
          }
        }}>
        {/* Keep the mask on the card itself. Inverting the content's scale
            would pin the blur to the destination height during a layout flip. */}
        <div className={styles.chrome}>
          {/* Blur the artwork itself so revealing it after a flight never
              invalidates a backdrop-filter surface. Only fade the overlay. */}
          <motion.div className={styles.blurArtwork} initial={false}
            animate={{ opacity: layout === 'grid' ? chromeOpacity : 0 }} transition={{ type: 'tween', duration: reduceMotion ? 0 : 0.22, delay: returningFlight && flight.settled && !reduceMotion ? 0.08 : 0, ease: 'easeOut' }}>
            {[{ radius: 3.4, start: 0, end: 25 }, { radius: 10.2, start: 25, end: 75 }, { radius: 20.4, start: 75, end: 100 }].map((layer, index) => {
              const mask = `linear-gradient(to bottom, transparent ${74 + layer.start * 0.26}%, black ${74 + layer.end * 0.26}%)`
              return <div key={index} style={{ position: 'absolute', inset: 0, zIndex: index + 1, maskImage: mask, WebkitMaskImage: mask }}>
                <div className={styles.imageShell} style={imageStyle}>
                  <picture className={styles.picture}>
                    {sticker.preview.darkSrc && <source media="(prefers-color-scheme: dark)" srcSet={sticker.preview.darkSrc} />}
                    <img className={styles.image} src={sticker.preview.src} alt="" aria-hidden="true" draggable={false} style={{ filter: `blur(${layer.radius}px)` }} />
                  </picture>
                </div>
              </div>
            })}
          </motion.div>
          <div className={styles.blur}>
            <motion.div className={styles.blurTint} initial={false}
              animate={{ opacity: layout === 'grid' ? chromeOpacity : 0 }}
              transition={{ type: 'tween', duration: reduceMotion ? 0 : 0.22, delay: returningFlight && flight.settled && !reduceMotion ? 0.08 : 0, ease: 'easeOut' }} />
          </div>
        </div>
        <Flipped inverseFlipId={flipId}>
        <div className={styles.contents}>
        <Flipped flipId={`${flipId}-image`} shouldFlip={() => !reduceMotion}>
        <div className={styles.imageShell} style={{ ...imageStyle, opacity: artworkHidden ? 0 : 1 }}>
          <picture ref={imageRef} className={styles.picture}>
            {sticker.preview.darkSrc && <source media="(prefers-color-scheme: dark)" srcSet={sticker.preview.darkSrc} />}
            <img className={styles.image} src={sticker.preview.src} alt="" loading="eager" decoding="sync" draggable={false} />
          </picture>
        </div>
        </Flipped>
        </div>
        </Flipped>
        <Flipped inverseFlipId={flipId}>
        <div className={styles.labelContents}>
          <span className={styles.label} style={{ opacity: artworkHidden ? 0 : 1 }}>
            <Flipped flipId={`${flipId}-label`} shouldFlip={() => !reduceMotion}>
              <span ref={labelRef} className={styles.labelText}>{sticker.name}</span>
            </Flipped>
          </span>
        </div>
        </Flipped>
      </Link>
    </div>
  )
}
