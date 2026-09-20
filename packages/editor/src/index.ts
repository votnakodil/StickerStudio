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

  return canvas
}