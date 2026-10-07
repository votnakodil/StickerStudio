export interface StickerRevealPlacement { left: number; top: number; width: number; height: number }

// Smoothly unroll the sticker in place from its bottom edge to its top edge.
export function getStickerUnfold(progress: number) {
  const value = Math.max(0, Math.min(1, progress))
  return value * value * (3 - 2 * value)
}
