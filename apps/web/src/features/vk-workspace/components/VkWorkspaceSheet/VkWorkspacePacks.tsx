import { isValidPackName } from '@/features/vk-workspace/model/packName'
import { useVkWorkspacePacks, type VkWorkspacePacksOptions } from '@/features/vk-workspace/model/useVkWorkspacePacks'

import { AnimatePresence, motion } from 'motion/react'
import { VkWorkspaceStickerUpload } from '@/features/vk-workspace/components/VkWorkspaceSheet/VkWorkspaceStickerUpload'
import { BackButton } from '@/shared/ui/BackButton/BackButton'
import { Button } from '@/shared/ui/Button/Button'
import { Input } from '@/shared/ui/Input/Input'
import { CharacterCount } from '@/shared/ui/CharacterCount/CharacterCount'
import { StatefulButton } from '@/shared/ui/StatefulButton/StatefulButton'
import { SuccessCheck } from '@/shared/ui/SuccessCheck/SuccessCheck'
import { Skeleton } from '@/shared/ui/Skeleton/Skeleton'
import { MorphSelect, MorphSelectContent, MorphSelectItem, MorphSelectTrigger, MorphSelectValue } from '@/shared/ui/SelectMorph/SelectMorph'

import { motionTokens } from '@/shared/lib/motion'
import logo from '@/shared/assets/vkworkspace-round.png'
import styles from './VkWorkspaceSheet.module.css'

export function VkWorkspacePacks({ makeSticker, filename, onStepChange, onBack, onFinish }: VkWorkspacePacksOptions) {
  const {
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
  } = useVkWorkspacePacks({ makeSticker, filename, onStepChange, onBack, onFinish })

  return <>
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={mode} className={styles.packScreen}
        initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -8 }}
        transition={reduced ? { duration: 0 } : { duration: motionTokens.duration.exit, ease: motionTokens.ease.standard }}>
        {mode !== 'upload' && mode !== 'prepared' && <>
          <img className={styles.logo} src={logo} width={72} height={72} alt="VK Workspace" />
          <h2 className={styles.heading}>{mode === 'create' ? 'Create a sticker pack' : 'Choose a sticker pack'}</h2>
          <p className={styles.subtitle}>{mode === 'create' ? 'Give your new pack a name' : draftPack ? 'Upload the first sticker to your new pack' : createdPack ? 'Your new sticker pack is ready' : 'Select one of your packs or create a new one'}</p>
        </>}
        <div className={styles.packForm}>
        {mode === 'prepared' ? <div className={styles.createdSuccess}>
          <SuccessCheck size={96} onComplete={finishPreparation} />
          <h2 className={styles.heading}>Pack ready</h2>
          <p className={styles.reviewDescription}>{draftPack?.name}</p>
        </div> : mode === 'create' ? <form className={styles.packControls} onSubmit={create}>
          <Input autoFocus appearance="auth" aria-label="Sticker pack name" placeholder="Pack name" required maxLength={64}
            onLimitReached={() => setNameError('Pack names must be 64 characters or fewer.')} value={name} rightIcon={<CharacterCount count={name.length} limit={64} />} disabled={createState === 'loading'} error={nameError || undefined}
            onBlur={event => { if (!(event.relatedTarget instanceof HTMLButtonElement && event.relatedTarget.type === 'submit')) void checkName() }} classNames={{ field: styles.field, input: styles.input, rightIcon: styles.nameCounter, errorMessage: styles.error }}
            onChange={value => {
              setName(value); setChecked(null);
              setNameError(value.length > 64 ? 'Pack names must be 64 characters or fewer.' : value.trim() && !isValidPackName(value) ? 'Use letters, numbers, spaces, hyphens or underscores, with at least one letter or number.' : '');
              setCreateState('idle')
            }} />
          <p className={styles.packHint} role="status">{checking ? 'Checking pack address…' : 'Up to 64 characters: letters, numbers, spaces, hyphens or underscores.'}</p>
          <div className={styles.packNavigation}>
            <BackButton appearance="circle" whileHover={undefined} onClick={() => changeMode('select')} disabled={busy} aria-label="Back to packs" />
            <StatefulButton whileHover={undefined} type="submit" size="md" className={styles.submit} state={createState} loadingText="Creating…" successText="Ready" successIcon={null} errorText={preparationUncertain ? "Check the bot" : "Try again"} disabled={busy || preparationUncertain || !isValidPackName(name) || checked?.available === false}>Create</StatefulButton>
          </div>
        </form> : mode === 'upload' && selected ? <VkWorkspaceStickerUpload pack={selected} makeSticker={makeSticker} filename={filename}
          newPackName={draftPack?.id === selectedId ? draftPack.name : undefined}
          onCreated={(created, blob) => {
            setPacks(previous => [...previous.filter(pack => pack.id !== created.pack.id), created.pack])
            setSelectedId(created.pack.id)
            setCreatedPack({ id: created.pack.id, url: created.url, blob })
            setDraftPack(null)
          }}
          initialBlob={uploaded?.id === selectedId ? uploaded.blob : createdPack?.id === selectedId ? createdPack.blob : undefined}
          alreadyUploaded={uploaded?.id === selectedId || createdPack?.id === selectedId}
          initialUnknown={unconfirmedPacks.includes(selectedId)} onUnconfirmed={() => setUnconfirmedPacks(previous => [...new Set([...previous, selectedId])])}
          onBack={() => changeMode('select')} onFinish={onFinish} onStepChange={onStepChange}
          onUploaded={blob => setUploaded({ id: selectedId, blob })} /> : <Skeleton loading={loading} lines={3} label="Loading your sticker packs">
          <div className={styles.packControls}>
            {error ? <><p className={styles.packError} role="alert">{error}</p><Button variant="secondary" size="sm" onClick={reloadPacks}>Try again</Button></>
              : choices.length ? <MorphSelect value={selectedId} onValueChange={setSelectedId}>
                <MorphSelectTrigger label="Sticker pack"><MorphSelectValue placeholder="Select a sticker pack" /></MorphSelectTrigger>
                <MorphSelectContent>{choices.map(pack => <MorphSelectItem key={pack.id} value={pack.id} label={pack.name}>{pack.name}{pack.id === draftPack?.id ? ' (new)' : pack.stickerCount !== null ? ` (${pack.stickerCount})` : ''}</MorphSelectItem>)}</MorphSelectContent>
              </MorphSelect> : <p className={styles.packHint}>No sticker packs yet. Create your first one.</p>}
            {createdURL && <p role="status" className={styles.packHint}>Pack created successfully.<br /><a className={styles.packLink} href={createdURL} target="_blank" rel="noopener noreferrer">Open sticker pack</a></p>}
            {!draftPack && !createdPack && <Button variant="secondary" size="md" whileHover={undefined} className={styles.newPack} onClick={() => changeMode('create')} disabled={!!error}>Create new sticker pack</Button>}
            <div className={styles.packNavigation}>
              <BackButton appearance="circle" whileHover={undefined} onClick={onBack} aria-label="Back to sign in" />
              <Button size="md" whileHover={undefined} className={styles.submit} disabled={!selected || !!error} onClick={() => changeMode('upload')}>Upload</Button>
            </div>
          </div>
        </Skeleton>}
        </div>
      </motion.div>
    </AnimatePresence>
  </>
}
