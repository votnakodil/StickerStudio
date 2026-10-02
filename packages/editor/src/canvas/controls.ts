import { Textbox, Control, Point, controlsUtils } from 'fabric'
import type { FabricImage } from 'fabric'
import type { StickerTextbox } from '../types'

export const RESIZE_SNAP_DISTANCE = 24

export function keepControlsInsideCanvas(object: FabricImage | StickerTextbox) {
  // Text controls define its selection border. Clamping individual corners
  // distorts the frame when the text moves near or beyond the canvas edge.
  if (object instanceof Textbox) return
  object.controls = Object.fromEntries(
    Object.entries(object.controls).map(([name, control]) => {
      if (name === 'overflow') return [name, control]
      const clamped = Object.assign(new Control(), control)
      const positionHandler = clamped.positionHandler
      clamped.positionHandler = (dimensions, matrix, target, currentControl) => {
        const position = positionHandler.call(clamped, dimensions, matrix, target, currentControl)
        const canvas = target.canvas
        if (!canvas) return position
        const inset = Math.max(12, target.cornerSize / 2 + 4)
        return new Point(
          Math.min(canvas.getWidth() - inset, Math.max(inset, position.x)),
          Math.min(canvas.getHeight() - inset, Math.max(inset, position.y)),
        )
      }
      return [name, clamped]
    }),
  )
}

export function createResizeControl(
  x: number,
  y: number,
  cursorStyle: string,
  actionHandler:
    typeof controlsUtils.changeObjectWidth,
) {
  return new Control({
    x,
    y,
    cursorStyle,
    actionName: 'resizing',
    actionHandler: controlsUtils.wrapWithFireEvent('resizing', actionHandler),
  })
}
