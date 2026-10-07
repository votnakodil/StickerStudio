/** Capture the visible loading square before cancellation changes its state. */
export function snapshotPhotoProcessingSurface(surface: HTMLElement) {
  const dots = surface.querySelector<HTMLCanvasElement>('[data-slot="image-generation"] canvas')
  if (!dots || !dots.width || !dots.height || !dots.parentElement) return undefined
  const snapshot = document.createElement('canvas')
  snapshot.width = dots.width
  snapshot.height = dots.height
  const context = snapshot.getContext('2d')
  if (!context) return undefined
  const fieldStyle = getComputedStyle(dots.parentElement)
  context.fillStyle = fieldStyle.backgroundColor
  context.fillRect(0, 0, snapshot.width, snapshot.height)
  context.drawImage(dots, 0, 0)
  return snapshot
}
