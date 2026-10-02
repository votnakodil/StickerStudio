import { useCallback, useEffect, useRef, useState } from 'react'
import { useAnimationControls, useReducedMotion } from 'motion/react'
import { exportStickerBlob, type StickerCanvas } from '@sticker-studio/editor'

import { type ButtonState } from '@/shared/ui/StatefulButton/StatefulButton'

import { EASE_OUT, SPRING_EDITOR_REVEAL } from '@/shared/lib/motion'
import { downloadSticker, stickerFilename } from '@/features/editor/lib/downloadSticker'
import { loadMyLibrary, saveToMyLibrary, useLibraryStore } from '@/features/library'
import { findStickerById } from '@/features/library'

export const LIBRARY_PROMPT_SECONDS = 7

export type ExportActionsOptions = {
  canvas: StickerCanvas | null
  stickerName?: string
  active?: boolean
  onFinish?: () => void
}

export function useExportActions(options: ExportActionsOptions) {
  const { canvas, stickerName, active = true, onFinish } = options
  const [pngState, setPngState] = useState<ButtonState>('idle')
  const [libraryState, setLibraryState] = useState<ButtonState>('idle')
  const [alreadySaved, setAlreadySaved] = useState(false)
  const [deadline, setDeadline] = useState<number | null>(null)
  const [seconds, setSeconds] = useState(LIBRARY_PROMPT_SECONDS)
  const [error, setError] = useState('')
  const [vkOpen, setVkOpen] = useState(false)
  const savingRef = useRef(false)
  const acceptingRef = useRef(false)
  const generation = useRef(0)
  const reduceMotion = useReducedMotion()
  const libraryAnimation = useAnimationControls()
  const libraryTextAnimation = useAnimationControls()
  const prompting = deadline !== null
  const emphasizeAlreadySaved = () => {
    if (reduceMotion) return
    libraryAnimation.stop()
    libraryTextAnimation.stop()
    libraryAnimation.set({ x: 0 })
    libraryTextAnimation.set({ scale: 1 })
    void libraryAnimation.start({ x: [0, -5, 4, -3, 2, 0], transition: { duration: 0.32 } })
    void libraryTextAnimation.start({
      scale: [1, 1.07, 1],
      transition: { duration: 0.28, delay: 0.32, times: [0, 0.35, 1], ease: 'easeOut' },
    })
  }
  const dismiss = useCallback(() => {
    if (acceptingRef.current) return
    setDeadline(null)
    setPngState('idle')
    setLibraryState('idle')
    onFinish?.()
  }, [onFinish])
  useEffect(() => {
    const version = ++generation.current
    if (!active) {
      const timer = window.setTimeout(() => {
        if (generation.current !== version) return
        setDeadline(null)
        setPngState('idle')
        setLibraryState('idle')
        setError('')
      }, 0)
      return () => { window.clearTimeout(timer); generation.current = version + 1 }
    }
    return () => { generation.current = version + 1 }
  }, [active])
  useEffect(() => {
    if (pngState !== 'success') return
    const timer = window.setTimeout(() => setPngState('idle'), 2000)
    return () => window.clearTimeout(timer)
  }, [pngState])
  useEffect(() => {
    if (deadline === null || !active) return
    const tick = () => {
      const remaining = deadline - performance.now()
      if (remaining <= 0) dismiss()
      else setSeconds(Math.ceil(remaining / 1000))
    }
    const timer = window.setInterval(tick, 50)
    return () => window.clearInterval(timer)
  }, [deadline, active, dismiss])
  const offerLibrary = () => {
    if (alreadySaved) return
    setSeconds(LIBRARY_PROMPT_SECONDS)
    setLibraryState('idle')
    setDeadline(performance.now() + LIBRARY_PROMPT_SECONDS * 1000)
  }
  const savePng = async () => {
    if (!canvas || savingRef.current || prompting || acceptingRef.current) return
    savingRef.current = true
    const version = generation.current
    setError('')
    setPngState('loading')
    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      const [blob] = await Promise.all([
        exportStickerBlob(canvas),
        new Promise<void>((resolve) => window.setTimeout(resolve, 700)),
      ])
      downloadSticker(blob, stickerFilename(stickerName))
      if (generation.current !== version) return
      setPngState('success')
      await loadMyLibrary()
      if (generation.current !== version) return
      const template = findStickerById(stickerName)
      if (template && useLibraryStore.getState().templateIds.includes(template.id)) {
        setAlreadySaved(true)
        setLibraryState('idle')
        setDeadline(null)
      } else offerLibrary()
    } catch (cause) {
      if (generation.current !== version) return
      setPngState('error')
      setError(cause instanceof Error ? cause.message : 'Could not save PNG.')
    } finally {
      savingRef.current = false
    }
  }
  const accept = async () => {
    const template = findStickerById(stickerName)
    if (!template || acceptingRef.current) return
    acceptingRef.current = true
    const version = generation.current
    setDeadline(null)
    setError('')
    try {
      await loadMyLibrary()
      if (generation.current !== version) return
      const showAlreadySaved = () => {
        setLibraryState('idle')
        setAlreadySaved(true)
        emphasizeAlreadySaved()
      }
      if (useLibraryStore.getState().templateIds.includes(template.id)) {
        showAlreadySaved()
        return
      }
      setLibraryState('loading')
      const [result] = await Promise.all([
        saveToMyLibrary(template.id),
        new Promise<void>((resolve) => window.setTimeout(resolve, 700)),
      ])
      if (generation.current === version) {
        if (result.status === 'already_saved') showAlreadySaved()
        else setLibraryState('success')
      }
    } catch (cause) {
      if (generation.current === version) {
        setLibraryState('error')
        setError(cause instanceof Error ? cause.message : 'Could not save to My Library.')
      }
    } finally {
      acceptingRef.current = false
    }
  }
  useEffect(() => {
    if (libraryState !== 'success') return
    const timer = window.setTimeout(dismiss, 1500)
    return () => window.clearTimeout(timer)
  }, [libraryState, dismiss])
  const saveLibrary = async () => {
    if (alreadySaved) { emphasizeAlreadySaved(); return }
    if (!canvas || prompting || libraryState === 'success' || acceptingRef.current || savingRef.current) return
    await accept()
  }
  const revealTransition = reduceMotion ? { duration: 0 }
    : prompting ? SPRING_EDITOR_REVEAL : { duration: 0.24, ease: EASE_OUT }
  return {
    pngState,
    libraryState,
    alreadySaved,
    seconds,
    error,
    vkOpen,
    setVkOpen,
    reduceMotion,
    libraryAnimation,
    libraryTextAnimation,
    prompting,
    dismiss,
    savePng,
    accept,
    saveLibrary,
    revealTransition,
  }
}
