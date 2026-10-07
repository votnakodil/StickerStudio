import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'
import { motionTokens } from '@/shared/lib/motion'
import { GlowExpansionContext, type GlowDestination } from './useGlowExpansion'
import { glowCoverage } from './glowCoverage'
import styles from './GlowExpansion.module.css'

type Cloud = { left: number; top: number; size: number; colors: string[]; startTime: CSSNumberish | null; destination?: GlowDestination }

function ExpandingCloud({ cloud, onComplete }: { cloud: Cloud; onComplete: () => void }) {
  const origin = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const texture = useRef<HTMLCanvasElement>(null)
  useLayoutEffect(() => {
    const movingOrigin = origin.current
    const element = frame.current
    const canvas = texture.current
    const context = canvas?.getContext('2d')
    if (!element || !canvas || !context) return
    // Rasterize the colored cloud once; expansion only changes transform/opacity.
    const size = 256
    canvas.width = canvas.height = size
    const gradient = context.createConicGradient(0, size / 2, size / 2)
    cloud.colors.forEach((color, index) => gradient.addColorStop(index / (cloud.colors.length - 1), color))
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
    const pixels = context.getImageData(0, 0, size, size)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        pixels.data[(y * size + x) * 4 + 3] = Math.round(255 * glowCoverage(x + 0.5, y + 0.5, size, cloud.size / 2, 0.16))
      }
    }
    context.putImageData(pixels, 0, 0)
    const centerX = cloud.left + cloud.size / 2
    const centerY = cloud.top + cloud.size / 2
    const scale = 2 * Math.max(centerX, innerWidth - centerX, centerY, innerHeight - centerY) / (cloud.size * 0.5) + 1
    const animation = element.animate([
      { transform: 'scale(1)', opacity: 1, offset: 0 },
      { transform: `scale(${scale * 0.7})`, opacity: 0.7, offset: 0.6 },
      { transform: `scale(${scale})`, opacity: 0, offset: 1 },
    ], { duration: motionTokens.duration.photoGlowExpansion * 1000, easing: `cubic-bezier(${motionTokens.ease.photoTravel.join(',')})`, fill: 'forwards' })
    const startTime = cloud.startTime ?? document.timeline.currentTime
    animation.startTime = startTime
    const companions: Animation[] = []
    if (cloud.destination && movingOrigin) {
      const destination = cloud.destination
      const dx = destination.left + destination.width / 2 - centerX
      const dy = destination.top + destination.height / 2 - centerY
      const travelOptions: KeyframeAnimationOptions = {
        duration: motionTokens.duration.photoTravel * 1000,
        easing: `cubic-bezier(${motionTokens.ease.photoTravel.join(',')})`, fill: 'both',
      }
      companions.push(movingOrigin.animate([
        { transform: 'translate(0px, 0px)' },
        { transform: `translate(${dx}px, ${dy}px)` },
      ], travelOptions))
      companions.forEach(companion => { companion.startTime = startTime })
    }
    animation.onfinish = onComplete
    return () => { animation.onfinish = null; animation.cancel(); companions.forEach(companion => companion.cancel()) }
  }, [cloud, onComplete])
  return <div className={styles.overlay} data-slot="photo-glow-wave" aria-hidden="true">
    <div ref={origin} className={styles.origin}>
      <div ref={frame} data-slot="photo-glow-expansion" className={styles.cloud} style={{ left: cloud.left, top: cloud.top, width: cloud.size, height: cloud.size }}>
        <canvas ref={texture} className={styles.texture} />
      </div>
    </div>

  </div>
}

export function GlowExpansionProvider({ children }: { children: ReactNode }) {
  const [cloud, setCloud] = useState<Cloud | null>(null)
  const reduce = useReducedMotion()
  return <GlowExpansionContext.Provider value={(element, startTime, destination) => {
    if (reduce) return
    const bounds = element.getBoundingClientRect()
    const color = getComputedStyle(element)
    const size = bounds.width / 0.5
    setCloud({ destination, startTime: startTime ?? document.timeline.currentTime, left: bounds.left - (size - bounds.width) / 2, top: bounds.top - (size - bounds.height) / 2, size,
      colors: ['--palette-tint010', '--palette-tint015', '--palette-tint006', '--palette-tint016', '--palette-tint017', '--palette-tint012', '--palette-tint010'].map(token => color.getPropertyValue(token).trim()) })
  }}>
    {children}
    {cloud && <ExpandingCloud cloud={cloud} onComplete={() => setCloud(null)} />}
  </GlowExpansionContext.Provider>
}
