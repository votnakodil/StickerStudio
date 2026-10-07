/** Exact separable Euclidean distance transform, including fractional alpha seeds. */
export function outlineDistances(pixels: Uint8ClampedArray, width: number, height: number) {
  const distances = new Float32Array(width * height)
  const length = Math.max(width, height)
  const input = new Float64Array(length)
  const output = new Float64Array(length)
  const sites = new Int32Array(length)
  const boundaries = new Float64Array(length + 1)
  const transform = (count: number) => {
    let last = 0
    sites[0] = 0
    boundaries[0] = -Infinity
    boundaries[1] = Infinity
    for (let q = 1; q < count; q++) {
      let intersection = 0
      do {
        const previous = sites[last]
        intersection = ((input[q] + q * q) - (input[previous] + previous * previous)) / (2 * (q - previous))
        if (intersection > boundaries[last]) break
        last--
      } while (last >= 0)
      last++
      sites[last] = q
      boundaries[last] = intersection
      boundaries[last + 1] = Infinity
    }
    last = 0
    for (let q = 0; q < count; q++) {
      while (boundaries[last + 1] < q) last++
      output[q] = (q - sites[last]) ** 2 + input[sites[last]]
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = pixels[(y * width + x) * 4 + 3] / 255
      input[x] = alpha > 0 ? (1 - alpha) ** 2 : 1e12
    }
    transform(width)
    for (let x = 0; x < width; x++) distances[y * width + x] = output[x]
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) input[y] = distances[y * width + x]
    transform(height)
    for (let y = 0; y < height; y++) distances[y * width + x] = Math.sqrt(output[y])
  }
  return distances
}
