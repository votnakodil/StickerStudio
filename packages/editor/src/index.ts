import { Canvas, Rect } from 'fabric'

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

  canvas.add(testObject)
  canvas.setActiveObject(testObject)

  return canvas
}