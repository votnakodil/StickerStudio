import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pairTitleGlyphs } from '../src/shared/ui/HeroArtworkTransition/titleGlyphPairs.ts'

const glyphs = text => [...text].map((text, index) => ({ text, bounds: { left: index * 10, top: 0, width: 10, height: 20 }, baseline: 15 }))

test('a longer canvas title retains all characters until they fade out', () => {
  const source = glyphs('TITLE'), target = glyphs('Name')
  const pairs = pairTitleGlyphs(source, target)
  assert.equal(pairs.map(pair => pair.sourceGlyph.text).join(''), 'TITLE')
  assert.equal(pairs.map(pair => pair.targetGlyph.text).join(''), 'Name')
  assert.deepEqual(pairs[4].targetGlyph.bounds, source[4].bounds)
})
test('a longer card label introduces no extra characters into the source title', () => {
  const pairs = pairTitleGlyphs(glyphs('TOP'), glyphs('Label'))
  assert.equal(pairs.map(pair => pair.sourceGlyph.text).join(''), 'TOP')
  assert.equal(pairs.map(pair => pair.targetGlyph.text).join(''), 'Label')
  assert.equal(pairs[3].sourceGlyph.text, '')
})
test('titles absent on both sides produce no glyphs', () => {
  assert.deepEqual(pairTitleGlyphs(), [])
})
