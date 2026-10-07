import { FabricImage, getEnv, util } from 'fabric'
import { palette } from '@sticker-studio/theme'
import type { StickerCanvas, StickerImage } from '../types'
import { configureImageSmoothing } from './imageSmoothing'
import { applyImageErasure } from './imageErasure'
import { refreshImageBrushCursor } from './imageEraser'
import { imageOutlines } from './imageOutline'
import { selectBrushRegion, prepareSelectionColors, selectionRectangles } from './quickSelectionPixels'

import { selectionContours } from './selectionContours'

export type QuickSelectionMode = 'add' | 'subtract'
interface SelectionState {
  image: FabricImage | null
  mask: Uint8Array
  pixels: Uint8ClampedArray
  colors: Float32Array
  preview: HTMLCanvasElement | null
  previewVisible: boolean
  autoErase: boolean
  mode: QuickSelectionMode
  size: number
  selected: boolean
  contours: number[][]
  listeners: Set<() => void>
}
const selections = new WeakMap<StickerCanvas, SelectionState>()
function stateFor(canvas: StickerCanvas) {
  let state = selections.get(canvas)
  if (!state) { state = { image: null, mask: new Uint8Array(), pixels: new Uint8ClampedArray(), colors: new Float32Array(), preview: null, previewVisible: false, autoErase: false, mode: 'add', size: 25, selected: false, contours: [], listeners: new Set() }; selections.set(canvas, state) }
  return state
}
export function subscribeQuickSelection(canvas: StickerCanvas, listener: () => void) {
  const state = stateFor(canvas); state.listeners.add(listener)
  return () => { state.listeners.delete(listener) }
}
export function hasQuickSelection(canvas: StickerCanvas) { return stateFor(canvas).selected }
export function setQuickSelectionOptions(canvas: StickerCanvas, mode: QuickSelectionMode, size: number) {
  const state = stateFor(canvas); state.mode = state.autoErase ? 'add' : mode; state.size = Number.isFinite(size) ? Math.max(4, Math.min(120, size)) : 25
  if (canvas.editorTool === 'quick-selection') refreshImageBrushCursor(canvas, state.size)
}
export function setQuickSelectionAutoErase(canvas: StickerCanvas, enabled: boolean) {
  const state = stateFor(canvas)
  state.autoErase = enabled
  if (enabled) state.mode = 'add'
}
function refresh(canvas: StickerCanvas) {
  const state = stateFor(canvas), image = state.image
  state.selected = state.mask.some(value => value !== 0)
  state.contours = []
  if (image && state.selected) state.contours = selectionContours(state.mask, image.width, image.height)
  state.listeners.forEach(listener => listener()); canvas.requestRenderAll()
}
export function clearQuickSelection(canvas: StickerCanvas) {
  const state = stateFor(canvas); state.mask.fill(0); state.previewVisible = false; refresh(canvas)
}
export function invertQuickSelection(canvas: StickerCanvas) {
  const state = stateFor(canvas)
  if (!state.image || !state.selected) return
  for (let i = 0; i < state.mask.length; i++) state.mask[i] = state.pixels[i * 4 + 3] >= 8 && !state.mask[i] ? 1 : 0
  refresh(canvas)
}
export function deleteQuickSelection(canvas: StickerCanvas) {
  const state = stateFor(canvas), image = state.image
  if (!state.selected || !image || !canvas.getObjects().includes(image)) return false
  configureImageSmoothing(image)
  const sticker = image as StickerImage
  sticker.stickerErasedRegions = [...(sticker.stickerErasedRegions ?? []), ...selectionRectangles(state.mask, image.width, image.height)]
  applyImageErasure(image); imageOutlines.delete(sticker); image.dirty = true
  clearQuickSelection(canvas)
  state.pixels = new Uint8ClampedArray()
  canvas.fire('object:modified', { target: image })
  return true
}
function prepare(canvas: StickerCanvas, image: FabricImage) {
  const state = stateFor(canvas)
  if (state.image !== image) { state.image = image; state.mask = new Uint8Array(image.width * image.height); state.selected = false; state.contours = []; state.previewVisible = false }
  const surface = document.createElement('canvas'); surface.width = image.width; surface.height = image.height
  const context = surface.getContext('2d', { willReadFrequently: true })
  if (!context) return
  context.drawImage(image.getElement(), 0, 0)
  state.pixels = context.getImageData(0, 0, image.width, image.height).data
  state.colors = prepareSelectionColors(state.pixels, image.width, image.height)
}
function brushRegion(canvas: StickerCanvas, image: FabricImage, x: number, y: number) {
  const state = stateFor(canvas)
  if (state.image !== image || !state.pixels.length) prepare(canvas, image)
  const scale = image.getObjectScaling()
  return selectBrushRegion(state.pixels, state.colors, image.width, image.height, x, y,
    state.size / Math.max(scale.x, 0.05) / 2, state.size / Math.max(scale.y, 0.05) / 2)
}

/** Hover only previews; it does not change the committed mask or history. */
export function previewQuickSelection(canvas: StickerCanvas, image: FabricImage, x: number, y: number) {
  const state = stateFor(canvas)
  const region = brushRegion(canvas, image, x, y)
  state.preview ??= document.createElement('canvas')
  if (state.preview.width !== image.width || state.preview.height !== image.height) {
    state.preview.width = image.width; state.preview.height = image.height
  }
  const context = state.preview.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, image.width, image.height)
  context.fillStyle = palette.authBlueLight
  for (const rectangle of selectionRectangles(region, image.width, image.height)) {
    context.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height)
  }
  state.previewVisible = region.some(Boolean)
  return region
}

function applyRegion(canvas: StickerCanvas, region: Uint8Array, subtract = false) {
  const state = stateFor(canvas)
  const mode = !state.autoErase && (subtract || state.mode === 'subtract') ? 0 : 1
  for (let i = 0; i < region.length; i++) if (region[i]) state.mask[i] = mode
  refresh(canvas)
}
export function paintQuickSelection(canvas: StickerCanvas, image: FabricImage, x: number, y: number, subtract = false) {
  applyRegion(canvas, brushRegion(canvas, image, x, y), subtract)
}

export function installQuickSelection(canvas: StickerCanvas) {
  let animationFrame: number | null = null
  let dashOffset = 0
  const environment = getEnv().window
  const motionQuery = typeof environment.matchMedia === 'function'
    ? environment.matchMedia('(prefers-reduced-motion: reduce)') : null
  const stopAnimation = () => {
    if (animationFrame !== null) util.cancelAnimFrame(animationFrame)
    animationFrame = null
  }
  const destroy = canvas.destroy.bind(canvas)
  canvas.destroy = () => { stopAnimation(); motionQuery?.removeEventListener('change', motionChanged); destroy() }
  const motionChanged = () => { stopAnimation(); dashOffset = 0; canvas.requestRenderAll() }
  motionQuery?.addEventListener('change', motionChanged)
  let painting = false
  let pressedImage: FabricImage | null = null
  canvas.on('mouse:down:before', event => {
    if (canvas.editorTool !== 'quick-selection' || ('button' in event.e && event.e.button !== 0)) { painting = false; return }
    const selected = canvas.getActiveObject()
    pressedImage = selected instanceof FabricImage ? selected : null
    painting = Boolean(pressedImage)
  })
  let pending: { scenePoint: { x: number; y: number }; e: Event } | null = null
  const paint = (event: { scenePoint: { x: number; y: number }; e: Event }) => {
    const image = canvas.getActiveObject()
    if (!(image instanceof FabricImage) || !image.visible) return
    const point = util.transformPoint(event.scenePoint, util.invertTransform(image.calcTransformMatrix()))
    const region = previewQuickSelection(canvas, image, point.x + image.width / 2, point.y + image.height / 2)
    if (painting && region) applyRegion(canvas, region, 'altKey' in event.e && Boolean(event.e.altKey))
  }
  canvas.on('mouse:down', event => {
    if (canvas.editorTool !== 'quick-selection' || ('button' in event.e && event.e.button !== 0)) return
    const image = pressedImage ?? canvas.getActiveObject()
    pressedImage = null
    if (!(image instanceof FabricImage)) { painting = false; return }
    canvas.setActiveObject(image)
    prepare(canvas, image); painting = true; paint(event)
  })
  canvas.on('mouse:move', event => {
    if (canvas.editorTool !== 'quick-selection') return
    refreshImageBrushCursor(canvas, stateFor(canvas).size)
    pending = event; canvas.requestRenderAll()
  })
  canvas.on('before:render', () => {
    if (!pending) return
    const event = pending; pending = null
    if (canvas.editorTool === 'quick-selection') paint(event)
  })
  canvas.on('mouse:up', () => {
    const completed = painting && canvas.editorTool === 'quick-selection'
    if (pending && completed) paint(pending)
    pending = null
    painting = false
    if (completed && stateFor(canvas).autoErase) deleteQuickSelection(canvas)
  })
  canvas.on('mouse:out', () => { pending = null; stateFor(canvas).previewVisible = false; canvas.requestRenderAll() })
  const invalidate = () => {
    const state = stateFor(canvas)
    if (state.image && (!canvas.getObjects().includes(state.image) || (!painting && canvas.getActiveObject() !== state.image))) {
      state.image = null; state.mask = new Uint8Array(); state.selected = false; state.contours = []; state.previewVisible = false; state.listeners.forEach(listener => listener())
    }
  }
  canvas.on('object:removed', invalidate); canvas.on('selection:updated', invalidate); canvas.on('selection:cleared', invalidate)
  canvas.on('after:render', () => {
    const state = stateFor(canvas), image = state.image
    if (canvas.editorTool !== 'quick-selection' || !image || canvas.getActiveObject() !== image || (!state.selected && !state.previewVisible)) { stopAnimation(); return }
    const context = canvas.contextTop
    context.save()
    context.transform(...canvas.viewportTransform)
    context.transform(...image.calcTransformMatrix())
    context.translate(-image.width / 2, -image.height / 2)
    if (state.previewVisible && state.preview) {
      context.globalAlpha = 0.55
      context.drawImage(state.preview, 0, 0)
      context.globalAlpha = 1
    }
    context.beginPath()
    for (const contour of state.contours) {
      context.moveTo(contour[0], contour[1])
      for (let i = 2; i < contour.length; i += 2) context.lineTo(contour[i], contour[i + 1])
      context.closePath()
    }
    const scale = Math.max(image.getObjectScaling().x * canvas.getZoom(), 0.05)
    context.lineWidth = 1 / scale
    context.strokeStyle = palette.white; context.stroke()
    context.setLineDash([4 / scale, 4 / scale])
    context.lineDashOffset = -dashOffset / scale
    context.strokeStyle = palette.ink; context.stroke()
    context.restore()
    canvas.contextTopDirty = true
    if (!state.selected || motionQuery?.matches || canvas.disposed || canvas.destroyed) { stopAnimation(); return }
    if (animationFrame === null) {
      animationFrame = util.requestAnimFrame(timestamp => {
        animationFrame = null
        if (canvas.disposed || canvas.destroyed || canvas.editorTool !== 'quick-selection' || !stateFor(canvas).selected) return
        dashOffset = (timestamp / 60) % 8
        // Repaint only the overlay; the photo and selection analysis stay cached.
        canvas.renderTop()
      })
    }
  })
}
