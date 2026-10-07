/** Low-frequency color guides selection without freckles and compression noise. */
export function prepareSelectionColors(pixels: Uint8ClampedArray, width: number, height: number) {
  const horizontal = new Float32Array(pixels.length)
  const colors = new Float32Array(pixels.length)
  const weights = [1, 4, 6, 4, 1]
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4
    let total = 0
    for (let dx = -2; dx <= 2; dx++) {
      const sample = (y * width + Math.max(0, Math.min(width - 1, x + dx))) * 4
      const weight = weights[dx + 2] * pixels[sample + 3] / 255
      total += weight
      for (let c = 0; c < 3; c++) horizontal[offset + c] += pixels[sample + c] * weight
    }
    if (total) for (let c = 0; c < 3; c++) horizontal[offset + c] /= total
    horizontal[offset + 3] = pixels[offset + 3]
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4
    let total = 0
    for (let dy = -2; dy <= 2; dy++) {
      const sample = (Math.max(0, Math.min(height - 1, y + dy)) * width + x) * 4
      const weight = weights[dy + 2] * horizontal[sample + 3] / 255
      total += weight
      for (let c = 0; c < 3; c++) colors[offset + c] += horizontal[sample + c] * weight
    }
    if (total) for (let c = 0; c < 3; c++) colors[offset + c] /= total
  }
  return colors
}

/** A brush-sized, connected region grows through similar tones and stops at strong edges. */
export function selectBrushRegion(pixels: Uint8ClampedArray, colors: Float32Array, width: number, height: number, x: number, y: number, radiusX: number, radiusY: number) {
  const mask = new Uint8Array(width * height)
  x = Math.floor(x); y = Math.floor(y)
  if (x < 0 || y < 0 || x >= width || y >= height || pixels[(y * width + x) * 4 + 3] < 8) return mask
  const reachX = Math.max(5, radiusX * 4), reachY = Math.max(5, radiusY * 4)
  const left = Math.max(0, Math.floor(x - reachX)), right = Math.min(width - 1, Math.ceil(x + reachX))
  const top = Math.max(0, Math.floor(y - reachY)), bottom = Math.min(height - 1, Math.ceil(y + reachY))
  const boxWidth = right - left + 1, boxHeight = bottom - top + 1
  const seen = new Uint8Array(boxWidth * boxHeight), queue = new Int32Array(seen.length)
  const reference = [[], [], []] as number[][]
  for (let py = Math.max(top, Math.floor(y - radiusY * 0.55)); py <= Math.min(bottom, Math.ceil(y + radiusY * 0.55)); py++) {
    for (let px = Math.max(left, Math.floor(x - radiusX * 0.55)); px <= Math.min(right, Math.ceil(x + radiusX * 0.55)); px++) {
      const i = (py * width + px) * 4
      if (pixels[i + 3] < 8 || ((px - x) / radiusX) ** 2 + ((py - y) / radiusY) ** 2 > 0.3) continue
      for (let c = 0; c < 3; c++) reference[c].push(colors[i + c])
    }
  }
  const seed = (y * width + x) * 4
  const guide = reference.map((values, c) => {
    values.sort((a, b) => a - b)
    return values.length ? values[Math.floor(values.length / 2)] : colors[seed + c]
  })
  let head = 0, tail = 1
  queue[0] = (y - top) * boxWidth + x - left; seen[queue[0]] = 1
  while (head < tail) {
    const local = queue[head++], px = local % boxWidth + left, py = Math.floor(local / boxWidth) + top
    const i = py * width + px, offset = i * 4
    if (pixels[offset + 3] < 8) continue
    const distance = ((px - x) / reachX) ** 2 + ((py - y) / reachY) ** 2
    const colorDistance = Math.hypot(colors[offset] - guide[0], colors[offset + 1] - guide[1], colors[offset + 2] - guide[2])
    // The spatial penalty keeps a single dab local even on uniformly colored photos.
    const insideBrush = ((px - x) / radiusX) ** 2 + ((py - y) / radiusY) ** 2 <= 1
    if (distance > 1 || (!insideBrush && colorDistance + distance * 32 > 85)) continue
    mask[i] = 1
    const visit = (next: number) => {
      if (seen[next]) return
      const nx = next % boxWidth + left, ny = Math.floor(next / boxWidth) + top
      const sample = (ny * width + nx) * 4
      const edge = Math.hypot(colors[offset] - colors[sample], colors[offset + 1] - colors[sample + 1], colors[offset + 2] - colors[sample + 2])
      const insideBrush = ((nx - x) / radiusX) ** 2 + ((ny - y) / radiusY) ** 2 <= 1
      if (edge > 22 && !insideBrush) return
      seen[next] = 1; queue[tail++] = next
    }
    if (px > left) visit(local - 1)
    if (px < right) visit(local + 1)
    if (py > top) visit(local - boxWidth)
    if (py < bottom) visit(local + boxWidth)
  }
  // Fill small enclosed texture holes without bridging separate objects or image transparency.
  seen.fill(0)
  const holeLimit = Math.max(9, Math.round(radiusX * radiusY * 0.3))
  for (let start = 0; start < seen.length; start++) {
    const sx = start % boxWidth + left, sy = Math.floor(start / boxWidth) + top
    if (seen[start] || mask[sy * width + sx]) continue
    head = 0; tail = 1; queue[0] = start; seen[start] = 1
    let enclosed = true
    while (head < tail) {
      const local = queue[head++], px = local % boxWidth + left, py = Math.floor(local / boxWidth) + top
      if (px === left || px === right || py === top || py === bottom || pixels[(py * width + px) * 4 + 3] < 8) enclosed = false
      const visit = (next: number) => {
        const nx = next % boxWidth + left, ny = Math.floor(next / boxWidth) + top
        if (!seen[next] && !mask[ny * width + nx]) { seen[next] = 1; queue[tail++] = next }
      }
      if (px > left) visit(local - 1)
      if (px < right) visit(local + 1)
      if (py > top) visit(local - boxWidth)
      if (py < bottom) visit(local + boxWidth)
    }
    if (enclosed && tail <= holeLimit) for (let j = 0; j < tail; j++) {
      const local = queue[j]; mask[(Math.floor(local / boxWidth) + top) * width + local % boxWidth + left] = 1
    }
  }
  return mask
}

export function selectionRectangles(mask: Uint8Array, width: number, height: number) {
  const rectangles: { x: number; y: number; width: number; height: number }[] = []
  let previous = new Map<string, (typeof rectangles)[number]>()
  for (let y = 0; y < height; y++) {
    const row = new Map<string, (typeof rectangles)[number]>()
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue
      const start = x
      while (x + 1 < width && mask[y * width + x + 1]) x++
      const span = x - start + 1, key = `${start}:${span}`
      const existing = previous.get(key)
      if (existing) { existing.height++; row.set(key, existing) }
      else { const rectangle = { x: start, y, width: span, height: 1 }; rectangles.push(rectangle); row.set(key, rectangle) }
    }
    previous = row
  }
  return rectangles
}
