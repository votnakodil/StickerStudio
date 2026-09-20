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

  return <canvas ref={canvasRef} />
}