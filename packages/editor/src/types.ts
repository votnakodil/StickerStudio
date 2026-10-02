import type { Textbox, FabricImage, Canvas } from 'fabric'

export type HistoryEntry = string

export type StickerTextbox = Textbox & {
  stickerAutoSize?: boolean
  stickerMaxFontSize?: number
  stickerStrokeFontSize?: number
  stickerFrameWidth?: number
  stickerFrameHeight?: number
  stickerCustomFill?: boolean
  stickerVerticalAlign?: 'top' | 'middle' | 'bottom'
  stickerTopOffsetInstalled?: boolean
  stickerEditingLayoutInstalled?: boolean
  stickerDistributedAlignmentInstalled?: boolean
  stickerStroke?: StickerStrokeSettings
}

export type StickerImage = FabricImage & {
  stickerStroke?: StickerStrokeSettings
  stickerStrokeRendererInstalled?: boolean
}

export type StickerStrokeSettings = {
  enabled: boolean
  width: number
  color: string
  opacity: number
}

export type StickerTextStyle = {
  fontFamily: string
  fontSize: number
  fontWeight: number | string
  fontStyle: string
  underline: boolean
  linethrough: boolean
  fill: string
  textAlign: string
  stickerAutoSize: boolean
  stickerVerticalAlign: 'top' | 'middle' | 'bottom'
}

export type EditorTool = 'move' | 'hand'

export interface StickerCanvas extends Canvas {
  history: HistoryEntry[]
  historyIndex: number
  isRestoringHistory: boolean
  editorTool: EditorTool
  stickerTextColor: string
}

export interface StickerCanvasPreset {
  image: { left: number; top: number; width: number; height: number; opacity?: number }
  texts: {
    text: string
    left: number
    top: number
    width: number
    frameHeight: number
    autoSize?: boolean
    fontFamily: string
    fontSize: number
    fontWeight: number
    fill: string
    textAlign: 'left' | 'center' | 'right'
    verticalAlign: 'top' | 'middle' | 'bottom'
    stroke?: StickerStrokeSettings
  }[]
}

export interface StickerTemplateText {
  topText: string
  bottomText: string
  preset?: StickerCanvasPreset
}

export interface StickerLayer {
  id: string
  index: number
  kind: 'text' | 'image' | 'other'
  title: string
  detail: string
  thumbnail?: string
  visible: boolean
  selected: boolean
}
