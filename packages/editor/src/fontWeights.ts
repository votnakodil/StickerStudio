const regularAndBold = [400, 700] as const

export function getStickerFontWeights(fontFamily: string): readonly number[] {
  if (fontFamily === 'SF Pro Text') return [400, 500, 600, 700, 900]
  if (fontFamily === 'Impact') return [400]
  return regularAndBold
}

export function normalizeStickerFontWeight(fontFamily: string, weight: number | string): number {
  const numeric = weight === 'bold' ? 700 : weight === 'normal' ? 400 : Number(weight) || 400
  return getStickerFontWeights(fontFamily).reduce((best, candidate) =>
    Math.abs(candidate - numeric) < Math.abs(best - numeric) ? candidate : best,
  )
}
