import type { FabricImage } from 'fabric'
import { palette } from '@sticker-studio/theme'
import type { ImageErasedPath, StickerImage } from '../types'

interface ErasureSurface {
  base: ReturnType<FabricImage['getElement']>
  mask: HTMLCanvasElement
  output: HTMLCanvasElement
  paths: readonly ImageErasedPath[]
  painted: number
  regionsPainted: number
}
const surfaces = new WeakMap<FabricImage, ErasureSurface>()

/** Composite the erase mask after roundness, keeping the original photograph intact. */
export function applyImageErasure(image: FabricImage, base?: ReturnType<FabricImage['getElement']>) {
  const paths = (image as StickerImage).stickerErasedPaths ?? []
  let surface = surfaces.get(image)
  if (!surface) {
    const mask = document.createElement('canvas')
    const output = document.createElement('canvas')
    mask.width = output.width = image.width
    mask.height = output.height = image.height
    surface = { base: base ?? image.getElement(), mask, output, paths: [], painted: 0, regionsPainted: 0 }
    surfaces.set(image, surface)
  } else if (base) surface.base = base
  const regions = (image as StickerImage).stickerErasedRegions ?? []
  if (!paths.length && !regions.length) return
  const maskContext = surface.mask.getContext('2d')
  const outputContext = surface.output.getContext('2d')
  if (!maskContext || !outputContext) return
  // A live gesture replaces its last path. Rebuild that mask instead of
  // accumulating antialiased caps each time the same stroke is rendered.
  if (surface.paths.some((path, index) => paths[index] !== path)) {
    maskContext.clearRect(0, 0, image.width, image.height)
    surface.painted = surface.regionsPainted = 0
  }
  for (const path of paths.slice(surface.painted)) paintPath(maskContext, path)
  surface.painted = paths.length
  surface.paths = paths
  maskContext.fillStyle = palette.white
  for (const region of regions.slice(surface.regionsPainted)) maskContext.fillRect(region.x, region.y, region.width, region.height)
  surface.regionsPainted = regions.length
  outputContext.clearRect(0, 0, image.width, image.height)
  outputContext.globalCompositeOperation = 'source-over'
  outputContext.drawImage(surface.base, 0, 0)
  outputContext.globalCompositeOperation = 'destination-out'
  outputContext.drawImage(surface.mask, 0, 0)
  image.setElement(surface.output)
}

function paintPath(context: CanvasRenderingContext2D, path: ImageErasedPath) {
  if (!path.points.length || path.radiusX <= 0 || path.radiusY <= 0) return
  context.save()
  context.scale(path.radiusX, path.radiusY)
  context.fillStyle = context.strokeStyle = palette.white
  context.lineWidth = 2
  context.lineCap = context.lineJoin = 'round'
  const first = path.points[0]
  if (path.points.length === 1) {
    context.beginPath()
    context.arc(first.x / path.radiusX, first.y / path.radiusY, 1, 0, Math.PI * 2)
    context.fill()
    context.restore()
    return
  }
  // Preserve the pixel coverage of previously saved polyline masks.
  if (!path.smooth) {
    context.beginPath()
    context.arc(first.x / path.radiusX, first.y / path.radiusY, 1, 0, Math.PI * 2)
    context.fill()
  }
  context.beginPath()
  context.moveTo(first.x / path.radiusX, first.y / path.radiusY)
  if (path.smooth && path.points.length > 2) {
    for (let i = 1; i < path.points.length - 1; i++) {
      const point = path.points[i], next = path.points[i + 1]
      context.quadraticCurveTo(point.x / path.radiusX, point.y / path.radiusY,
        (point.x + next.x) / (2 * path.radiusX), (point.y + next.y) / (2 * path.radiusY))
    }
    const last = path.points[path.points.length - 1]
    context.lineTo(last.x / path.radiusX, last.y / path.radiusY)
  } else {
    for (const point of path.points.slice(1)) context.lineTo(point.x / path.radiusX, point.y / path.radiusY)
  }
  context.stroke()
  context.restore()
}
