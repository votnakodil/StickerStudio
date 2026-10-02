import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { useReducedMotion } from 'motion/react'

import { exportStickerBlob, type StickerCanvas } from '@sticker-studio/editor'

import { type ButtonState } from '@/shared/ui/StatefulButton/StatefulButton'

import { vkWorkspace, VkServiceError } from '@/features/vk-workspace/api/vkWorkspace'

const compactQuery = '(max-width: 700px)'

const subscribeViewport = (onChange: () => void) => {
  const query = window.matchMedia(compactQuery)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export type VkWorkspaceAuthOptions = { canvas: StickerCanvas | null; stickerName: string; onFinish: () => void }

export function useVkWorkspaceAuth(options: VkWorkspaceAuthOptions) {
  const { canvas } = options
  const [stage, setStage] = useState<'email' | 'password' | 'connected' | 'pack'>('email')
  const [packStep, setPackStep] = useState(1)
  const finishAuthorization = useCallback(() => setStage('pack'), [])
  const makeSticker = useCallback(async () => {
    if (!canvas) throw new Error('The sticker canvas is unavailable.')
    return exportStickerBlob(canvas)
  }, [canvas])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<ButtonState>('idle')
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const emailInput = useRef<HTMLInputElement>(null)
  const reduced = useReducedMotion()
  const compact = useSyncExternalStore(subscribeViewport, () => window.matchMedia(compactQuery).matches, () => false)
  const busy = state === 'loading'
  useEffect(() => () => { request.current?.abort() }, [])
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (request.current || (stage !== 'email' && stage !== 'password')) return
    setError('')
    if (stage === 'email') {
      setEmail(email.trim())
      setStage('password')
      return
    }
    if (!password) return
    const controller = new AbortController()
    request.current = controller
    setState('loading')
    try {
      const account = await vkWorkspace.authorize(email, password, controller.signal)
      if (controller.signal.aborted) return
      setPassword('')
      setEmail(account.email)
      setVisible(false)
      setState('success')
      setStage('connected')
    } catch (cause) {
      if (controller.signal.aborted) return
      setState('error')
      setError(cause instanceof VkServiceError && cause.kind === 'auth_required'
        ? 'We couldn’t sign you in. Check your email and password.'
        : 'Could not connect to VK Workspace. Please try again.')
    } finally {
      if (request.current === controller) request.current = null
    }
  }
  const back = () => {
    if (busy) return
    setPassword('')
    setVisible(false)
    setError('')
    setState('idle')
    setStage('email')
  }
  return {
    stage,
    setStage,
    packStep,
    setPackStep,
    finishAuthorization,
    makeSticker,
    email,
    setEmail,
    password,
    setPassword,
    visible,
    setVisible,
    state,
    setState,
    error,
    setError,
    passwordInput,
    emailInput,
    reduced,
    compact,
    busy,
    submit,
    back,
  }
}
