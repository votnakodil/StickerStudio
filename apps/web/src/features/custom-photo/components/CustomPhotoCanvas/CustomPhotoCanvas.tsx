import { useCallback } from 'react'
import type { FabricImage } from 'fabric'
import type { StickerCanvas } from '@sticker-studio/editor'
import { EditorCanvas } from '@/features/editor'
import { ImageGeneration } from '@/shared/ui/ImageGeneration/ImageGeneration'
import { ShineSweep } from '@/shared/ui/ShineSweep/ShineSweep'
import { StickerCurlReveal } from '@/shared/ui/StickerCurlReveal/StickerCurlReveal'
import { useStickerReveal } from '../../model/useStickerReveal'
import type { CutoutPhotoState } from '../../model/types'
import styles from './CustomPhotoCanvas.module.css'

const imageFit = { width: 900, height: 900 }
interface Props {
  savedTemplateId?: string
  state: CutoutPhotoState
  source?: string
  arriving?: boolean
  inTransit?: boolean
  onCanvasAvailable: (canvas: StickerCanvas) => void
  onReady: (canvas: StickerCanvas, image: FabricImage) => void
  onError: () => void
}
export function CustomPhotoCanvas({ savedTemplateId, state, source, arriving = false, inTransit = false, onCanvasAvailable, onReady, onError }: Props) {
  const { prepared, phase, reveal, shine, prepare, start, complete, finishShine, fail } = useStickerReveal(state.resultSource === 'download', onReady)
  const prepareCanvas = useCallback((canvas: StickerCanvas, image: FabricImage) => {
    onCanvasAvailable(canvas)
    prepare(canvas, image)
  }, [onCanvasAvailable, prepare])
  const handleError = useCallback(() => { fail(); onError() }, [fail, onError])
  const restoring = state.stage === 'loading' && !arriving || state.stage === 'ready' && state.resultSource === 'storage'
  const status = inTransit ? 'queued' : restoring ? 'complete' : state.stage === 'error' || state.stage === 'cancelled' ? 'error'
    : prepared ? 'complete' : state.stage === 'ready' ? 'refining'
    : ['loading', 'uploading', 'queued'].includes(state.stage) ? 'queued' : 'generating'
  // The flight owns the visible loading surface. Mounting a second hidden
  // field here would draw another full canvas throughout the same transition.
  if (inTransit) return null
  return <>
  <ImageGeneration status={status} label="Preparing your custom sticker" onOverlayExit={start} appear={!arriving}>
    <div className={styles.editor} style={{ opacity: phase === 'complete' ? 1 : 0 }} inert={phase !== 'complete'}>
      {source && <EditorCanvas savedTemplateId={savedTemplateId} source={source} topText="TOP TEXT" bottomText="BOTTOM TEXT" imageFit={imageFit} imageRoundness={25} onReady={prepareCanvas} onError={handleError} />}
    </div>
  </ImageGeneration>
    {phase === 'revealing' && reveal && <div className={styles.reveal}>
      <StickerCurlReveal source={reveal.source} artworkSource={reveal.artworkSource} placement={reveal} onComplete={complete} />
    </div>}
    {shine && <div className={styles.shine} style={{
      left: `${shine.image.left / 1024 * 100}%`, top: `${shine.image.top / 1024 * 100}%`,
      width: `${shine.image.width / 1024 * 100}%`, height: `${shine.image.height / 1024 * 100}%`,
    }}><ShineSweep mask={shine.mask} onComplete={finishShine} /></div>}
  </>
}
