import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { IconPlus } from 'symbols-react'
import { IntelligenceGlow } from '../../ui/IntelligenceGlow'
import styles from './AddPhotoCard.module.css'

const acceptedTypes = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
}

export function AddPhotoCard() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    accept: acceptedTypes,
    multiple: false,
    onDropAccepted: ([file]) => {
      setSelectedFile(file.name)
      setError(null)
    },
    onDropRejected: () => setError('Choose a PNG, JPG, or WebP image.'),
  })

  const className = [styles.dropzone, isDragActive && styles.active, isDragReject && styles.reject].filter(Boolean).join(' ')

  return (
    <div className={styles.wrap}>
      <div {...getRootProps({ className, role: 'button', 'aria-label': 'Add your photo. Click or drop a PNG, JPG, or WebP image.' })}>
        <input {...getInputProps()} />
        <svg className={styles.dashedBorder} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M 50 1 H 89.5 A 9.5 9.5 0 0 1 99 10.5 V 89.5 A 9.5 9.5 0 0 1 89.5 99 H 50" />
          <path d="M 50 1 H 89.5 A 9.5 9.5 0 0 1 99 10.5 V 89.5 A 9.5 9.5 0 0 1 89.5 99 H 50" transform="translate(100 0) scale(-1 1)" />
        </svg>
        <IntelligenceGlow />
        <span className={styles.content}>
          <IconPlus className={styles.addIcon} width={28} height={28} fill="currentColor" aria-hidden="true" />
          <span className={styles.title}>
            {isDragActive ? 'Drop photo here' : selectedFile ? 'Photo selected' : <><span>Click or drop</span><span>here</span></>}
          </span>
          {selectedFile && !isDragActive && <span className={styles.filename}>{selectedFile}</span>}
          <span className={styles.types}>PNG, JPG or WebP</span>
        </span>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {selectedFile && <span className={styles.srOnly} role="status">{selectedFile} selected. Custom photo editing is coming next.</span>}
    </div>
  )
}
