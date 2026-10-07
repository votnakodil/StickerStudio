import { FabricImage, util } from 'fabric'
import { palette } from '@sticker-studio/theme'
import type { StickerCanvas, StickerImage } from '../types'
import { applyImageErasure } from './imageErasure'
import { configureImageSmoothing } from './imageSmoothing'
import { imageOutlines } from './imageOutline'

/** Image-local coordinates allow erased areas to follow all later layer transforms. */
export function eraseStickerImagePath(canvas: StickerCanvas, image: FabricImage, points: { x: number; y: number }[], diameter: number, commit = true, diameterY = diameter) {
  if (!canvas.getObjects().includes(image) || !points.length || !Number.isFinite(diameter) || diameter <= 0 || !Number.isFinite(diameterY) || diameterY <= 0 || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return
  writeErasedPath(canvas, image, points, diameter, diameterY, commit)
}

function writeErasedPath(canvas: StickerCanvas, image: FabricImage, points: { x: number; y: number }[], diameter: number, diameterY: number, commit: boolean, pathIndex?: number) {
  configureImageSmoothing(image)
  const sticker = image as StickerImage
  const paths = [...(sticker.stickerErasedPaths ?? [])]
  const path = { points: points.map(point => ({ ...point })), radiusX: diameter / 2, radiusY: diameterY / 2, smooth: pathIndex !== undefined }
  if (pathIndex === undefined) paths.push(path)
  else paths[pathIndex] = path
  sticker.stickerErasedPaths = paths
  applyImageErasure(image)
  imageOutlines.delete(sticker)
  image.dirty = true
  canvas.requestRenderAll()
  if (commit) canvas.fire('object:modified', { target: image })
}

export function setEraserSize(canvas: StickerCanvas, size: number) {
  canvas.eraserSize = Number.isFinite(size) ? Math.max(4, Math.min(120, size)) : 25
  refreshEraserCursor(canvas)
}

export function refreshEraserCursor(canvas: StickerCanvas) {
  if (canvas.editorTool !== 'eraser') return
  refreshImageBrushCursor(canvas, canvas.eraserSize)
}

export function refreshImageBrushCursor(canvas: StickerCanvas, size: number) {
  const diameter = Math.min(120, Math.max(4, size * canvas.getZoom() * (canvas.upperCanvasEl.getBoundingClientRect().width / canvas.getWidth() || 1)))
  const side = Math.ceil(diameter + 4)
  const center = side / 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"><circle cx="${center}" cy="${center}" r="${diameter / 2}" fill="none" stroke="${palette.white}" stroke-width="3"/><circle cx="${center}" cy="${center}" r="${diameter / 2}" fill="none" stroke="${palette.ink}" stroke-width="1"/></svg>`
  const cursor = `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${Math.floor(center)} ${Math.floor(center)}, crosshair`
  canvas.defaultCursor = canvas.hoverCursor = cursor
  canvas.setCursor(cursor)
}

export function installImageEraser(canvas: StickerCanvas) {
  let pressedImage: FabricImage | null = null
  canvas.on('mouse:down:before', () => {
    const selected = canvas.getActiveObject()
    pressedImage = selected instanceof FabricImage ? selected : null
  })
  let stroke: { image: FabricImage; points: { x: number; y: number }[]; diameter: number; diameterY: number; changed: boolean; pathIndex: number; paintedPoints: number } | null = null
  const flush = () => {
    if (!stroke?.points.length) return
    const points = stroke.points
    writeErasedPath(canvas, stroke.image, points, stroke.diameter, stroke.diameterY, false, stroke.pathIndex)
    stroke.paintedPoints = points.length
    stroke.changed = true
  }
  canvas.on('before:render', () => { if (stroke && stroke.points.length > stroke.paintedPoints) flush() })
  canvas.on('mouse:down', event => {
    if (canvas.editorTool !== 'eraser' || event.e.altKey || ('button' in event.e && event.e.button !== 0)) return
    const selected = pressedImage ?? canvas.getActiveObject()
    pressedImage = null
    if (!(selected instanceof FabricImage) || !selected.visible) return
    canvas.setActiveObject(selected)
    const point = util.transformPoint(event.scenePoint, util.invertTransform(selected.calcTransformMatrix()))
    const scale = selected.getObjectScaling()
    stroke = {
      image: selected, points: [{ x: point.x + selected.width / 2, y: point.y + selected.height / 2 }],
      diameter: canvas.eraserSize / scale.x, diameterY: canvas.eraserSize / scale.y, changed: false,
      pathIndex: (selected as StickerImage).stickerErasedPaths?.length ?? 0, paintedPoints: 0,
    }
    flush()
  })
  canvas.on('mouse:move', event => {
    if (canvas.editorTool !== 'eraser') return
    refreshEraserCursor(canvas)
    if (!stroke) return
    const point = util.transformPoint(event.scenePoint, util.invertTransform(stroke.image.calcTransformMatrix()))
    stroke.points.push({ x: point.x + stroke.image.width / 2, y: point.y + stroke.image.height / 2 })
    canvas.requestRenderAll()
  })
  const finish = () => {
    if (!stroke) return
    if (stroke.points.length > stroke.paintedPoints) flush()
    const finished = stroke
    stroke = null
    if (finished.changed && canvas.getObjects().includes(finished.image)) canvas.fire('object:modified', { target: finished.image })
  }
  canvas.on('mouse:up', finish)
  canvas.on('object:removed', finish)
}
