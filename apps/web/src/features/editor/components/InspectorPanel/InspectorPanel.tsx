import { palette } from '@sticker-studio/theme'
import { useEffect, useRef, useState } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'motion/react'
import { SPRING_EDITOR_REVEAL } from '@/shared/lib/motion'
import { FabricImage, Textbox } from 'fabric'
import { IconPhoto, IconTextformat } from 'symbols-react'
import { HexColorPicker } from 'react-colorful'
import { getStickerTextAutoSize, getStickerCanvasBackground, getStickerFontWeights, normalizeStickerFontWeight, getStickerStroke, subscribeStickerCanvasBackground, updateStickerCanvasBackground, updateStickerImageOpacity, updateStickerStroke, updateStickerTextStyle, type StickerCanvas, type StickerStrokeSettings } from '@sticker-studio/editor'
import { useEditorStore } from '@/features/editor/model/editorStore'
import { MorphSelect, MorphSelectContent, MorphSelectItem, MorphSelectTrigger, MorphSelectValue } from '@/shared/ui/SelectMorph/SelectMorph'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/Tabs/Tabs'
import { ColorSelector, ColorSelectorItem, ColorSelectorList } from '@/shared/ui/ColorSelector/ColorSelector'
import { BubbleSlider } from '@/shared/ui/BubbleSlider/BubbleSlider'
import { NumberInput } from '@/shared/ui/NumberInput/NumberInput'
import { Switch } from '@/shared/ui/Switch/Switch'
import { ShakeFeedback } from '@/shared/ui/ShakeFeedback/ShakeFeedback'
import { FloatingPopover } from '@/shared/ui/FloatingPopover/FloatingPopover'
import styles from './InspectorPanel.module.css'

const fonts = ['Times New Roman', 'SF Pro Text', 'Arial', 'Helvetica', 'Georgia', 'Courier New', 'Impact']
const weightLabels: Record<number, string> = { 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 900: 'Black' }
const editorPalette = [
  { label: 'Black', color: palette.ink },
  { label: 'White', color: palette.white },
  { label: 'Blue', color: palette.editorBlue },
  { label: 'Red', color: palette.errorRed },
  { label: 'Green', color: palette.editorGreen },
]
const canvasPalette = editorPalette.filter(({ label }) => label !== 'Green')
const alignments = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'justify', label: 'Distribute letters across width' },
] as const
const verticalAlignments = [
  { value: 'top', label: 'Align top' },
  { value: 'middle', label: 'Align middle' },
  { value: 'bottom', label: 'Align bottom' },
] as const
const ALIGNMENT_SPRING = { type: 'spring', stiffness: 330, damping: 16, mass: 0.7 } as const

function AlignmentGlyph({ alignment }: { alignment: (typeof alignments)[number]['value'] }) {
  const shortLineX = alignment === 'right' ? 8 : alignment === 'center' ? 5 : 2
  const shortLineWidth = alignment === 'justify' ? 14 : 8
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" fill="currentColor" aria-hidden="true">
      <rect x="2" y="2" width="14" height="2" rx="1" />
      <rect x={shortLineX} y="7" width={shortLineWidth} height="2" rx="1" />
      <rect x="2" y="12" width="14" height="2" rx="1" />
    </svg>
  )
}

function VerticalAlignmentGlyph({ alignment }: { alignment: (typeof verticalAlignments)[number]['value'] }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {alignment === 'top' ? <><path d="M3 3h14M10 17V7m-4 4 4-4 4 4" /></>
        : alignment === 'bottom' ? <><path d="M3 17h14M10 3v10m-4-4 4 4 4-4" /></>
          : <><path d="M3 10h14M10 2v5m-3-3 3 3 3-3M10 18v-5m-3 3 3-3 3 3" /></>}
    </svg>
  )
}

function StrokeSection({ canvas, object }: { canvas: StickerCanvas; object: Textbox | FabricImage }) {
  const stroke = getStickerStroke(object)
  const [customOpen, setCustomOpen] = useState(false)
  const [customColor, setCustomColor] = useState<string>(palette.white)
  const [colorInput, setColorInput] = useState<string>(palette.white)
  const colorControlRef = useRef<HTMLDivElement>(null)
  const changeStroke = (changes: Partial<StickerStrokeSettings>) => updateStickerStroke(canvas, object, changes)
  const chosenColor = editorPalette.some((item) => item.color === stroke.color) ? stroke.color : 'custom'
  const customDisplayColor = chosenColor === 'custom' ? stroke.color : customColor
  const changeCustomColor = (color: string) => {
    setCustomColor(color)
    setColorInput(color)
    changeStroke({ color })
  }
  const openCustomColor = () => {
    setColorInput(customDisplayColor)
    setCustomOpen(true)
  }
  const toggleCustomColor = () => {
    if (!customOpen) setColorInput(customDisplayColor)
    setCustomOpen((open) => !open)
  }

  return (
    <section className={styles.section} aria-label="Stroke settings">
      <div className={styles.strokeHeader}>
        <h3>Stroke</h3>
        <Switch checked={stroke.enabled} onCheckedChange={(enabled) => changeStroke({ enabled })} ariaLabel="Enable stroke" />
      </div>
      {stroke.enabled && (
        <div className={styles.strokeSettings}>
          <div>
            <div className={styles.strokeFieldHeading}>
              <span>Thickness</span>
              <label className={`${styles.sizeField} ${styles.strokeWidthInput}`}>
                <NumberInput min={1} max={60} value={stroke.width} ariaLabel="Stroke thickness" onValueChange={(width) => changeStroke({ width })} />
                <span>px</span>
              </label>
            </div>
            <BubbleSlider className={styles.strokeSlider} showBubble={false} min={1} max={60} step={1} value={stroke.width} aria-label="Stroke thickness" formatValueText={(value) => `${value} pixels`} onValueChange={(width) => changeStroke({ width })} />
          </div>
          <div>
            <span className={styles.strokeLabel}>Color</span>
            <div className={styles.colorControl} ref={colorControlRef}>
              <ColorSelector value={customOpen ? 'custom' : chosenColor} onValueChange={(value) => {
                if (value === 'custom') {
                  changeStroke({ color: customDisplayColor })
                  openCustomColor()
                } else {
                  setCustomOpen(false)
                  changeStroke({ color: value })
                }
              }}>
                <ColorSelectorList>
                  {editorPalette.map(({ label, color }) => <ColorSelectorItem key={color} value={color} color={color} label={label} />)}
                  <ColorSelectorItem value="custom" color={customDisplayColor} label="Custom stroke color" swatchBackground="conic-gradient(var(--palette-error-red), var(--palette-editor-orange), var(--palette-editor-yellow), var(--palette-editor-green), var(--palette-editor-blue), var(--palette-editor-purple), var(--palette-error-red))" onClick={toggleCustomColor} />
                </ColorSelectorList>
              </ColorSelector>
              {customOpen && (
                <FloatingPopover anchorRef={colorControlRef} className={styles.colorPopover} label="Custom stroke color" onClose={() => setCustomOpen(false)}>
                  <HexColorPicker color={customDisplayColor} onChange={changeCustomColor} />
                  <label className={styles.hexField}>
                    <span>Hex</span>
                    <input aria-label="Custom stroke color hex value" value={colorInput} onChange={(event) => {
                      const next = event.target.value
                      setColorInput(next)
                      if (/^#[\da-f]{6}$/i.test(next)) changeCustomColor(next)
                    }} onBlur={() => setColorInput(customDisplayColor)} />
                  </label>
                </FloatingPopover>
              )}
            </div>
          </div>
          <div>
            <div className={styles.strokeFieldHeading}><span>Opacity</span><output>{Math.round(stroke.opacity * 100)}%</output></div>
            <BubbleSlider className={styles.strokeSlider} showBubble={false} min={0} max={100} step={1} value={Math.round(stroke.opacity * 100)} aria-label="Stroke opacity" formatValueText={(value) => `${value}%`} onValueChange={(opacity) => changeStroke({ opacity: opacity / 100 })} />
          </div>
        </div>
      )}
    </section>
  )
}

function CanvasColorSection({ canvas }: { canvas: StickerCanvas }) {
  const [customOpen, setCustomOpen] = useState(false)
  const [customColor, setCustomColor] = useState<string>(palette.white)
  const [colorInput, setColorInput] = useState<string>(palette.white)
  const colorControlRef = useRef<HTMLDivElement>(null)
  const color = getStickerCanvasBackground(canvas).toLowerCase()
  const chosenColor = color === 'transparent' || canvasPalette.some((item) => item.color === color) ? color : 'custom'
  const customDisplayColor = chosenColor === 'custom' ? color : customColor

  const changeCustomColor = (next: string) => {
    setCustomColor(next)
    setColorInput(next)
    updateStickerCanvasBackground(canvas, next)
  }
  const openCustomColor = () => {
    setColorInput(customDisplayColor)
    setCustomOpen(true)
  }
  const toggleCustomColor = () => {
    if (!customOpen) setColorInput(customDisplayColor)
    setCustomOpen((open) => !open)
  }

  return (
    <section className={styles.section} aria-label="Canvas color">
      <h3>Color</h3>
      <div className={styles.colorControl} ref={colorControlRef}>
        <ColorSelector value={customOpen ? 'custom' : chosenColor} onValueChange={(value) => {
          if (value === 'custom') {
            updateStickerCanvasBackground(canvas, customDisplayColor)
            openCustomColor()
          } else {
            setCustomOpen(false)
            updateStickerCanvasBackground(canvas, value)
          }
        }}>
          <ColorSelectorList>
            <ColorSelectorItem value="transparent" color={palette.neutral057} label="Transparent canvas" swatchBackground="repeating-conic-gradient(var(--palette-neutral073) 0% 25%, var(--palette-white) 0% 50%)" />
            {canvasPalette.map(({ label, color: option }) => <ColorSelectorItem key={option} value={option} color={option} label={label} />)}
            <ColorSelectorItem value="custom" color={customDisplayColor} label="Custom canvas color" swatchBackground="conic-gradient(var(--palette-error-red), var(--palette-editor-orange), var(--palette-editor-yellow), var(--palette-editor-green), var(--palette-editor-blue), var(--palette-editor-purple), var(--palette-error-red))" onClick={toggleCustomColor} />
          </ColorSelectorList>
        </ColorSelector>
        {customOpen && (
          <FloatingPopover anchorRef={colorControlRef} className={styles.colorPopover} label="Custom canvas color" onClose={() => setCustomOpen(false)}>
            <HexColorPicker color={customDisplayColor} onChange={changeCustomColor} />
            <label className={styles.hexField}>
              <span>Hex</span>
              <input aria-label="Custom canvas color hex value" value={colorInput} onChange={(event) => {
                const next = event.target.value
                setColorInput(next)
                if (/^#[\da-f]{6}$/i.test(next)) changeCustomColor(next)
              }} onBlur={() => setColorInput(customDisplayColor)} />
            </label>
          </FloatingPopover>
        )}
      </div>
    </section>
  )
}

export function InspectorPanel() {
  const reduceMotion = useReducedMotion()
  const autoSizeFeedback = useAnimationControls()
  const emphasizeAutoSize = () => {
    if (reduceMotion) return
    autoSizeFeedback.stop()
    void autoSizeFeedback.start({
      scale: [1, 1.07, 1],
      transition: { duration: 0.28, times: [0, 0.35, 1], ease: 'easeOut' },
    })
  }
  const canvas = useEditorStore((state) => state.canvas)
  const [, setRevision] = useState(0)
  const [customOpen, setCustomOpen] = useState(false)
  const [customColor, setCustomColor] = useState<string>(palette.white)
  const [colorInput, setColorInput] = useState<string>(palette.white)
  const colorControlRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!canvas) return
    const refresh = () => setRevision((revision) => revision + 1)
    const events = ['selection:created', 'selection:updated', 'selection:cleared', 'object:modified', 'object:removed', 'text:changed'] as const
    events.forEach((event) => canvas.on(event, refresh))
    const unsubscribeBackground = subscribeStickerCanvasBackground(canvas, refresh)
    return () => {
      events.forEach((event) => canvas.off(event, refresh))
      unsubscribeBackground()
    }
  }, [canvas])

  const activeObjects = canvas?.getActiveObjects() ?? []
  const selected = activeObjects.length === 1 ? activeObjects[0] : null
  if (!canvas || activeObjects.length > 1) return null

  const text = selected instanceof Textbox ? selected : null
  const image = selected instanceof FabricImage ? selected : null
  const setText = (changes: Parameters<typeof updateStickerTextStyle>[2]) => {
    if (text) updateStickerTextStyle(canvas, text, changes)
  }
  const autoSize = text ? getStickerTextAutoSize(text) : false
  const fontFamily = text?.fontFamily || 'Times New Roman'
  const fontOptions = fonts.includes(fontFamily) ? fonts : [fontFamily, ...fonts]
  const fontWeight = normalizeStickerFontWeight(fontFamily, text?.fontWeight ?? 400)
  const fontWeights = getStickerFontWeights(fontFamily)
  const fill = typeof text?.fill === 'string' && /^#[\da-f]{6}$/i.test(text.fill) ? text.fill : palette.ink
  const chosenColor = editorPalette.some((item) => item.color === fill.toLowerCase()) ? fill.toLowerCase() : 'custom'
  const customDisplayColor = chosenColor === 'custom' ? fill : customColor
  const changeCustomColor = (color: string) => {
    setCustomColor(color)
    setColorInput(color)
    setText({ fill: color })
  }
  const openCustomColor = () => {
    setColorInput(customDisplayColor)
    setCustomOpen(true)
  }
  const toggleCustomColor = () => {
    if (!customOpen) setColorInput(customDisplayColor)
    setCustomOpen((open) => !open)
  }
  const styleValues = text ? [
    ...(fontWeight >= 700 ? ['bold'] : []),
    ...(text.fontStyle === 'italic' ? ['italic'] : []),
    ...(text.underline ? ['underline'] : []),
    ...(text.linethrough ? ['strikethrough'] : []),
  ] : []
  const verticalAlignment = (text as (Textbox & { stickerVerticalAlign?: string }) | null)?.stickerVerticalAlign ?? 'top'

  return (
    <motion.aside className={styles.panel} aria-label="Layer settings"
      initial={reduceMotion ? false : { x: '130%' }}
      animate={{ x: '0%' }}
      transition={reduceMotion ? { duration: 0 } : SPRING_EDITOR_REVEAL}
    >
      <div className={styles.surface}>
        <header className={styles.header}>
          <span className={styles.headerIcon} aria-hidden="true">
            {text ? <IconTextformat width={18} height={18} fill="currentColor" /> : image ? <IconPhoto width={18} height={18} fill="currentColor" /> : <span className={styles.canvasHeaderIcon} />}
          </span>
          <div className={styles.headerLabels}>
            <h2>{text ? 'Text' : image ? 'Image' : 'Canvas'}</h2>
            <span>{text ? text.text || 'Empty text' : image ? 'Sticker image' : `${canvas.getWidth()} × ${canvas.getHeight()} px`}</span>
          </div>
        </header>

        {text ? (
          <div className={styles.content}>
            <section className={`${styles.section} ${styles.typographySection}`} aria-label="Font settings">
              <h3>Typography</h3>
              <span className={styles.fieldLabel}>Font</span>
              <MorphSelect value={fontFamily} onValueChange={(font) => setText({ fontFamily: font })}>
                <MorphSelectTrigger label="Font"><MorphSelectValue /></MorphSelectTrigger>
                <MorphSelectContent>{fontOptions.map((font) => <MorphSelectItem key={font} value={font}><span style={{ fontFamily: font }}>{font}</span></MorphSelectItem>)}</MorphSelectContent>
              </MorphSelect>
              <div className={styles.twoColumns}>
                <div className={styles.stackedField}>
                  <span>Weight</span>
                  <MorphSelect value={String(fontWeight)} disabled={fontWeights.length === 1} onValueChange={(weight) => setText({ fontWeight: Number(weight) })}>
                    <MorphSelectTrigger label="Weight"><MorphSelectValue /></MorphSelectTrigger>
                    <MorphSelectContent>
                      {fontWeights.map((weight) => <MorphSelectItem key={weight} value={String(weight)} label={weightLabels[weight]}><span style={{ fontFamily, fontWeight: weight }}>{weightLabels[weight]}</span></MorphSelectItem>)}
                    </MorphSelectContent>
                  </MorphSelect>
                </div>
                <ShakeFeedback blocked={autoSize} onBlockedAttempt={emphasizeAutoSize} className={styles.stackedField}>
                  <span>Size</span>
                  <span className={styles.sizeField}>
                    <NumberInput readOnly={autoSize} min={8} max={400} value={Math.round(text.fontSize)} onValueChange={(fontSize) => setText({ fontSize })} ariaLabel="Font size" />
                    <span>px</span>
                  </span>
                </ShakeFeedback>
              </div>
              <ShakeFeedback blocked={autoSize} onBlockedAttempt={emphasizeAutoSize} className={styles.sizeSliderRow}>
                <span className={styles.sizeMinIcon} aria-hidden="true">T</span>
                <BubbleSlider disabled={autoSize} className={styles.sizeSlider} showBubble={false} value={Math.round(text.fontSize)} onValueChange={(fontSize) => setText({ fontSize })} min={8} max={400} step={1} aria-label="Font size" formatValueText={(value) => `${value} pixels`} />
                <span className={styles.sizeMaxIcon} aria-hidden="true">T</span>
              </ShakeFeedback>
              <div className={styles.autoSizeRow}>
                <motion.span animate={autoSizeFeedback} style={{ display: 'inline-block', transformOrigin: 'left center' }}>Auto size</motion.span>
                <motion.span animate={autoSizeFeedback} style={{ display: 'inline-flex', transformOrigin: 'right center' }}>
                  <Switch checked={getStickerTextAutoSize(text)} onCheckedChange={(enabled) => setText({ stickerAutoSize: enabled })} ariaLabel="Auto size" />
                </motion.span>
              </div>
            </section>

            <section className={`${styles.section} ${styles.styleSection}`} aria-label="Text style">
              <h3>Style</h3>
              <Tabs variant="segment" multipleValues={styleValues} onMultipleValueChange={(values) => setText({
                fontWeight: values.includes('bold') ? (fontWeight >= 700 ? fontWeight : 700) : (fontWeight >= 700 ? 400 : fontWeight),
                fontStyle: values.includes('italic') ? 'italic' : 'normal',
                underline: values.includes('underline'),
                linethrough: values.includes('strikethrough'),
              })}>
                <TabsList label="Text style" className={styles.tabList} wrapperClassName={styles.tabWrapper}>
                  <TabsTrigger value="bold" ariaLabel="Bold" disabled={!fontWeights.includes(700)} className={styles.tabTrigger} indicatorClassName={styles.tabIndicator}><strong>B</strong></TabsTrigger>
                  <TabsTrigger value="italic" ariaLabel="Italic" className={styles.tabTrigger} indicatorClassName={styles.tabIndicator}><em>I</em></TabsTrigger>
                  <TabsTrigger value="underline" ariaLabel="Underline" className={styles.tabTrigger} indicatorClassName={styles.tabIndicator}><u>U</u></TabsTrigger>
                  <TabsTrigger value="strikethrough" ariaLabel="Strikethrough" className={styles.tabTrigger} indicatorClassName={styles.tabIndicator}><s>S</s></TabsTrigger>
                </TabsList>
              </Tabs>
            </section>

            <section className={styles.section} aria-label="Text color">
              <h3>Color</h3>
              <div className={styles.colorControl} ref={colorControlRef}>
                <ColorSelector value={customOpen ? 'custom' : chosenColor} onValueChange={(value) => {
                  if (value === 'custom') {
                    setText({ fill: customDisplayColor })
                    openCustomColor()
                  } else {
                    setCustomOpen(false)
                    setText({ fill: value })
                  }
                }}>
                  <ColorSelectorList>
                    {editorPalette.map(({ label, color }) => <ColorSelectorItem key={color} value={color} color={color} label={label} />)}
                    <ColorSelectorItem value="custom" color={customDisplayColor} label="Custom color" swatchBackground="conic-gradient(var(--palette-error-red), var(--palette-editor-orange), var(--palette-editor-yellow), var(--palette-editor-green), var(--palette-editor-blue), var(--palette-editor-purple), var(--palette-error-red))" onClick={toggleCustomColor} />
                  </ColorSelectorList>
                </ColorSelector>
                {customOpen && (
                  <FloatingPopover anchorRef={colorControlRef} className={styles.colorPopover} label="Custom text color" onClose={() => setCustomOpen(false)}>
                    <HexColorPicker color={customDisplayColor} onChange={changeCustomColor} />
                    <label className={styles.hexField}>
                      <span>Hex</span>
                      <input aria-label="Custom color hex value" value={colorInput} onChange={(event) => {
                        const next = event.target.value
                        setColorInput(next)
                        if (/^#[\da-f]{6}$/i.test(next)) changeCustomColor(next)
                      }} onBlur={() => setColorInput(customDisplayColor)} />
                    </label>
                  </FloatingPopover>
                )}
              </div>
            </section>

            <section className={styles.section} aria-label="Text alignment">
              <h3>Alignment</h3>
              <div className={styles.alignmentControls}>
                <Tabs variant="segment" value={text.textAlign} motionTransition={ALIGNMENT_SPRING} onValueChange={(alignment) => setText({ textAlign: alignment })}>
                  <TabsList label="Horizontal text alignment" className={styles.tabList} wrapperClassName={styles.tabWrapper}>
                    {alignments.map(({ value, label }) => (
                      <TabsTrigger key={value} value={value} ariaLabel={label} className={`${styles.tabTrigger} ${styles.alignmentTabTrigger}`} indicatorClassName={styles.tabIndicator}>
                        <AlignmentGlyph alignment={value} />
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <Tabs variant="segment" value={verticalAlignment} motionTransition={ALIGNMENT_SPRING} onValueChange={(alignment) => {
                  if (alignment === 'top' || alignment === 'middle' || alignment === 'bottom') setText({ stickerVerticalAlign: alignment })
                }}>
                  <TabsList label="Vertical text alignment" className={`${styles.tabList} ${styles.verticalTabList}`} wrapperClassName={styles.tabWrapper}>
                    {verticalAlignments.map(({ value, label }) => (
                      <TabsTrigger key={value} value={value} ariaLabel={label} className={`${styles.tabTrigger} ${styles.alignmentTabTrigger}`} indicatorClassName={styles.tabIndicator}>
                        <VerticalAlignmentGlyph alignment={value} />
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </section>
            <StrokeSection canvas={canvas} object={text} />
          </div>
        ) : image ? (
          <div className={styles.content}>
            <section className={styles.section} aria-label="Image settings">
              <h3>Image</h3>
              <div className={styles.imagePreview}><img src={image.getSrc()} alt="Selected sticker" /></div>
              <p className={styles.dimensions}>{Math.round(image.getScaledWidth())} × {Math.round(image.getScaledHeight())} px</p>
            </section>
            <section className={styles.section} aria-label="Image opacity">
              <div className={styles.sectionHeading}><h3>Opacity</h3><output>{Math.round(image.opacity * 100)}%</output></div>
              <BubbleSlider className={styles.opacitySlider} showBubble={false} min={0} max={100} step={1} value={Math.round(image.opacity * 100)} aria-label="Image opacity" formatValueText={(value) => `${value}%`} onValueChange={(value) => updateStickerImageOpacity(canvas, image, value / 100)} />
            </section>
            <StrokeSection canvas={canvas} object={image} />
          </div>
        ) : (
          <div className={styles.content}>
            <CanvasColorSection canvas={canvas} />
          </div>
        )}
      </div>
    </motion.aside>
  )
}
