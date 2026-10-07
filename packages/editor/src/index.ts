export { snapStickerObject, type AlignmentGuide } from './alignmentGuides'
export { getStickerFontWeights, normalizeStickerFontWeight } from './fontWeights'
export {
  type StickerStrokeSettings,
  type StickerTextStyle,
  type EditorTool,
  type StickerCanvas,
  type StickerCanvasPreset,
  type StickerLayer,
} from './types'
export { getStickerStroke, updateStickerStroke } from './stroke/stroke'
export { snapStickerImageFrame } from './images/imageControls'
export { updateStickerImageOpacity, addStickerImage } from './images/imageOperations'
export { subscribeStickerCanvasBackground } from './canvas/backgroundEvents'
export { getStickerCanvasBackground, updateStickerCanvasBackground } from './canvas/background'
export { createStickerCanvas, setEditorTool } from './canvas/createCanvas'
export { initializeStickerCanvas } from './canvas/initializeCanvas'
export { undo, redo } from './history/history'
export { getStickerTextAutoSize } from './text/textSettings'
export { snapStickerTextFrame } from './text/textControls'
export { setStickerTextColor, updateStickerTextContent, updateStickerTextStyle, addStickerText } from './text/textOperations'
export {
  deleteSelectedObjects,
  reorderStickerLayers,
  commitStickerLayerOrder,
  getStickerLayers,
  selectStickerLayer,
  selectStickerCanvas,
  scaleSelectedStickerLayers,
  commitStickerLayerScale,
  setStickerLayerVisibility,
} from './layers/layers'
export { exportStickerBlob } from './export/exportSticker'

export { createStickerImageReveal, type StickerImageReveal } from './images/imageReveal'

export { createDefaultStickerTextLayers } from './text/defaultTextLayers'

export { eraseStickerImagePath, setEraserSize } from './images/imageEraser'

export { getStickerImageSmoothing, updateStickerImageSmoothing, commitStickerImageSmoothing } from './images/imageSmoothing'

export { setQuickSelectionAutoErase, setQuickSelectionOptions, subscribeQuickSelection, hasQuickSelection, invertQuickSelection, clearQuickSelection, paintQuickSelection, previewQuickSelection, deleteQuickSelection, type QuickSelectionMode } from './images/quickSelection'

export { createStickerTextReveal } from './text/textReveal'

export { preloadStickerImageOutline } from './images/imageOutline'

export { captureStickerDesign, restoreStickerDesign } from './canvas/stickerDesign'
export { captureStickerImagePreview } from './images/stickerImagePreview'
