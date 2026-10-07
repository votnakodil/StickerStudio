import { create } from 'zustand'
import { setEditorTool, setEraserSize, setQuickSelectionOptions, setQuickSelectionAutoErase, type QuickSelectionMode, getStickerLayers, selectStickerLayer, type EditorTool, type createStickerCanvas } from '@sticker-studio/editor'

type StickerCanvas = ReturnType<typeof createStickerCanvas>

interface EditorStore {
  quickSelectionAutoErase: boolean
  setQuickSelectionAutoErase: (enabled: boolean) => void
  quickSelectionMode: QuickSelectionMode
  quickSelectionSize: number
  setQuickSelectionMode: (mode: QuickSelectionMode) => void
  setQuickSelectionSize: (size: number) => void
  eraserReturnLayerIds: string[]
  activeTool: EditorTool | 'text'
  eraserSize: number
  selectTool: (tool: EditorTool | 'text') => void
  setEraserSize: (size: number) => void
  canvas: StickerCanvas | null
  setCanvas: (canvas: StickerCanvas | null) => void
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  quickSelectionAutoErase: false,
  setQuickSelectionAutoErase: (enabled) => {
    const state = get()
    if (state.canvas) setQuickSelectionAutoErase(state.canvas, enabled)
    set({ quickSelectionAutoErase: enabled, ...(enabled ? { quickSelectionMode: 'add' as const } : {}) })
  },
  quickSelectionMode: 'add',
  quickSelectionSize: 25,
  setQuickSelectionMode: (mode) => {
    const state = get()
    if (state.quickSelectionAutoErase && mode === 'subtract') return
    if (state.canvas) setQuickSelectionOptions(state.canvas, mode, state.quickSelectionSize)
    set({ quickSelectionMode: mode })
  },
  setQuickSelectionSize: (size) => {
    const state = get()
    if (state.canvas) setQuickSelectionOptions(state.canvas, state.quickSelectionMode, size)
    set({ quickSelectionSize: size })
  },
  eraserReturnLayerIds: [],
  activeTool: 'move',
  eraserSize: 25,
  selectTool: (tool) => {
    const state = get()
    const canvas = state.canvas
    const closingEraser = (tool === 'eraser' || tool === 'quick-selection') && state.activeTool === tool
    const nextTool = closingEraser ? 'move' : tool
    let returnIds = (tool === 'eraser' || tool === 'quick-selection') && !closingEraser && canvas
      ? getStickerLayers(canvas).filter(layer => layer.selected).map(layer => layer.id)
      : state.eraserReturnLayerIds
    if (canvas) {
      setEditorTool(canvas, nextTool === 'text' ? 'move' : nextTool)
      if ((nextTool === 'eraser' || nextTool === 'quick-selection') && !returnIds.length) {
        returnIds = getStickerLayers(canvas).filter(layer => layer.selected).map(layer => layer.id)
      }
      if (closingEraser && returnIds.length) {
        const layers = getStickerLayers(canvas)
        const restored = returnIds.flatMap(id => layers.filter(layer => layer.id === id && layer.visible))
        restored.forEach((layer, index) => selectStickerLayer(canvas, layer.index, index > 0))
      }
    }
    set({ activeTool: nextTool, eraserReturnLayerIds: nextTool === 'eraser' || nextTool === 'quick-selection' ? returnIds : [] })
  },
  setEraserSize: (size) => {
    const canvas = get().canvas
    if (canvas) setEraserSize(canvas, size)
    set({ eraserSize: size })
  },
  canvas: null,

  setCanvas: (canvas) => {
    if (canvas) { setEraserSize(canvas, get().eraserSize); setQuickSelectionAutoErase(canvas, get().quickSelectionAutoErase); setQuickSelectionOptions(canvas, get().quickSelectionMode, get().quickSelectionSize) }
    set({ canvas, activeTool: 'move', eraserReturnLayerIds: [] })
  },
}))
