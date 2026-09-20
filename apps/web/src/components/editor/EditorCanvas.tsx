import { useEffect, useRef } from 'react'
import { createStickerCanvas } from '@sticker-studio/editor'
import { useEditorStore } from '../../stores/editorStore'

export function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const setCanvas = useEditorStore((state) => state.setCanvas)

  useEffect(() => {
    if (!canvasRef.current) {
      return
    }

    const canvas = createStickerCanvas(canvasRef.current)

    setCanvas(canvas)

    return () => {
      setCanvas(null)
      canvas.dispose()
    }
  }, [setCanvas])

  return (
    <div className="w-full h-full [&_.canvas-container]:!w-full [&_.canvas-container]:!h-full [&_canvas]:!w-full [&_canvas]:!h-full">
      <canvas ref={canvasRef} />
    </div>
  )
}