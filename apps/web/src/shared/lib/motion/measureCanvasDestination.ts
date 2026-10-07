/** Measure the shared canvas size before mounting the editor route. */
export function measureCanvasDestination() {
  const probe = document.createElement('div')
  Object.assign(probe.style, { position: 'fixed', left: '50%', top: '50%',
    width: 'var(--sticker-canvas-size)', aspectRatio: '1', transform: 'translate(-50%, -50%)',
    visibility: 'hidden', pointerEvents: 'none' })
  document.body.append(probe)
  const { left, top, width, height } = probe.getBoundingClientRect()
  probe.remove()
  return { left, top, width, height }
}
