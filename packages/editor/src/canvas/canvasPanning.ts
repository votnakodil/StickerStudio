import { getEnv, Point, Textbox } from 'fabric'
import type { StickerCanvas } from '../types'

/** Temporary viewport panning never changes the selected tool, layer or history. */
export function installCanvasPanning(canvas: StickerCanvas) {
  const { window: view, document: page } = getEnv()
  const surface = canvas.upperCanvasEl
  let overCanvas = false
  let spaceHeld = false
  let dragging = false
  let lastX = 0
  let lastY = 0
  let savedCursor: { default: string; hover: string; surface: string } | null = null
  const restoreCursor = () => {
    if (!savedCursor) return
    canvas.defaultCursor = savedCursor.default
    canvas.hoverCursor = savedCursor.hover
    canvas.setCursor(savedCursor.surface)
    savedCursor = null
  }
  const showCursor = (cursor: string) => {
    savedCursor ??= { default: canvas.defaultCursor, hover: canvas.hoverCursor, surface: surface.style.cursor }
    canvas.defaultCursor = canvas.hoverCursor = cursor
    canvas.setCursor(cursor)
  }
  const cancel = () => { spaceHeld = false; dragging = false; restoreCursor() }
  const keyDown = (event: KeyboardEvent) => {
    if (event.code !== 'Space' || event.metaKey || event.ctrlKey || event.altKey) return
    const target = event.target
    const ElementClass = page.defaultView?.Element
    if (ElementClass && target instanceof ElementClass) {
      if (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return
      if (target.closest('button') && !overCanvas) return
    }
    const active = canvas.getActiveObject()
    if (active instanceof Textbox && active.isEditing) return
    event.preventDefault()
    spaceHeld = true
    if (!dragging) showCursor('grab')
  }
  const keyUp = (event: KeyboardEvent) => {
    if (event.code !== 'Space' || !spaceHeld) return
    event.preventDefault()
    cancel()
  }
  const down = (event: MouseEvent) => {
    if (event.button !== 0 || !(spaceHeld || canvas.editorTool === 'hand' || (event.altKey && canvas.editorTool !== 'quick-selection'))) return
    event.preventDefault()
    event.stopImmediatePropagation()
    dragging = true
    lastX = event.clientX
    lastY = event.clientY
    showCursor('grabbing')
  }
  const move = (event: MouseEvent) => {
    if (!dragging) return
    event.preventDefault()
    event.stopImmediatePropagation()
    canvas.relativePan(new Point(event.clientX - lastX, event.clientY - lastY))
    lastX = event.clientX
    lastY = event.clientY
  }
  const hover = (event: MouseEvent) => {
    if (!spaceHeld || dragging) return
    event.stopImmediatePropagation()
    showCursor('grab')
  }
  const up = (event: MouseEvent) => {
    if (!dragging) return
    event.preventDefault()
    event.stopImmediatePropagation()
    dragging = false
    if (spaceHeld) showCursor('grab')
    else restoreCursor()
  }
  const enter = () => { overCanvas = true }
  const leave = () => { overCanvas = false }
  const visibility = () => { if (page.hidden) cancel() }
  view.addEventListener('keydown', keyDown)
  view.addEventListener('keyup', keyUp)
  view.addEventListener('blur', cancel)
  page.addEventListener('visibilitychange', visibility)
  surface.addEventListener('mouseenter', enter)
  surface.addEventListener('mouseleave', leave)
  surface.addEventListener('mousedown', down, true)
  surface.addEventListener('mousemove', hover, true)
  page.addEventListener('mousemove', move, true)
  page.addEventListener('mouseup', up, true)
  const destroy = canvas.destroy.bind(canvas)
  canvas.destroy = () => {
    cancel()
    view.removeEventListener('keydown', keyDown)
    view.removeEventListener('keyup', keyUp)
    view.removeEventListener('blur', cancel)
    page.removeEventListener('visibilitychange', visibility)
    surface.removeEventListener('mouseenter', enter)
    surface.removeEventListener('mouseleave', leave)
    surface.removeEventListener('mousedown', down, true)
    surface.removeEventListener('mousemove', hover, true)
    page.removeEventListener('mousemove', move, true)
    page.removeEventListener('mouseup', up, true)
    destroy()
  }
}
