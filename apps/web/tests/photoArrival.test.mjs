import assert from 'node:assert/strict'
import { test } from 'node:test'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { usePhotoArrival } from '../src/features/custom-photo/model/usePhotoArrival.ts'

async function withArrival(decode, run) {
  const dom = new JSDOM('<div id="root"></div>')
  const previous = { window: globalThis.window, document: globalThis.document, Image: globalThis.Image,
    act: globalThis.IS_REACT_ACT_ENVIRONMENT, create: URL.createObjectURL, revoke: URL.revokeObjectURL }
  const urls = new Set()
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.Image = class { naturalWidth = 512; naturalHeight = 256; decode = decode }
  URL.createObjectURL = () => { const src = `blob:test-${urls.size}`; urls.add(src); return src }
  URL.revokeObjectURL = src => urls.delete(src)
  let arrival
  const launches = []
  function Harness() { arrival = usePhotoArrival((...args) => launches.push(args)); return null }
  const root = createRoot(dom.window.document.getElementById('root'))
  try {
    await act(() => root.render(createElement(Harness)))
    await run({ current: () => arrival, launches, urls, unmount: () => act(() => root.unmount()) })
  } finally {
    await act(() => root.unmount())
    globalThis.window = previous.window
    globalThis.document = previous.document
    globalThis.Image = previous.Image
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous.act
    URL.createObjectURL = previous.create
    URL.revokeObjectURL = previous.revoke
    dom.window.close()
  }
}

test('photo arrival decodes first, launches once and releases the preview on handoff for a reused library page', async () => {
  await withArrival(() => Promise.resolve(), async ({ current, launches, urls }) => {
    await act(() => current().prepareArrival('custom-first', new Blob(['photo'])))
    assert.equal(current().preview.phase, 'drop')
    await act(() => { current().advance(); current().advance() })
    assert.equal(current().preview.phase, 'compress')
    await act(() => { current().advance(); current().advance() })
    assert.equal(current().preview.phase, 'fill')
    await act(() => { current().advance(); current().advance() })
    assert.equal(launches.length, 1)
    assert.equal(current().preview, null)
    assert.equal(urls.size, 0)
    await act(() => current().prepareArrival('custom-second', new Blob(['photo'])))
    await act(() => { current().completeArrival(); current().completeArrival() })
    assert.equal(launches.length, 2, 'the same upload card can accept another photo after Back')
    assert.equal(urls.size, 0)
  })
})

test('leaving during photo decode releases its URL and never launches a stale preview', async () => {
  let finishDecode
  await withArrival(() => new Promise(resolve => { finishDecode = resolve }), async ({ current, launches, urls, unmount }) => {
    const pending = current().prepareArrival('custom-aborted', new Blob(['photo']))
    assert.equal(current().preview, null)
    assert.equal(urls.size, 1)
    await unmount()
    finishDecode()
    await pending
    assert.equal(urls.size, 0)
    assert.equal(launches.length, 0)
  })
})

test('a photo decode failure releases its URL and starts no animation', async () => {
  await withArrival(() => Promise.reject(new Error('Cannot decode')), async ({ current, urls, launches }) => {
    await assert.rejects(current().prepareArrival('custom-invalid', new Blob(['invalid'])), /Cannot decode/)
    assert.equal(urls.size, 0)
    assert.equal(current().preview, null)
    assert.equal(launches.length, 0)
  })
})
