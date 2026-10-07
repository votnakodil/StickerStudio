import assert from 'node:assert/strict'
import { test } from 'node:test'
import { config, getEnv, setEnv, Textbox } from 'fabric'
import { getEnv as getNodeEnv } from 'fabric/node'
import { createStickerCanvas } from '../src/canvas/createCanvas.ts'
import { createStickerTextReveal } from '../src/text/textReveal.ts'

setEnv(getNodeEnv())

for (const retina of [1, 2]) {
  test(`text flight texture matches the live canvas pixels at retina scale ${retina}`, async () => {
    const previousRatio = config.devicePixelRatio
    const previousDocument = globalThis.document
    config.devicePixelRatio = retina
    globalThis.document = getEnv().document
    const canvas = createStickerCanvas(getEnv().document.createElement('canvas'))
    try {
      canvas.setDimensions({ width: 560, height: 560 })
      canvas.setZoom(560 / 1024)
      canvas.add(new Textbox('NASTYA', { left: 45, top: 10, width: 930, fontSize: 165,
        fontFamily: 'Arial', fontWeight: 900, textAlign: 'center', fill: '#17181c',
        stroke: '#ffffff', strokeWidth: 7, paintFirst: 'stroke' }))
      canvas.add(new Textbox('TEXT', { left: 45, top: 860, width: 930, fontSize: 100,
        fontFamily: 'Arial', textAlign: 'center', fill: '#17181c', stroke: '#ffffff', strokeWidth: 7, paintFirst: 'stroke' }))
      canvas.renderAll()
      const preview = createStickerTextReveal(canvas)
      const texts = canvas.getObjects().filter(object => object instanceof Textbox)
      const titlePreview = createStickerTextReveal(canvas, [texts[0]])
      const detailsPreview = createStickerTextReveal(canvas, [texts[1]])
      const separated = getEnv().document.createElement('canvas')
      separated.width = preview.width
      separated.height = preview.height
      separated.getContext('2d').drawImage(titlePreview, 0, 0)
      separated.getContext('2d').drawImage(detailsPreview, 0, 0)
      const combined = separated.getContext('2d').getImageData(0, 0, preview.width, preview.height).data
      const original = preview.getContext('2d').getImageData(0, 0, preview.width, preview.height).data
      let splitDifferences = 0
      for (let i = 0; i < combined.length; i++) if (combined[i] !== original[i]) splitDifferences++
      assert.equal(splitDifferences, 0, 'separate moving title and fixed captions preserve final pixels')
      const live = canvas.lowerCanvasEl
      assert.equal(preview.width, live.width)
      assert.equal(preview.height, live.height)
      const actual = preview.getContext('2d').getImageData(0, 0, preview.width, preview.height).data
      const expected = live.getContext('2d').getImageData(0, 0, live.width, live.height).data
      let differences = 0
      for (let i = 0; i < actual.length; i++) if (actual[i] !== expected[i]) differences++
      assert.equal(differences, 0, 'the handoff must not change text pixels')
    } finally {
      await canvas.dispose()
      config.devicePixelRatio = previousRatio
      globalThis.document = previousDocument
    }
  })
}
