import {
  Canvas,
  Control,
  FabricImage,
  Point,
  Rect,
  Textbox,
  controlsUtils,
} from 'fabric'

type HistoryEntry = string

type StickerTextbox = Textbox & {
  stickerFrameHeight?: number
}

export type EditorTool = 'move' | 'hand'

export interface StickerCanvas extends Canvas {
  history: HistoryEntry[]
  historyIndex: number
  isRestoringHistory: boolean
  editorTool: EditorTool
}

const MIN_TEXT_FRAME_HEIGHT = 24

function serializeCanvas(canvas: StickerCanvas) {
  return JSON.stringify(
    canvas.toObject([
      'stickerFrameHeight',
    ]),
  )
}

function getTextFrameHeight(
  text: StickerTextbox,
) {
  return Math.max(
    MIN_TEXT_FRAME_HEIGHT,
    text.stickerFrameHeight ??
      text.height,
  )
}

function getTextContentHeight(
  text: StickerTextbox,
) {
  return Math.max(
    MIN_TEXT_FRAME_HEIGHT,
    text.calcTextHeight(),
  )
}

function isTextOverflowing(
  text: StickerTextbox,
) {
  return (
    getTextContentHeight(text) >
    getTextFrameHeight(text) + 0.5
  )
}

function renderOverflowIndicator(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
) {
  const size = 9

  ctx.save()
  ctx.translate(left, top)

  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 1

  ctx.fillRect(
    -size / 2,
    -size / 2,
    size,
    size,
  )

  ctx.strokeRect(
    -size / 2,
    -size / 2,
    size,
    size,
  )

  ctx.restore()
}

function updateOverflowIndicator(
  text: StickerTextbox,
) {
  const overflowing =
    isTextOverflowing(text)

  if (text.controls.mb) {
    text.controls.mb.visible =
      !overflowing
  }

  if (text.controls.overflow) {
    text.controls.overflow.visible =
      overflowing
  }
}

function updateTextClip(
  text: StickerTextbox,
) {
  const frameHeight =
    getTextFrameHeight(text)

  let clip = text.clipPath

  if (!(clip instanceof Rect)) {
    clip = new Rect({
      left: 0,
      top: 0,
      originX: 'center',
      originY: 'center',
      width: text.width,
      height: frameHeight,
    })

    text.clipPath = clip
  } else {
    clip.set({
      left: 0,
      top: 0,
      originX: 'center',
      originY: 'center',
      width: text.width,
      height: frameHeight,
    })
  }

  text.set(
    'height',
    frameHeight,
  )

  text.dirty = true
  text.setCoords()

  updateOverflowIndicator(text)
}

function relayoutStickerText(
  text: StickerTextbox,
) {
  const frameHeight =
    getTextFrameHeight(text)

  text.initDimensions()

  text.stickerFrameHeight =
    frameHeight

  text.set(
    'height',
    frameHeight,
  )

  updateTextClip(text)
}

function showAllText(
  text: StickerTextbox,
) {
  text.initDimensions()

  const fullHeight =
    getTextContentHeight(text)

  text.stickerFrameHeight =
    fullHeight

  text.set(
    'height',
    fullHeight,
  )

  updateTextClip(text)

  text.canvas?.requestRenderAll()
}

const resizeStickerTextWidth =
  controlsUtils.wrapWithFixedAnchor(
    (
      eventData,
      transform,
      x,
      y,
    ) => {
      const text =
        transform.target as StickerTextbox

      const frameHeight =
        getTextFrameHeight(text)

      const changed =
        controlsUtils.changeObjectWidth(
          eventData,
          transform,
          x,
          y,
        )

      text.initDimensions()

      text.stickerFrameHeight =
        frameHeight

      text.set(
        'height',
        frameHeight,
      )

      updateTextClip(text)

      return changed
    },
  )

const resizeStickerTextHeight =
  controlsUtils.wrapWithFixedAnchor(
    (
      eventData,
      transform,
      x,
      y,
    ) => {
      const text =
        transform.target as StickerTextbox

      const changed =
        controlsUtils.changeObjectHeight(
          eventData,
          transform,
          x,
          y,
        )

      text.stickerFrameHeight =
        Math.max(
          MIN_TEXT_FRAME_HEIGHT,
          text.height,
        )

      text.set(
        'height',
        text.stickerFrameHeight,
      )

      updateTextClip(text)

      return changed
    },
  )

const resizeStickerTextFrame =
  controlsUtils.wrapWithFixedAnchor(
    (
      eventData,
      transform,
      x,
      y,
    ) => {
      const text =
        transform.target as StickerTextbox

      const previousFrameHeight =
        getTextFrameHeight(text)

      const widthChanged =
        controlsUtils.changeObjectWidth(
          eventData,
          transform,
          x,
          y,
        )

      text.initDimensions()

      text.set(
        'height',
        previousFrameHeight,
      )

      const heightChanged =
        controlsUtils.changeObjectHeight(
          eventData,
          transform,
          x,
          y,
        )

      text.stickerFrameHeight =
        Math.max(
          MIN_TEXT_FRAME_HEIGHT,
          text.height,
        )

      text.set(
        'height',
        text.stickerFrameHeight,
      )

      updateTextClip(text)

      return (
        widthChanged ||
        heightChanged
      )
    },
  )

function createResizeControl(
  x: number,
  y: number,
  cursorStyle: string,
  actionHandler:
    typeof resizeStickerTextFrame,
) {
  return new Control({
    x,
    y,
    cursorStyle,
    actionName: 'resizing',
    actionHandler,
  })
}

function configureStickerText(
  text: StickerTextbox,
) {
  text.stickerFrameHeight =
    getTextFrameHeight(text)

  text.controls = {
    ...text.controls,

    tl: createResizeControl(
      -0.5,
      -0.5,
      'nwse-resize',
      resizeStickerTextFrame,
    ),

    tr: createResizeControl(
      0.5,
      -0.5,
      'nesw-resize',
      resizeStickerTextFrame,
    ),

    bl: createResizeControl(
      -0.5,
      0.5,
      'nesw-resize',
      resizeStickerTextFrame,
    ),

    br: createResizeControl(
      0.5,
      0.5,
      'nwse-resize',
      resizeStickerTextFrame,
    ),

    ml: createResizeControl(
      -0.5,
      0,
      'ew-resize',
      resizeStickerTextWidth,
    ),

    mr: createResizeControl(
      0.5,
      0,
      'ew-resize',
      resizeStickerTextWidth,
    ),

    mt: createResizeControl(
      0,
      -0.5,
      'ns-resize',
      resizeStickerTextHeight,
    ),

    mb: createResizeControl(
      0,
      0.5,
      'ns-resize',
      resizeStickerTextHeight,
    ),

    overflow: new Control({
      x: 0,
      y: 0.5,

      cursorStyle: 'pointer',

      visible: false,

      render:
        renderOverflowIndicator,

      mouseUpHandler: (
        _eventData,
        transform,
      ) => {
        const target =
          transform.target as StickerTextbox

        if (
          !isTextOverflowing(
            target,
          )
        ) {
          return false
        }

        showAllText(target)

        target.canvas?.fire(
          'object:modified',
          {
            target,
          },
        )

        return true
      },
    }),
  }

  relayoutStickerText(text)

  return text
}

function configureStickerTexts(
  canvas: StickerCanvas,
) {
  canvas
    .getObjects()
    .filter(
      (object) =>
        object instanceof Textbox,
    )
    .forEach((object) => {
      configureStickerText(
        object as StickerTextbox,
      )
    })
}

function saveHistory(
  canvas: StickerCanvas,
) {
  if (
    canvas.isRestoringHistory
  ) {
    return
  }

  const serialized =
    serializeCanvas(canvas)

  const current =
    canvas.history[
      canvas.historyIndex
    ]

  if (
    serialized === current
  ) {
    return
  }

  canvas.history =
    canvas.history.slice(
      0,
      canvas.historyIndex + 1,
    )

  canvas.history.push(
    serialized,
  )

  canvas.historyIndex =
    canvas.history.length - 1
}

async function restoreHistory(
  canvas: StickerCanvas,
  serialized: string,
) {
  canvas.isRestoringHistory = true

  try {
    await canvas.loadFromJSON(
      JSON.parse(serialized),
      (
        serializedObject,
        instance,
      ) => {
        if (
          instance instanceof
          Textbox
        ) {
          const frameHeight =
            (
              serializedObject as {
                stickerFrameHeight?:
                  unknown
              }
            )
              .stickerFrameHeight

          if (
            typeof frameHeight ===
            'number'
          ) {
            ;(
              instance as
                StickerTextbox
            ).stickerFrameHeight =
              frameHeight
          }
        }
      },
    )

    configureStickerTexts(
      canvas,
    )
  } finally {
    canvas.isRestoringHistory =
      false
  }

  canvas.requestRenderAll()
}

export function createStickerCanvas(
  element: HTMLCanvasElement,
) {
  const canvas = new Canvas(
    element,
    {
      width: 1024,
      height: 1024,
      backgroundColor:
        'transparent',
      preserveObjectStacking:
        true,
      selection: true,
    },
  ) as StickerCanvas

  canvas.history = []
  canvas.historyIndex = -1

  canvas.isRestoringHistory =
    false

  canvas.editorTool =
    'move'

  const testObject =
    new Rect({
      left: 312,
      top: 312,
      width: 400,
      height: 400,
      rx: 80,
      ry: 80,
      fill: '#0a84ff',
    })

  const testText =
    configureStickerText(
      new Textbox(
        'STICKER STUDIO',
        {
          left: 512,
          top: 180,

          originX:
            'center',

          originY:
            'center',

          width: 700,

          fontSize: 72,
          fontWeight: 700,

          fill:
            '#ffffff',

          stroke:
            '#000000',

          strokeWidth: 6,

          paintFirst:
            'stroke',

          textAlign:
            'center',
        },
      ),
    )

  canvas.add(
    testObject,
    testText,
  )

  canvas.setActiveObject(
    testText,
  )

  canvas.history = [
    serializeCanvas(
      canvas,
    ),
  ]

  canvas.historyIndex = 0

  canvas.on(
    'object:added',
    () => {
      saveHistory(canvas)
    },
  )

  canvas.on(
    'object:modified',
    () => {
      saveHistory(canvas)
    },
  )

  canvas.on(
    'object:removed',
    () => {
      saveHistory(canvas)
    },
  )

  canvas.on(
    'text:changed',
    (event) => {
      const target =
        event.target

      if (
        target instanceof
        Textbox
      ) {
        relayoutStickerText(
          target as
            StickerTextbox,
        )

        canvas.requestRenderAll()
      }
    },
  )

  canvas.on(
    'mouse:wheel',
    (event) => {
      const wheelEvent =
        event.e as WheelEvent

      let zoom =
        canvas.getZoom()

      zoom *=
        0.999 **
        wheelEvent.deltaY

      zoom = Math.min(
        3,
        Math.max(
          0.4,
          zoom,
        ),
      )

      canvas.zoomToPoint(
        new Point(
          wheelEvent.offsetX,
          wheelEvent.offsetY,
        ),
        zoom,
      )

      wheelEvent.preventDefault()
      wheelEvent.stopPropagation()
    },
  )

  let isPanning = false
  let lastPointerX = 0
  let lastPointerY = 0

  canvas.on(
    'mouse:down',
    (event) => {
      const pointerEvent =
        event.e as MouseEvent

      const shouldPan =
        canvas.editorTool ===
          'hand' ||
        pointerEvent.altKey

      if (!shouldPan) {
        return
      }

      isPanning = true

      lastPointerX =
        pointerEvent.clientX

      lastPointerY =
        pointerEvent.clientY

      canvas.selection =
        false

      canvas.defaultCursor =
        'grabbing'

      canvas.setCursor(
        'grabbing',
      )

      pointerEvent.preventDefault()
    },
  )

  canvas.on(
    'mouse:move',
    (event) => {
      if (!isPanning) {
        return
      }

      const pointerEvent =
        event.e as MouseEvent

      const deltaX =
        pointerEvent.clientX -
        lastPointerX

      const deltaY =
        pointerEvent.clientY -
        lastPointerY

      canvas.relativePan(
        new Point(
          deltaX,
          deltaY,
        ),
      )

      lastPointerX =
        pointerEvent.clientX

      lastPointerY =
        pointerEvent.clientY

      pointerEvent.preventDefault()
    },
  )

  canvas.on(
    'mouse:up',
    () => {
      if (!isPanning) {
        return
      }

      isPanning = false

      if (
        canvas.editorTool ===
        'hand'
      ) {
        canvas.defaultCursor =
          'grab'

        canvas.setCursor(
          'grab',
        )
      } else {
        canvas.selection =
          true

        canvas.defaultCursor =
          'default'

        canvas.setCursor(
          'default',
        )
      }
    },
  )

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

    canvas.defaultCursor =
      'grab'

    canvas.hoverCursor =
      'grab'

    canvas.setCursor(
      'grab',
    )
  } else {
    canvas.selection = true
    canvas.skipTargetFind = false

    canvas.defaultCursor =
      'default'

    canvas.hoverCursor =
      'move'

    canvas.setCursor(
      'default',
    )
  }

  canvas.requestRenderAll()
}

export function addStickerText(
  canvas: StickerCanvas,
  text = 'NEW TEXT',
) {
  const textCount =
    canvas
      .getObjects()
      .filter(
        (object) =>
          object instanceof
          Textbox,
      )
      .length

  const offset =
    textCount * 28

  const textObject =
    configureStickerText(
      new Textbox(
        text,
        {
          left:
            512 +
            offset,

          top:
            512 +
            offset,

          originX:
            'center',

          originY:
            'center',

          width: 400,

          fontSize: 72,
          fontWeight: 700,

          fill:
            '#ffffff',

          stroke:
            '#000000',

          strokeWidth: 6,

          paintFirst:
            'stroke',

          textAlign:
            'center',
        },
      ),
    )

  canvas.add(
    textObject,
  )

  canvas.setActiveObject(
    textObject,
  )

  canvas.requestRenderAll()

  return textObject
}

export async function addStickerImage(
  canvas: StickerCanvas,
  url: string,
) {
  const image =
    await FabricImage.fromURL(
      url,
      {
        crossOrigin:
          'anonymous',
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

export async function undo(
  canvas: StickerCanvas,
) {
  if (
    canvas.historyIndex <= 0
  ) {
    return
  }

  canvas.historyIndex -= 1

  await restoreHistory(
    canvas,
    canvas.history[
      canvas.historyIndex
    ],
  )
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

  await restoreHistory(
    canvas,
    canvas.history[
      canvas.historyIndex
    ],
  )
}