import type { StickerCanvas } from '../types'
import { FabricImage } from 'fabric'

export function updateStickerImageOpacity(canvas: StickerCanvas, image: FabricImage, opacity: number) {
  if (!canvas.getObjects().includes(image)) return
  image.set('opacity', Math.max(0, Math.min(1, opacity)))
  canvas.requestRenderAll()
  canvas.fire('object:modified', { target: image })
}

export async function addStickerImage(
  canvas: StickerCanvas,
  url: string,
  signal?: AbortSignal,
) {
  const image =
    await FabricImage.fromURL(
      url,
      {
        crossOrigin:
          'anonymous',
        signal,
      },
    )

  const maxSize = 640

  const width =
    image.width || 1

  const height =
    image.height || 1

  const scale =
    Math.min(
      maxSize / width,
      maxSize / height,
      1,
    )

  image.set({
    left: 512,
    top: 512,

    originX:
      'center',

    originY:
      'center',

    scaleX: scale,
    scaleY: scale,
  })

  canvas.add(image)

  canvas.setActiveObject(
    image,
  )

  canvas.requestRenderAll()

  return image
}

export function getVisibleImageBounds(image: FabricImage) {
  const width = image.width || 1
  const height = image.height || 1
  const surface = document.createElement('canvas')
  surface.width = width
  surface.height = height
  const context = surface.getContext('2d', { willReadFrequently: true })

  if (!context) return { left: 0, top: 0, width, height }

  try {
    context.drawImage(image.getElement(), 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height).data
    let left = width
    let top = height
    let right = -1
    let bottom = -1

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (pixels[(y * width + x) * 4 + 3] > 16) {
          left = Math.min(left, x)
          top = Math.min(top, y)
          right = Math.max(right, x)
          bottom = Math.max(bottom, y)
        }
      }
    }

    if (right >= left && bottom >= top) {
      return { left, top, width: right - left + 1, height: bottom - top + 1 }
    }
  } catch {
    // A source without readable pixels still fits by its full dimensions.
  }

  return { left: 0, top: 0, width, height }
}
