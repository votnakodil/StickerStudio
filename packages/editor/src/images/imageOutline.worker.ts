import { smoothOutlineDistances } from './smoothOutlineDistances'
import { outlinePixels } from './outlinePixels'

interface OutlineRequest {
  pixels: Uint8ClampedArray
  width: number
  height: number
  scale: number
  stroke: { width: number; color: string }
}

self.onmessage = (event: MessageEvent<OutlineRequest>) => {
  const { pixels, width, height, scale, stroke } = event.data
  const distances = smoothOutlineDistances(pixels, width, height, scale)
  const coloredPixels = outlinePixels(distances, scale, stroke.width, stroke.color)
  self.postMessage({ distances, coloredPixels }, { transfer: [distances.buffer, coloredPixels.buffer] })
}
