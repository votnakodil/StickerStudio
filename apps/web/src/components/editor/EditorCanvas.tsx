import { useEffect, useRef, useState } from 'react'
import {
  createStickerCanvas,
  initializeStickerCanvas,
  setStickerTextColor,
  snapStickerImageFrame,
  snapStickerObject,
  snapStickerTextFrame,
  type AlignmentGuide,
  type StickerCanvasPreset,
} from '@sticker-studio/editor'
import { FabricImage, Textbox, type FabricObject } from 'fabric'
import { useEditorStore } from '../../stores/editorStore'
import { loadEditorFonts } from '../../lib/editorFonts'

interface EditorCanvasProps {
  source: string
  topText: string
  preset?: StickerCanvasPreset
  onReady?: (canvas: ReturnType<typeof createStickerCanvas>, image: FabricImage) => void
  onError?: () => void
}

export function EditorCanvas({ source, topText, preset, onReady, onError }: EditorCanvasProps) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [guides, setGuides] = useState<AlignmentGuide[]>([])
  const [viewport, setViewport] = useState([1, 0, 0, 1, 0, 0])

  const setCanvas = useEditorStore((state) => state.setCanvas)

  useEffect(() => {
    const host = canvasHostRef.current
    if (!host) return

    // Fabric owns this element for exactly one effect lifetime. StrictMode may
    // restart the effect before an old instance has finished disposing.
    const element = document.createElement('canvas')
    host.appendChild(element)
    const canvas = createStickerCanvas(element)
    const controller = new AbortController()
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)')
    const syncTextColor = () => setStickerTextColor(canvas, darkMode.matches ? '#ffffff' : '#17191f')
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

    void loadEditorFonts()
      .then(() => initializeStickerCanvas(canvas, source, { topText, bottomText: 'TEXT', preset }, controller.signal))
      .then((image) => {
        if (!controller.signal.aborted) {
          setCanvas(canvas)
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
      controller.abort()
      darkMode.removeEventListener('change', syncTextColor)
      canvas.off('object:moving', showAlignmentGuides)
      canvas.off('object:resizing', showResizeGuides)
      canvas.off('object:scaling', showImageScaleGuides)
      canvas.off('mouse:up', clearAlignmentGuides)
      canvas.off('selection:cleared', clearAlignmentGuides)
      if (useEditorStore.getState().canvas === canvas) setCanvas(null)
      canvas.cancelRequestedRender()
      void canvas.dispose()
      element.remove()
    }
  }, [setCanvas, source, topText, preset, onReady, onError])

  return (
    <div className="relative w-full h-full [&_.canvas-container]:!w-full [&_.canvas-container]:!h-full [&_canvas]:!w-full [&_canvas]:!h-full">
      <div ref={canvasHostRef} className="h-full w-full" />
      {guides.length > 0 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1024 1024" aria-hidden="true">
          <g transform={`matrix(${viewport.join(' ')})`}>
            {guides.map((guide) => {
              const position = Math.min(1022, Math.max(2, guide.position))
              return guide.orientation === 'vertical' ? (
                <line key="vertical" x1={position} y1="0" x2={position} y2="1024" stroke="#0a84ff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              ) : (
                <line key="horizontal" x1="0" y1={position} x2="1024" y2={position} stroke="#0a84ff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              )
            })}
          </g>
        </svg>
      )}
      {loadError && <p role="alert" className="absolute inset-0 flex items-center justify-center bg-neutral-900 text-white">Could not load this sticker.</p>}
    </div>
  )
}
