import { LibraryTabs } from '../components/library/LibraryTabs/LibraryTabs'
import { stickers } from '../data/stickers'
import styles from './LibraryPage.module.css'

export function LibraryPage() {
  return (
    <main className={styles.page}>
      <div className="mx-auto w-full max-w-[88rem] px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <header className="mb-5 sm:mb-6">
          <p className={styles.eyebrow}>Sticker Studio</p>
          <h1 className={styles.title}>Choose a sticker</h1>
          <p className={styles.subtitle}>Choose a sticker made by community, or create your own</p>
        </header>
        <LibraryTabs stickers={stickers} />
      </div>
    </main>
  )
}
