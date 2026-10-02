import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useReducedMotion } from 'motion/react'

import { type ButtonState } from '@/shared/ui/StatefulButton/StatefulButton'

import { vkWorkspace, VkServiceError, type VkPack } from '@/features/vk-workspace/api/vkWorkspace'

type NameCheck = { name: string; slug: string; available: boolean }

import { isValidPackName } from './packName'


export type VkWorkspacePacksOptions = {
  makeSticker: () => Promise<Blob>
  filename: string
  onStepChange: (step: number) => void
  onBack: () => void
  onFinish: () => void
}

export function useVkWorkspacePacks(options: VkWorkspacePacksOptions) {
  const { onStepChange } = options
  const [packs, setPacks] = useState<VkPack[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [mode, setMode] = useState<'select' | 'create' | 'prepared' | 'upload'>('select')
  const [name, setName] = useState('')
  const [checked, setChecked] = useState<NameCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [createState, setCreateState] = useState<ButtonState>('idle')
  const [error, setError] = useState('')
  const [nameError, setNameError] = useState('')
  const [createdPack, setCreatedPack] = useState<{ id: string; url: string; blob: Blob } | null>(null)
  const [unconfirmedPacks, setUnconfirmedPacks] = useState<string[]>([])
  const [uploaded, setUploaded] = useState<{ id: string; blob: Blob } | null>(null)
  const [draftPack, setDraftPack] = useState<{ id: string; name: string; slug: string } | null>(null)
  const operation = useRef<AbortController | null>(null)
  const currentName = useRef(name)
  const [preparationUncertain, setPreparationUncertain] = useState(false)
  const finishPreparation = useCallback(() => setMode('select'), [])
  const reduced = useReducedMotion()
  const choices: VkPack[] = draftPack ? [...packs, { ...draftPack, stickerCount: 0, needsStickerURL: false, installed: false }] : packs
  const selected = choices.find(pack => pack.id === selectedId)
  const createdURL = createdPack?.id === selectedId ? createdPack.url : ''
  const busy = checking || createState === 'loading'
  useEffect(() => { currentName.current = name }, [name])
  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => controller.signal.aborted ? undefined : vkWorkspace.refreshPacks(controller.signal)).then(next => {
      if (controller.signal.aborted || !next) return
      setPacks(next)
      setSelectedId(previous => next.some(pack => pack.id === previous) ? previous : '')
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof VkServiceError && cause.kind === 'auth_required'
        ? 'Your session has expired. Close this sheet and sign in again.'
        : 'Could not load your sticker packs. Please try again.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [loadAttempt])
  useEffect(() => () => operation.current?.abort(), [])
  const checkName = async () => {
    if (operation.current || !name.trim()) return
    if (!isValidPackName(name)) {
      setNameError('Use up to 64 characters: letters, numbers, spaces, hyphens or underscores.')
      return
    }
    const controller = new AbortController()
    operation.current = controller
    const candidate = name.trim().replace(/\s+/g, ' ')
    setChecking(true)
    setNameError('')
    try {
      const result = await vkWorkspace.checkPackName(candidate, controller.signal)
      if (controller.signal.aborted || currentName.current.trim().replace(/\s+/g, ' ') !== candidate) return
      setChecked(result)
      if (!result.available) setNameError('This pack address is already taken. Choose another name.')
    } catch (cause) {
      if (!controller.signal.aborted && currentName.current.trim().replace(/\s+/g, ' ') === candidate) {
        setNameError(cause instanceof VkServiceError && cause.kind === 'auth_required'
          ? 'Your session has expired. Sign in again.' : 'Could not check this pack address. Please try again.')
      }
    } finally {
      if (operation.current === controller) operation.current = null
      if (!controller.signal.aborted) setChecking(false)
    }
  }
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (operation.current || preparationUncertain || !isValidPackName(name)) return
    const controller = new AbortController()
    operation.current = controller
    setCreateState('loading')
    setNameError('')
    try {
      const candidate = name.trim().replace(/\s+/g, ' ')
      const result = checked?.name === candidate ? checked : await vkWorkspace.checkPackName(candidate, controller.signal)
      if (controller.signal.aborted) return
      setChecked(result)
      if (!result.available) {
        setNameError('This pack address is already taken. Choose another name.')
        setCreateState('idle')
        return
      }
      const prepared = await vkWorkspace.preparePack(result.name, controller.signal)
      if (controller.signal.aborted) return
      const draft = { id: `draft:${prepared.slug}`, name: prepared.name, slug: prepared.slug }
      setDraftPack(draft)
      setSelectedId(draft.id)
      setCreateState('success')
      setMode('prepared')
    } catch (cause) {
      if (controller.signal.aborted) return
      setCreateState('error')
      const uncertain = cause instanceof VkServiceError && cause.kind === 'unknown'
      setPreparationUncertain(uncertain)
      setNameError(cause instanceof VkServiceError && cause.kind === 'auth_required'
        ? 'Your session has expired. Sign in again.'
        : uncertain ? 'Pack preparation could not be confirmed. Check Stickers Bot before creating another pack.' : 'Could not prepare this pack. Please try again.')
    } finally {
      if (operation.current === controller) operation.current = null
    }
  }
  const reloadPacks = () => {
    setLoading(true)
    setError('')
    setLoadAttempt(value => value + 1)
  }
  const changeMode = (next: 'select' | 'create' | 'prepared' | 'upload') => {
    if (busy) return
    setMode(next)
    onStepChange(next === 'upload' ? (uploaded?.id === selectedId || createdPack?.id === selectedId ? 3 : 2) : 1)
  }
  return {
    packs,
    setPacks,
    selectedId,
    setSelectedId,
    loading,
    mode,
    name,
    setName,
    checked,
    setChecked,
    checking,
    createState,
    setCreateState,
    error,
    nameError,
    setNameError,
    createdPack,
    setCreatedPack,
    unconfirmedPacks,
    setUnconfirmedPacks,
    uploaded,
    setUploaded,
    draftPack,
    setDraftPack,
    preparationUncertain,
    finishPreparation,
    reduced,
    choices,
    selected,
    createdURL,
    busy,
    checkName,
    create,
    reloadPacks,
    changeMode,
  }
}
