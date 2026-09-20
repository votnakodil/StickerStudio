import { Canvas, IText, Rect } from 'fabric'

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

  return canvas
}