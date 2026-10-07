import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasUsableHeroBounds } from '../src/shared/ui/HeroArtworkTransition/heroBounds.ts'

test('transitions reject empty or non-finite layout measurements', () => {
  const visible = { left: -20, top: 100, width: 240, height: 240 }
  assert.equal(hasUsableHeroBounds(visible), true)
  for (const invalid of [{ width: 0 }, { height: 0 }, { width: -1 }, { left: NaN }, { top: Infinity }, { height: NaN }]) {
    assert.equal(hasUsableHeroBounds({ ...visible, ...invalid }), false)
  }
})
