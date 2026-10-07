/** Trace directed pixel edges into closed paths, including holes in the mask. */
export function selectionContours(mask: Uint8Array, width: number, height: number) {
  const stride = width + 1
  const edges = new Map<number, number[]>()
  const edge = (x: number, y: number, endX: number, endY: number) => {
    const start = y * stride + x, end = endY * stride + endX
    const next = edges.get(start)
    if (next) next.push(end)
    else edges.set(start, [end])
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x
    if (!mask[i]) continue
    if (!y || !mask[i - width]) edge(x, y, x + 1, y)
    if (x === width - 1 || !mask[i + 1]) edge(x + 1, y, x + 1, y + 1)
    if (y === height - 1 || !mask[i + width]) edge(x + 1, y + 1, x, y + 1)
    if (!x || !mask[i - 1]) edge(x, y + 1, x, y)
  }
  const contours: number[][] = []
  while (edges.size) {
    const first = edges.keys().next().value
    if (first === undefined) break
    const points: number[] = [first % stride, Math.floor(first / stride)]
    let current = first
    do {
      const next = edges.get(current)
      const end = next?.pop()
      if (end === undefined) break
      if (!next?.length) edges.delete(current)
      points.push(end % stride, Math.floor(end / stride))
      current = end
    } while (current !== first)
    contours.push(points)
  }
  return contours
}
