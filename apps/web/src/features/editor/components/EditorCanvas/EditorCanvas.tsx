import { palette } from '@sticker-studio/theme'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  createStickerCanvas,
  restoreStickerDesign,
  initializeStickerCanvas,
  setStickerTextColor,
  snapStickerImageFrame,
  snapStickerObject,
  snapStickerTextFrame,
  type AlignmentGuide,
  type StickerCanvasPreset,
  type StickerStrokeSettings,
} from '@sticker-studio/editor'
import { FabricImage, Textbox, type FabricObject } from 'fabric'
import { useEditorStore } from '@/features/editor/model/editorStore'
import { getSavedStickerDesign, takePreparedStickerCanvas } from '@/features/library'
import { startSavedStickerAutosave } from '@/features/editor/model/savedStickerAutosave'
import { loadEditorFonts } from '@/features/editor/lib/editorFonts'

interface EditorCanvasProps {
  savedTemplateId?: string
  source: string
  topText: string
  bottomText?: string
  preset?: StickerCanvasPreset
  imageStroke?: StickerStrokeSettings
  imageFit?: { width: number; height: number }
  imageRoundness?: number
  onLayoutReady?: (canvas: ReturnType<typeof createStickerCanvas>, image: FabricImage) => void
  onReady?: (canvas: ReturnType<typeof createStickerCanvas>, image: FabricImage) => void
  onError?: () => void
}

export function EditorCanvas({ savedTemplateId, source, topText, bottomText = 'TEXT', preset, imageStroke, imageFit, imageRoundness, onLayoutReady, onReady, onError }: EditorCanvasProps) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null)
  const pendingPreparedDisposal = useRef<{ canvas: ReturnType<typeof createStickerCanvas>; id: string; frame: number } | null>(null)
  const [saveError, setSaveError] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [guides, setGuides] = useState<AlignmentGuide[]>([])
  const [viewport, setViewport] = useState([1, 0, 0, 1, 0, 0])

  const setCanvas = useEditorStore((state) => state.setCanvas)

  useEffect(() => {
    const host = canvasHostRef.current
    if (!host) return

    // Fabric owns this element for exactly one effect lifetime. StrictMode may
    // restart the effect before an old instance has finished disposing.
    const pending = pendingPreparedDisposal.current
    if (pending) { cancelAnimationFrame(pending.frame); pendingPreparedDisposal.current = null }
    const prepared = pending && pending.id === savedTemplateId ? pending.canvas
      : savedTemplateId ? takePreparedStickerCanvas(savedTemplateId) : undefined
    if (pending && pending.canvas !== prepared) void pending.canvas.dispose()
    const element = prepared?.lowerCanvasEl ?? document.createElement('canvas')
    if (!prepared) host.appendChild(element)
    const canvas = prepared ?? createStickerCanvas(element)
    if (prepared) { host.appendChild(canvas.wrapperEl); canvas.calcOffset() }
    const controller = new AbortController()
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)')
    const syncTextColor = () => setStickerTextColor(canvas, darkMode.matches ? palette.white : palette.ink)
    syncTextColor()
    darkMode.addEventListener('change', syncTextColor)

    let activeGuides: AlignmentGuide[] = []
    let drawnViewport = [...canvas.viewportTransform]
    const syncGuideViewport = () => {
      if (canvas.viewportTransform.some((value, index) => value !== drawnViewport[index])) {
        drawnViewport = [...canvas.viewportTransform]
        setViewport(drawnViewport)
      }
    }
    const showAlignmentGuides = (event: { target: Parameters<typeof snapStickerObject>[1] }) => {
      const nextGuides = snapStickerObject(canvas, event.target, activeGuides)
      const changed = nextGuides.length !== activeGuides.length || nextGuides.some((guide, index) =>
        guide.orientation !== activeGuides[index]?.orientation ||
        guide.position !== activeGuides[index]?.position ||
        guide.source !== activeGuides[index]?.source,
      )
      activeGuides = nextGuides
      if (changed) setGuides(nextGuides)

      syncGuideViewport()
    }
    const clearAlignmentGuides = () => {
      activeGuides = []
      setGuides([])
    }
    canvas.on('object:moving', showAlignmentGuides)
    const showResizeGuides = (event: { target: FabricObject; transform: { corner: string } }) => {
      if (!(event.target instanceof Textbox)) return
      setGuides(snapStickerTextFrame(canvas, event.target, event.transform.corner))
      syncGuideViewport()
    }
    canvas.on('object:resizing', showResizeGuides)
    const showImageScaleGuides = (event: { target: FabricObject; transform: { corner: string } }) => {
      if (!(event.target instanceof FabricImage)) return
      setGuides(snapStickerImageFrame(canvas, event.target, event.transform.corner))
      syncGuideViewport()
    }
    canvas.on('object:scaling', showImageScaleGuides)
    canvas.on('mouse:up', clearAlignmentGuides)
    canvas.on('selection:cleared', clearAlignmentGuides)

    let stopSaving: (() => void) | undefined
    void loadEditorFonts()
      .then(async () => {
        const savedDesign = savedTemplateId && !prepared ? await getSavedStickerDesign(savedTemplateId) : undefined
        controller.signal.throwIfAborted()
        const reportLayout = (image: FabricImage) => {
          if (!controller.signal.aborted && onLayoutReady) {
            flushSync(() => { setCanvas(canvas); onLayoutReady(canvas, image) })
          }
        }
        let restoredImage: FabricImage
        if (prepared) {
          const image = canvas.getObjects().find(object => object instanceof FabricImage)
          if (!image) throw new Error('This saved sticker has no image layer.')
          reportLayout(image)
          restoredImage = image
        } else if (savedDesign) {
          await restoreStickerDesign(canvas, savedDesign, { signal: controller.signal, onLayoutReady: reportLayout })
          controller.signal.throwIfAborted()
          const image = canvas.getObjects().find(object => object instanceof FabricImage)
          if (!image) throw new Error('This saved sticker has no image layer.')
          restoredImage = image
        } else {
          restoredImage = await initializeStickerCanvas(canvas, source, { topText, bottomText, preset, imageStroke, imageFit, imageRoundness }, controller.signal, reportLayout)
          controller.signal.throwIfAborted()
        }
        if (savedTemplateId) {
          stopSaving = startSavedStickerAutosave(canvas, savedTemplateId,
            () => { if (!controller.signal.aborted) setSaveError(true) },
            () => { if (!controller.signal.aborted) setSaveError(false) })
        }
        return restoredImage
      })
      .then((image) => {
        if (!controller.signal.aborted) {
          if (useEditorStore.getState().canvas !== canvas) setCanvas(canvas)
          onReady?.(canvas, image)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadError(true)
          onError?.()
        }
      })

    return () => {
      stopSaving?.()
      controller.abort()
      darkMode.removeEventListener('change', syncTextColor)
      canvas.off('object:moving', showAlignmentGuides)
      canvas.off('object:resizing', showResizeGuides)
      canvas.off('object:scaling', showImageScaleGuides)
      canvas.off('mouse:up', clearAlignmentGuides)
      canvas.off('selection:cleared', clearAlignmentGuides)
      if (useEditorStore.getState().canvas === canvas) setCanvas(null)
      canvas.cancelRequestedRender()
      if (prepared && savedTemplateId) {
        // StrictMode immediately replays setup. Keep the prepared instance for
        // that replay; an actual unmount disposes it on the next frame.
        canvas.wrapperEl.remove()
        const frame = requestAnimationFrame(() => {
          if (pendingPreparedDisposal.current?.canvas === canvas) pendingPreparedDisposal.current = null
          void canvas.dispose()
        })
        pendingPreparedDisposal.current = { canvas, id: savedTemplateId, frame }
      } else {
        void canvas.dispose()
        element.remove()
      }
    }
  }, [setCanvas, savedTemplateId, source, topText, bottomText, preset, imageStroke, imageFit, imageRoundness, onLayoutReady, onReady, onError])

  return (
    <div className="relative w-full h-full [&_.canvas-container]:!w-full [&_.canvas-container]:!h-full [&_canvas]:!w-full [&_canvas]:!h-full">
      <div ref={canvasHostRef} className="h-full w-full" />
      {guides.length > 0 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1024 1024" aria-hidden="true">
          <g transform={`matrix(${viewport.join(' ')})`}>
            {guides.map((guide) => {
              const position = Math.min(1022, Math.max(2, guide.position))
              return guide.orientation === 'vertical' ? (
                <line key="vertical" x1={position} y1="0" x2={position} y2="1024" stroke={palette.focusBlue} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              ) : (
                <line key="horizontal" x1="0" y1={position} x2="1024" y2={position} stroke={palette.focusBlue} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              )
            })}
          </g>
        </svg>
      )}
      {saveError && <p role="status" className="absolute bottom-2 left-2 right-2 rounded-lg bg-card p-2 text-sm text-foreground">Changes could not be saved. Retrying…</p>}
      {loadError && <p role="alert" className="absolute inset-0 flex items-center justify-center bg-neutral-900 text-white">Could not load this sticker.</p>}
    </div>
  )
}
