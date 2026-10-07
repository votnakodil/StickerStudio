import assert from 'node:assert/strict'
import { test } from 'node:test'
import { glowCoverage } from '../src/shared/ui/GlowExpansion/glowCoverage.ts'

test('expanding cloud has soft edges and transparent margins without canvas filter support', () => {
  const coverage = x => glowCoverage(x, 128, 256, 256)
  assert.ok(coverage(64) > 0.4, 'the original glow is visible at the card border')
  assert.ok(coverage(48) > 0.03, 'color spreads beyond the border into a cloud')
  assert.ok(coverage(80) > 0.03, 'color also spreads inside the border')
  assert.equal(coverage(0), 0)
  assert.equal(coverage(256), 0)
  assert.ok(coverage(128) < 0.001, 'the center stays clear')
  for (let x = 1; x <= 255; x++) {
    assert.ok(Math.abs(coverage(x) - coverage(x - 1)) < 0.04, 'no hard color boundary')
  }
})

test('expanding cloud softly fills the interior while the original hover glow stays clear', () => {
  assert.ok(glowCoverage(128, 128, 256, 256, 0.16) >= 0.15)
  assert.ok(glowCoverage(128, 128, 256, 256) < 0.001)
  assert.equal(glowCoverage(0, 128, 256, 256, 0.16), 0)
  for (let x = 1; x <= 255; x++) {
    assert.ok(Math.abs(glowCoverage(x, 128, 256, 256, 0.16) - glowCoverage(x - 1, 128, 256, 256, 0.16)) < 0.04)
  }
})
