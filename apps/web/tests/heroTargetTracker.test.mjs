import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHeroTargetTracker } from '../src/shared/ui/HeroArtworkTransition/heroTargetTracker.ts'

test('a late return callback cannot redirect a reopened sticker to its card', () => {
  const tracker = createHeroTargetTracker()
  const card = { left: 32, top: 264 }
  const canvas = { left: 438, top: 158 }
  tracker.begin('photo', 'close')
  tracker.landAt('photo', 'close', card)
  tracker.begin('photo', 'open')
  tracker.landAt('photo', 'open', canvas)
  assert.equal(tracker.landAt('photo', 'close', card), false)
  assert.equal(tracker.read('photo', 'open'), canvas)
})

test('callbacks for a previous sticker cannot replace the active destination', () => {
  const tracker = createHeroTargetTracker()
  const destination = {}
  tracker.begin('first', 'open')
  tracker.begin('second', 'open')
  tracker.landAt('second', 'open', destination)
  assert.equal(tracker.landAt('first', 'open', {}), false)
  assert.equal(tracker.read('second', 'open'), destination)
  assert.equal(tracker.read('first', 'open'), null)
})

test('a new flight clears the prior destination before React commits', () => {
  const tracker = createHeroTargetTracker()
  tracker.begin('photo', 'open')
  tracker.landAt('photo', 'open', {})
  tracker.begin('photo', 'close')
  assert.equal(tracker.read('photo', 'close'), null)
  assert.equal(tracker.landAt('photo', 'close', 'card'), true)
  assert.equal(tracker.read('photo', 'close'), 'card')
})
