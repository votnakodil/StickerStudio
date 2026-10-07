/** Color the distance field with the same subpixel coverage used by editing. */
export function outlinePixels(distances: Float32Array, scale: number, width: number, color: string) {
  const pixels = new Uint8ClampedArray(distances.length * 4)
  const hex = color.replace('#', '')
  const red = parseInt(hex.slice(0, 2), 16)
  const green = parseInt(hex.slice(2, 4), 16)
  const blue = parseInt(hex.slice(4, 6), 16)
  for (let index = 0; index < distances.length; index++) {
    const coverage = Math.min(1, Math.max(0, (width * scale - distances[index]) / scale + 0.5))
    if (!coverage) continue
    const pixel = index * 4
    pixels[pixel] = red
    pixels[pixel + 1] = green
    pixels[pixel + 2] = blue
    pixels[pixel + 3] = Math.round(coverage * 255)
  }
  return pixels
}
