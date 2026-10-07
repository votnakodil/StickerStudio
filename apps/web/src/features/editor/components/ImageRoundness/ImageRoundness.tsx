import { useImageRoundness } from '../../model/useImageRoundness'
import { BubbleSlider } from '@/shared/ui/BubbleSlider/BubbleSlider'
import { NumberInput } from '@/shared/ui/NumberInput/NumberInput'
import inspectorStyles from '../InspectorPanel/InspectorPanel.module.css'
import styles from './ImageRoundness.module.css'

export function ImageRoundness() {
  const roundness = useImageRoundness()
  return <section className={styles.section} aria-label="Image roundness">
    <div className={styles.heading}>
      <h3>Roundness</h3>
      <label className={`${inspectorStyles.sizeField} ${inspectorStyles.strokeWidthInput}`}>
        <NumberInput min={0} max={100} value={roundness.amount} readOnly={!roundness.image} ariaLabel="Image roundness percentage" onValueChange={value => {
          roundness.changeAmount(value)
          roundness.commit()
        }} />
        <span>%</span>
      </label>
    </div>
    <div onPointerDownCapture={roundness.startDrag} onPointerUp={roundness.endDrag} onPointerCancel={roundness.endDrag} onKeyUp={roundness.commit}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) roundness.commit() }}>
      <BubbleSlider className={styles.slider} min={0} max={100} step={1} value={roundness.amount}
        disabled={!roundness.image} aria-label="Image roundness" formatValueText={value => `${value}%`}
        showBubble={false} onValueChange={roundness.changeAmount} />
    </div>
    {roundness.error && <p role="alert" className={styles.error}>{roundness.error}</p>}
  </section>
}
