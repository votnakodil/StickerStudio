import { GLOW_LAYERS } from '../IntelligenceGlow/layers'

/** The original glow layers as a soft texture, without browser canvas filters. */
export function glowCoverage(x: number, y: number, size: number, cardSize: number, interiorOpacity = 0) {
  const half = size / 4
  const radius = 24 * (size / 2) / cardSize
  const qx = Math.abs(x - size / 2) - (half - radius)
  const qy = Math.abs(y - size / 2) - (half - radius)
  const distance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
  let transparent = 1
  for (const layer of GLOW_LAYERS) {
    const sigma = layer.b * (size / 2) / cardSize
    const thickness = layer.t * (size / 2) / cardSize
    const coverage = layer.o * thickness / (Math.sqrt(2 * Math.PI) * sigma) * Math.exp(-distance * distance / (2 * sigma * sigma))
    transparent *= 1 - Math.min(1, coverage)
  }
  // A soft interior bridges the expanding wave to the halo following the photo.
  const interior = interiorOpacity / (1 + Math.exp(distance / (size / 32)))
  // Leave a transparent margin so expanding the texture cannot expose its edges.
  return (1 - transparent * (1 - interior)) * Math.min(1, Math.max(0, Math.min(x, y, size - x, size - y) / (size / 16)))
}
