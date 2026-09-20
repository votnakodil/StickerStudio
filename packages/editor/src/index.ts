import { Canvas, IText, Point, Rect } from 'fabric'

export function createStickerCanvas(element: HTMLCanvasElement) {
  const canvas = new Canvas(element, {
    width: 1024,
    height: 1024,
    backgroundColor: 'transparent',
    preserveObjectStacking: true,
    selection: true,
  })

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

    if (!pointerEvent.altKey) {
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

    const deltaX = pointerEvent.clientX - lastPointerX
    const deltaY = pointerEvent.clientY - lastPointerY

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

    canvas.selection = true
    canvas.defaultCursor = 'default'
    canvas.setCursor('default')
  })

  return canvas
}

export function addStickerText(
  canvas: Canvas,
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