import type { Canvas, FabricObject } from 'fabric'

export interface AlignmentGuide {
  orientation: 'vertical' | 'horizontal'
  position: number
  source: keyof AxisBounds
}

interface AxisBounds {
  start: number
  center: number
  end: number
}

interface SnapMatch {
  delta: number
  position: number
  source: keyof AxisBounds
}

const SNAP_DISTANCE_PX = 8
const RELEASE_DISTANCE_PX = 12

function axisBounds(start: number, size: number): AxisBounds {
  return { start, center: start + size / 2, end: start + size }
}

function closestMatch(
  moving: AxisBounds,
  canvasSize: number,
  objects: AxisBounds[],
  sceneUnitsPerPixel: number,
  previous?: AlignmentGuide,
): SnapMatch | null {
  const snapDistance = SNAP_DISTANCE_PX * sceneUnitsPerPixel
  const releaseDistance = RELEASE_DISTANCE_PX * sceneUnitsPerPixel
  if (previous) {
    const delta = previous.position - moving[previous.source]
    if (Math.abs(delta) <= releaseDistance) {
      return { delta, position: previous.position, source: previous.source }
    }
  }

  let best: SnapMatch | null = null

  const consider = (source: keyof AxisBounds, destination: number) => {
    const delta = destination - moving[source]
    if (Math.abs(delta) <= snapDistance && (!best || Math.abs(delta) < Math.abs(best.delta))) {
      best = { delta, position: destination, source }
    }
  }

  consider('center', canvasSize / 2)
  consider('start', 0)
  consider('end', canvasSize)

  // The canvas boundary should win over a nearby edge on another layer.
  if (best) return best

  for (const object of objects) {
    for (const source of ['start', 'center', 'end'] as const) {
      for (const destination of [object.start, object.center, object.end]) {
        consider(source, destination)
      }
    }
  }

  return best
}

function sceneUnitsPerPixel(canvas: Canvas, orientation: AlignmentGuide['orientation']) {
  const size = orientation === 'vertical' ? canvas.getWidth() : canvas.getHeight()
  const rect = canvas.upperCanvasEl?.getBoundingClientRect()
  const renderedSize = orientation === 'vertical' ? rect?.width : rect?.height
  return size / (renderedSize && renderedSize > 0 ? renderedSize : size / 2)
}

export function snapStickerObject(
  canvas: Canvas,
  moving: FabricObject,
  previous: AlignmentGuide[] = [],
): AlignmentGuide[] {
  // Fabric fires object:moving before refreshing its cached corner coordinates.
  moving.setCoords()
  const bounds = moving.getBoundingRect()
  const selected = new Set(canvas.getActiveObjects())
  selected.add(moving)

  const others = canvas.getObjects()
    .filter((object) => object.visible && !selected.has(object))
    .map((object) => object.getBoundingRect())

  const x = closestMatch(
    axisBounds(bounds.left, bounds.width),
    canvas.getWidth(),
    others.map((object) => axisBounds(object.left, object.width)),
    sceneUnitsPerPixel(canvas, 'vertical'),
    previous.find((guide) => guide.orientation === 'vertical'),
  )
  const y = closestMatch(
    axisBounds(bounds.top, bounds.height),
    canvas.getHeight(),
    others.map((object) => axisBounds(object.top, object.height)),
    sceneUnitsPerPixel(canvas, 'horizontal'),
    previous.find((guide) => guide.orientation === 'horizontal'),
  )

  if (x || y) {
    moving.set({
      left: moving.left + (x?.delta ?? 0),
      top: moving.top + (y?.delta ?? 0),
    })
    moving.setCoords()
  }

  return [
    ...(x ? [{ orientation: 'vertical' as const, position: x.position, source: x.source }] : []),
    ...(y ? [{ orientation: 'horizontal' as const, position: y.position, source: y.source }] : []),
  ]
}
