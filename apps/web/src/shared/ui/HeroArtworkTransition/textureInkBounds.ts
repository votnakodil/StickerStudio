import type { HeroBounds } from './useHeroArtworkTransition'
import { hasUsableHeroBounds } from './heroBounds'

/** Convert measured glyph bounds to a small, padded texture readback. */
export function textureReadRegion(surface: HeroBounds, glyphs: HeroBounds | undefined, width: number, height: number, padding: number): HeroBounds {
  const full = { left: 0, top: 0, width, height }
  if (!glyphs || !hasUsableHeroBounds(surface) || !hasUsableHeroBounds(glyphs)) return full
  const left = Math.max(0, Math.floor((glyphs.left - padding - surface.left) / surface.width * width))
  const top = Math.max(0, Math.floor((glyphs.top - padding - surface.top) / surface.height * height))
  const right = Math.min(width, Math.ceil((glyphs.left + glyphs.width + padding - surface.left) / surface.width * width))
  const bottom = Math.min(height, Math.ceil((glyphs.top + glyphs.height + padding - surface.top) / surface.height * height))
  return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : full
}

/** Return exact painted bounds without scanning transparent rows outside the title. */
export function readTextureInkBounds(context: Pick<CanvasRenderingContext2D, 'getImageData'>, region: HeroBounds): HeroBounds | null {
  const pixels = context.getImageData(region.left, region.top, region.width, region.height).data
  let left = region.width, top = region.height, right = -1, bottom = -1
  for (let y = 0; y < region.height; y++) for (let x = 0; x < region.width; x++) {
    if (!pixels[(y * region.width + x) * 4 + 3]) continue
    left = Math.min(left, x); top = Math.min(top, y)
    right = Math.max(right, x); bottom = Math.max(bottom, y)
  }
  return right < left ? null : { left: region.left + left, top: region.top + top, width: right - left + 1, height: bottom - top + 1 }
}
