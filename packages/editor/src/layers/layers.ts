import type { StickerCanvas, StickerLayer } from '../types'
import { Textbox, FabricImage, ActiveSelection } from 'fabric'
import { saveHistory } from '../history/history'

export function deleteSelectedObjects(
  canvas: StickerCanvas,
) {
  const selectedObjects =
    canvas.getActiveObjects()

  if (
    selectedObjects.length ===
    0
  ) {
    return
  }

  canvas.discardActiveObject()

  selectedObjects.forEach(
    (object) => {
      canvas.remove(
        object,
      )
    },
  )

  canvas.requestRenderAll()
}

export const layerIds = new WeakMap<object, string>()

export let nextLayerId = 0

export function layerId(object: object) {
  let id = layerIds.get(object)
  if (!id) {
    id = `layer-${++nextLayerId}`
    layerIds.set(object, id)
  }
  return id
}

export function reorderStickerLayers(canvas: StickerCanvas, frontToBackIds: readonly string[]) {
  const objects = canvas.getObjects()
  const byId = new Map(objects.map((object) => [layerId(object), object]))
  if (frontToBackIds.length !== objects.length || new Set(frontToBackIds).size !== objects.length
    || frontToBackIds.some((id) => !byId.has(id))) return false

  let changed = false
  ;[...frontToBackIds].reverse().forEach((id, index) => {
    changed = canvas.moveObjectTo(byId.get(id)!, index) || changed
  })
  if (changed) canvas.requestRenderAll()
  return changed
}

export function commitStickerLayerOrder(canvas: StickerCanvas, movedId: string) {
  const target = canvas.getObjects().find((object) => layerId(object) === movedId)
  if (target) canvas.fire('object:modified', { target })
}

export function getStickerLayers(canvas: StickerCanvas): StickerLayer[] {
  const selected = canvas.getActiveObjects()

  return canvas.getObjects().map((object, index) => {
    const base = {
      id: layerId(object),
      index,
      visible: object.visible,
      selected: selected.includes(object),
    }

    if (object instanceof Textbox) {
      return {
        ...base,
        kind: 'text' as const,
        title: object.text.trim() || 'Empty text',
        detail: `Text · ${Math.round(object.fontSize)} px`,
      }
    }

    if (object instanceof FabricImage) {
      return {
        ...base,
        kind: 'image' as const,
        title: 'Sticker image',
        detail: 'Image',
        thumbnail: object.getSrc(),
      }
    }

    return {
      ...base,
      kind: 'other' as const,
      title: 'Layer',
      detail: 'Object',
    }
  }).reverse()
}

export function selectStickerLayer(canvas: StickerCanvas, index: number, additive = false) {
  const object = canvas.getObjects()[index]
  if (!object || !object.visible) return

  if (additive) {
    const selected = canvas.getActiveObjects()
    const next = selected.includes(object)
      ? selected.filter((item) => item !== object)
      : [...selected, object]

    canvas.discardActiveObject()
    if (next.length > 1) {
      canvas.setActiveObject(new ActiveSelection(next, { canvas }))
    } else if (next.length === 1) {
      canvas.setActiveObject(next[0])
    }
  } else {
    canvas.setActiveObject(object)
  }
  canvas.requestRenderAll()
}

export function selectStickerCanvas(canvas: StickerCanvas) {
  canvas.discardActiveObject()
  canvas.requestRenderAll()
}

export function scaleSelectedStickerLayers(canvas: StickerCanvas, factor: number) {
  const selection = canvas.getActiveObject()
  if (!selection) return false

  const scaleX = selection.scaleX * factor
  const scaleY = selection.scaleY * factor
  if (Math.min(Math.abs(scaleX), Math.abs(scaleY)) < 0.05 || Math.max(Math.abs(scaleX), Math.abs(scaleY)) > 8) {
    return false
  }

  selection.set({ scaleX, scaleY })
  selection.setCoords()
  canvas.requestRenderAll()
  return true
}

export function commitStickerLayerScale(canvas: StickerCanvas) {
  saveHistory(canvas)
}

export function setStickerLayerVisibility(
  canvas: StickerCanvas,
  index: number,
  visible: boolean,
) {
  const object = canvas.getObjects()[index]
  if (!object || object.visible === visible) return

  if (!visible && canvas.getActiveObjects().includes(object)) {
    canvas.discardActiveObject()
  }

  object.set('visible', visible)
  canvas.fire('object:modified', { target: object })
  canvas.requestRenderAll()
}
