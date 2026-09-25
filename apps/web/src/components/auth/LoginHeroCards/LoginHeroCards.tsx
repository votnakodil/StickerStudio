import maxLight from '../../../assets/auth/max_light.webp'
import maxDark from '../../../assets/auth/max_dark.webp'
import sanyaLight from '../../../assets/auth/sanya_light.webp'
import sanyaDark from '../../../assets/auth/sanya_dark.webp'
import zhekaLight from '../../../assets/auth/zheka_light.webp'
import zhekaDark from '../../../assets/auth/zheka_dark.webp'
import styles from './LoginHeroCards.module.css'

const portraits = [
  { name: 'Max', light: maxLight, dark: maxDark },
  { name: 'Sanya', light: sanyaLight, dark: sanyaDark },
  { name: 'Zheka', light: zhekaLight, dark: zhekaDark },
]

export function LoginHeroCards() {
  return (
    <div className={styles.stage} aria-label="Sticker Studio portraits">
      {portraits.map((portrait, index) => (
        <div key={portrait.name} className={`${styles.card} ${styles[`card${index}`]}`}>
          <picture>
            <source srcSet={portrait.dark} media="(prefers-color-scheme: dark)" />
            <img src={portrait.light} alt={portrait.name} draggable={false} />
          </picture>
        </div>
      ))}
    </div>
  )
}
