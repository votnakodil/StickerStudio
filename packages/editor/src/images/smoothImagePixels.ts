const colorSources = new WeakMap<Uint8ClampedArray, { width: number; height: number; sources: Int32Array }>()

/** Cache nearby source pixels for newly filled transparent notches. */
function nearbyColorSources(pixels: Uint8ClampedArray, width: number, height: number) {
  const cached = colorSources.get(pixels)
  if (cached?.width === width && cached.height === height) return cached.sources
  const count = width * height
  const sources = new Int32Array(count).fill(-1)
  const distances = new Int32Array(count).fill(count)
  for (let i = 0; i < count; i++) if (pixels[i * 4 + 3]) { sources[i] = i; distances[i] = 0 }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x
    if (x && distances[i - 1] + 1 < distances[i]) { distances[i] = distances[i - 1] + 1; sources[i] = sources[i - 1] }
    if (y && distances[i - width] + 1 < distances[i]) { distances[i] = distances[i - width] + 1; sources[i] = sources[i - width] }
  }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const i = y * width + x
    if (x < width - 1 && distances[i + 1] + 1 < distances[i]) { distances[i] = distances[i + 1] + 1; sources[i] = sources[i + 1] }
    if (y < height - 1 && distances[i + width] + 1 < distances[i]) { distances[i] = distances[i + width] + 1; sources[i] = sources[i + width] }
  }
  colorSources.set(pixels, { width, height, sources })
  return sources
}

/** Round the alpha contour with a crisp edge; preserve interior photo RGB. */
export function smoothImagePixels(pixels: Uint8ClampedArray, width: number, height: number, amount: number) {
  if (amount <= 0) return new Uint8ClampedArray(pixels)
  const spread = Math.min(64, Math.max(2, Math.min(width, height) / 24)) * amount / 100
  const radius = Math.floor(spread)
  const fraction = spread - radius
  let current = new Float32Array(width * height)
  let next = new Float32Array(width * height)
  for (let i = 0; i < current.length; i++) current[i] = pixels[i * 4 + 3] / 255
  // Three separable box passes approximate a Gaussian without browser-specific filters.
  const diameter = radius * 2 + 1 + fraction * 2
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
          const left = base + Math.max(0, position - radius - 1) * stride
          const right = base + Math.min(length - 1, position + radius + 1) * stride
          next[base + position * stride] = (sum + fraction * (current[left] + current[right])) / diameter
          sum += current[right] - current[base + Math.max(0, position - radius) * stride]
        }
      }
      ;[current, next] = [next, current]
    }
  }
  const output = new Uint8ClampedArray(pixels)
  let sources: Int32Array | undefined
  for (let i = 0; i < output.length; i += 4) {
    const alpha = current[i / 4]
    // Compensate for the wider mask averaging so the edge stays ~1 px crisp.
    const coverage = Math.min(1, Math.max(0, (alpha - 0.5) * Math.max(1, spread * 2.5) + 0.5))
    const roundedAlpha = coverage * coverage * (3 - 2 * coverage) * 255
    const strength = Math.min(1, amount / 5)
    output[i + 3] = Math.round(pixels[i + 3] + (roundedAlpha - pixels[i + 3]) * strength)
    // Newly filled notches borrow nearby photo color, avoiding dark transparent fringes.
    if (!pixels[i + 3] && output[i + 3] && alpha > 0) {
      sources ??= nearbyColorSources(pixels, width, height)
      const source = sources[i / 4] * 4
      if (source >= 0) for (let channel = 0; channel < 3; channel++) output[i + channel] = pixels[source + channel]
    }
  }
  return output
}
