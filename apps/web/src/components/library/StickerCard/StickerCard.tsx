import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router-dom'
import type { StickerTemplate } from '../../../data/stickers'
import { useHeroArtworkTransition } from '../../ui/useHeroArtworkTransition'
import styles from './StickerCard.module.css'

interface StickerCardProps {
  sticker: StickerTemplate
}

export function StickerCard({ sticker }: StickerCardProps) {
  const reduceMotion = useReducedMotion()
  const cardRef = useRef<HTMLAnchorElement>(null)
  const imageRef = useRef<HTMLDivElement>(null)
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
  const hoverScale = previewScale * 1.06
  const x = framing?.x ?? 0
  const y = framing?.y ?? 0
  const imageStyle = {
    '--image-left': `${(1 - previewScale) * 50 + x}%`,
    '--image-top': `${(1 - previewScale) * 50 + y}%`,
    '--image-size': `${previewScale * 100}%`,
    '--image-hover-left': `${(1 - hoverScale) * 50 + x}%`,
    '--image-hover-top': `${(1 - hoverScale) * 50 + y}%`,
    '--image-hover-size': `${hoverScale * 100}%`,
  } as CSSProperties

  return (
    <div className={styles.sharedCard}>
      <Link ref={cardRef} className={styles.card} to={`/editor/${encodeURIComponent(sticker.id)}`} state={{ fromLibrary: true }} aria-label={`Edit ${sticker.name} sticker`}
        onClick={(event) => {
          if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
            if (imageRef.current && cardRef.current) {
              begin(sticker.id, sticker.preview.src, 'open',
                { artwork: imageRef.current, surface: cardRef.current, title: labelRef.current })
            }
          }
        }}>
        <div ref={imageRef} className={styles.imageShell} style={{ ...imageStyle, opacity: artworkHidden ? 0 : 1 }}>
          <picture className={styles.picture}>
            {sticker.preview.darkSrc && <source media="(prefers-color-scheme: dark)" srcSet={sticker.preview.darkSrc} />}
            <img className={styles.image} src={sticker.preview.src} alt="" loading="eager" decoding="sync" draggable={false} />
          </picture>
        </div>
        <div className={styles.chrome}>
          {/* Blur the artwork itself so revealing it after a flight never
              invalidates a backdrop-filter surface. Only fade the overlay. */}
          <motion.div className={styles.blurArtwork} initial={false}
            animate={{ opacity: chromeOpacity }} transition={{ type: 'tween', duration: reduceMotion ? 0 : 0.22, delay: returningFlight && flight.settled && !reduceMotion ? 0.08 : 0, ease: 'easeOut' }}>
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
              animate={{ opacity: chromeOpacity }}
              transition={{ type: 'tween', duration: reduceMotion ? 0 : 0.22, delay: returningFlight && flight.settled && !reduceMotion ? 0.08 : 0, ease: 'easeOut' }} />
          </div>
          <span className={styles.label} style={{ opacity: artworkHidden ? 0 : 1 }}><span ref={labelRef}>{sticker.name}</span></span>
        </div>
      </Link>
    </div>
  )
}
