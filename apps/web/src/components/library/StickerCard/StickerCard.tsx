import type { CSSProperties } from 'react'
import BlurEffect from 'react-progressive-blur'
import { Link } from 'react-router-dom'
import type { StickerTemplate } from '../../../data/stickers'
import styles from './StickerCard.module.css'

interface StickerCardProps {
  sticker: StickerTemplate
}

export function StickerCard({ sticker }: StickerCardProps) {
  const framing = sticker.preview.framing
  const offset = `translate(${framing?.x ?? 0}%, ${framing?.y ?? 0}%)`
  const previewScale = framing?.scale ?? 1
  const imageStyle = {
    '--preview-transform': `${offset} scale(${previewScale})`,
    '--preview-hover-transform': `${offset} scale(${previewScale * 1.06})`,
  } as CSSProperties

  return (
    <Link className={styles.card} to={`/editor/${encodeURIComponent(sticker.id)}`} aria-label={`Edit ${sticker.name} sticker`}>
      <picture className={styles.picture}>
        {sticker.preview.darkSrc && <source media="(prefers-color-scheme: dark)" srcSet={sticker.preview.darkSrc} />}
        <img className={styles.image} src={sticker.preview.src} alt="" loading="lazy" draggable={false} style={imageStyle} />
      </picture>
      <BlurEffect className={styles.blur} position="bottom" intensity={170} />
      <span className={styles.label}>{sticker.name}</span>
    </Link>
  )
}
