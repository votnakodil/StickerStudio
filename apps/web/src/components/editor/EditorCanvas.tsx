import { useEffect, useRef } from 'react'
import { createStickerCanvas } from '@sticker-studio/editor'

export function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!canvasRef.current) {
      return
    }

    const canvas = createStickerCanvas(canvasRef.current)

    return () => {
      canvas.dispose()
    }
  }, [])

  return (
    <div className="w-full h-full [&_.canvas-container]:!w-full [&_.canvas-container]:!h-full [&_canvas]:!w-full [&_canvas]:!h-full">
      <canvas ref={canvasRef} />
    </div>
  )
}