import { useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { type ButtonState } from '@/shared/ui/StatefulButton/StatefulButton'

import { vkWorkspace, VkServiceError, type VkPack } from '@/features/vk-workspace/api/vkWorkspace'

import { isValidStickerReference } from './stickerReference'


export type VkWorkspaceUploadOptions = {
  pack: VkPack
  newPackName?: string
  onCreated?: (created: { pack: VkPack; url: string }, blob: Blob) => void
  makeSticker: () => Promise<Blob>
  initialBlob?: Blob
  alreadyUploaded: boolean
  initialUnknown: boolean
  onUnconfirmed: () => void
  filename: string
  onBack: () => void
  onFinish: () => void
  onStepChange: (step: number) => void
  onUploaded: (blob: Blob) => void
}

export function useVkWorkspaceUpload(options: VkWorkspaceUploadOptions) {
  const { pack, makeSticker, initialBlob, alreadyUploaded, initialUnknown, onUnconfirmed, filename, onStepChange, onUploaded, newPackName, onCreated } = options
  const reduceMotion = useReducedMotion()
  const [creationName] = useState(newPackName)
  const [sourceBlob] = useState(initialBlob)
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null)
  const [preparing, setPreparing] = useState(true)
  const [state, setState] = useState<ButtonState>(alreadyUploaded ? 'success' : initialUnknown ? 'error' : 'idle')
  const [error, setError] = useState(initialUnknown ? 'The upload could not be confirmed. Check this pack in VK Workspace before sending again.' : '')
  const [unknown, setUnknown] = useState(initialUnknown)
  const [reference, setReference] = useState('')
  const sending = useRef(false)
  const started = useRef(false)
  const mounted = useRef(false)
  const needsReference = pack.needsStickerURL && !alreadyUploaded
  const busy = state === 'loading'
  const complete = state === 'success'
  useEffect(() => {
    mounted.current = true
    let canceled = false
    let url: string | undefined
    Promise.resolve().then(() => canceled ? undefined : sourceBlob ?? makeSticker()).then(blob => {
      if (canceled || !blob) return
      url = URL.createObjectURL(blob)
      setPreview({ blob, url })
      setPreparing(false)
    }).catch(() => {
      if (!canceled) { setError('Could not prepare the sticker preview. Go back and try again.'); setPreparing(false) }
    })
    return () => { canceled = true; mounted.current = false; if (url) URL.revokeObjectURL(url) }
  }, [sourceBlob, makeSticker])
  const upload = useCallback(async () => {
    if (sending.current || !preview || unknown || complete || (needsReference && !isValidStickerReference(reference))) return
    sending.current = true
    setState('loading')
    setError('')
    onStepChange(2)
    try {
      if (creationName) {
        const created = await vkWorkspace.createPack(creationName, preview.blob, filename)
        if (!mounted.current) return
        onCreated?.(created, preview.blob)
      } else {
        await vkWorkspace.sendSticker(preview.blob, pack.id, { filename, ...(needsReference ? { stickerReference: reference.trim() } : {}) })
        if (!mounted.current) return
        onUploaded(preview.blob)
      }
      setState('success')
      onStepChange(3)
    } catch (cause) {
      if (!mounted.current) return
      const uncertain = !(cause instanceof VkServiceError) || cause.kind === 'unknown'
      setUnknown(uncertain)
      if (uncertain) onUnconfirmed()
      setState('error')
      setError(uncertain
        ? 'The upload could not be confirmed. Check this pack in VK Workspace before sending again.'
        : cause.kind === 'auth_required' ? 'Your session has expired. Go back and sign in again.'
        : 'Could not upload the sticker. Please try again.')
      onStepChange(2)
    } finally { sending.current = false }
  }, [preview, unknown, complete, needsReference, reference, pack.id, filename, onStepChange, onUploaded, onUnconfirmed, creationName, onCreated])
  useEffect(() => {
    if (!preview || alreadyUploaded || unknown || needsReference || started.current) return
    started.current = true
    void upload()
  }, [preview, alreadyUploaded, unknown, needsReference, upload])
  return {
    reduceMotion,
    creationName,
    preview,
    preparing,
    state,
    error,
    unknown,
    reference,
    setReference,
    needsReference,
    busy,
    complete,
    upload,
  }
}
