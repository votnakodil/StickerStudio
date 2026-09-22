import { Canvas, IText, Point, Rect } from 'fabric'

type HistoryEntry = string

export type EditorTool = 'move' | 'hand'

export interface StickerCanvas extends Canvas {
  history: HistoryEntry[]
  historyIndex: number
  isRestoringHistory: boolean
  editorTool: EditorTool
}

function saveHistory(canvas: StickerCanvas) {
  if (canvas.isRestoringHistory) {
    return
  }

  const serialized = JSON.stringify(canvas.toJSON())
  const current = canvas.history[canvas.historyIndex]

  if (serialized === current) {
    return
  }

  canvas.history = canvas.history.slice(0, canvas.historyIndex + 1)
  canvas.history.push(serialized)
  canvas.historyIndex = canvas.history.length - 1
}

export function createStickerCanvas(element: HTMLCanvasElement) {
  const canvas = new Canvas(element, {
    width: 1024,
    height: 1024,
    backgroundColor: 'transparent',
    preserveObjectStacking: true,
    selection: true,
  }) as StickerCanvas

  canvas.history = []
  canvas.historyIndex = -1
  canvas.isRestoringHistory = false
  canvas.editorTool = 'move'

  const testObject = new Rect({
    left: 312,
    top: 312,
    width: 400,
    height: 400,
    rx: 80,
    ry: 80,
    fill: '#0a84ff',
  })

  const testText = new IText('STICKER STUDIO', {
    left: 512,
    top: 180,
    originX: 'center',
    originY: 'center',
    fontSize: 72,
    fontWeight: 700,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 6,
    paintFirst: 'stroke',
  })

  canvas.add(testObject, testText)
  canvas.setActiveObject(testText)

  canvas.history = [
    JSON.stringify(canvas.toJSON()),
  ]

  canvas.historyIndex = 0

  canvas.on('object:added', () => {
    saveHistory(canvas)
  })

  canvas.on('object:modified', () => {
    saveHistory(canvas)
  })

  canvas.on('object:removed', () => {
    saveHistory(canvas)
  })

  canvas.on('mouse:wheel', (event) => {
    const wheelEvent = event.e as WheelEvent

    let zoom = canvas.getZoom()

    zoom *= 0.999 ** wheelEvent.deltaY
    zoom = Math.min(3, Math.max(0.4, zoom))

    canvas.zoomToPoint(
      new Point(
        wheelEvent.offsetX,
        wheelEvent.offsetY,
      ),
      zoom,
    )

    wheelEvent.preventDefault()
    wheelEvent.stopPropagation()
  })

  let isPanning = false
  let lastPointerX = 0
  let lastPointerY = 0

  canvas.on('mouse:down', (event) => {
    const pointerEvent = event.e as MouseEvent

    const shouldPan =
      canvas.editorTool === 'hand' ||
      pointerEvent.altKey

    if (!shouldPan) {
      return
    }

    isPanning = true
    lastPointerX = pointerEvent.clientX
    lastPointerY = pointerEvent.clientY

    canvas.selection = false
    canvas.defaultCursor = 'grabbing'
    canvas.setCursor('grabbing')

    pointerEvent.preventDefault()
  })

  canvas.on('mouse:move', (event) => {
    if (!isPanning) {
      return
    }

    const pointerEvent = event.e as MouseEvent

    const deltaX =
      pointerEvent.clientX - lastPointerX

    const deltaY =
      pointerEvent.clientY - lastPointerY

    canvas.relativePan(
      new Point(deltaX, deltaY),
    )

    lastPointerX = pointerEvent.clientX
    lastPointerY = pointerEvent.clientY

    pointerEvent.preventDefault()
  })

  canvas.on('mouse:up', () => {
    if (!isPanning) {
      return
    }

    isPanning = false

    if (canvas.editorTool === 'hand') {
      canvas.defaultCursor = 'grab'
      canvas.setCursor('grab')
    } else {
      canvas.selection = true
      canvas.defaultCursor = 'default'
      canvas.setCursor('default')
    }
  })

  return canvas
}

export function setEditorTool(
  canvas: StickerCanvas,
  tool: EditorTool,
) {
  canvas.editorTool = tool

  if (tool === 'hand') {
    canvas.discardActiveObject()
    canvas.selection = false
    canvas.skipTargetFind = true
    canvas.defaultCursor = 'grab'
    canvas.hoverCursor = 'grab'
    canvas.setCursor('grab')
  } else {
    canvas.selection = true
    canvas.skipTargetFind = false
    canvas.defaultCursor = 'default'
    canvas.hoverCursor = 'move'
    canvas.setCursor('default')
  }

  canvas.requestRenderAll()
}

export function addStickerText(
  canvas: StickerCanvas,
  text = 'NEW TEXT',
) {
  const textCount = canvas
    .getObjects()
    .filter((object) => object instanceof IText)
    .length

  const offset = textCount * 28

  const textObject = new IText(text, {
    left: 512 + offset,
    top: 512 + offset,
    originX: 'center',
    originY: 'center',
    fontSize: 72,
    fontWeight: 700,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 6,
    paintFirst: 'stroke',
  })

  canvas.add(textObject)
  canvas.setActiveObject(textObject)
  canvas.requestRenderAll()

  return textObject
}

export function deleteSelectedObjects(
  canvas: StickerCanvas,
) {
  const selectedObjects =
    canvas.getActiveObjects()

  if (selectedObjects.length === 0) {
    return
  }

  canvas.discardActiveObject()

  selectedObjects.forEach((object) => {
    canvas.remove(object)
  })

  canvas.requestRenderAll()
}

export async function undo(
  canvas: StickerCanvas,
) {
  if (canvas.historyIndex <= 0) {
    return
  }

  canvas.historyIndex -= 1
  canvas.isRestoringHistory = true

  await canvas.loadFromJSON(
    JSON.parse(
      canvas.history[canvas.historyIndex],
    ),
  )

  canvas.isRestoringHistory = false
  canvas.requestRenderAll()
}

export async function redo(
  canvas: StickerCanvas,
) {
  if (
    canvas.historyIndex >=
    canvas.history.length - 1
  ) {
    return
  }

  canvas.historyIndex += 1
  canvas.isRestoringHistory = true

  await canvas.loadFromJSON(
    JSON.parse(
      canvas.history[canvas.historyIndex],
    ),
  )

  canvas.isRestoringHistory = false
  canvas.requestRenderAll()
}