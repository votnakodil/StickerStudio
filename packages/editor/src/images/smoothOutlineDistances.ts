import { outlineDistances } from './outlineDistances'

/** Round the geometric contour, then let the renderer threshold it to a crisp edge. */
export function smoothOutlineDistances(pixels: Uint8ClampedArray, width: number, height: number, scale: number) {
  let current = outlineDistances(pixels, width, height)
  const original = current.slice()
  const inverse = new Uint8ClampedArray(pixels.length)
  for (let i = 3; i < pixels.length; i += 4) inverse[i] = 255 - pixels[i]
  const interior = outlineDistances(inverse, width, height)
  for (let i = 0; i < current.length; i++) current[i] += pixels[i * 4 + 3] / 255 - interior[i]
  // A signed field keeps narrow strokes intact; smoothing alpha would feather the border.
  let next = interior
  const radius = Math.max(1, Math.round(Math.min(12, Math.max(8, Math.min(width, height) / scale / 80)) * scale))
  const diameter = radius * 2 + 1
  for (let pass = 0; pass < 3; pass++) {
    for (const horizontal of [true, false]) {
      const lines = horizontal ? height : width
      const length = horizontal ? width : height
      const stride = horizontal ? 1 : width
      for (let line = 0; line < lines; line++) {
        const base = horizontal ? line * width : line
        let sum = 0
        for (let offset = -radius; offset <= radius; offset++) {
          sum += current[base + Math.min(length - 1, Math.max(0, offset)) * stride]
        }
        for (let position = 0; position < length; position++) {
          next[base + position * stride] = sum / diameter
          sum += current[base + Math.min(length - 1, position + radius + 1) * stride]
            - current[base + Math.max(0, position - radius) * stride]
        }
      }
      ;[current, next] = [next, current]
    }
  }
  // Limit outward movement at concave corners so rounding cannot bridge the
  // gap above an ear and create a stroke much thicker than the chosen value.
  // Smooth saturation avoids a new kink where the constraint takes effect.
  const outwardLimit = 0.75 * scale
  for (let i = 0; i < current.length; i++) {
    const expansion = original[i] - current[i]
    if (expansion > 0) current[i] = original[i] - outwardLimit * Math.tanh(expansion / outwardLimit)
  }
  return current
}
