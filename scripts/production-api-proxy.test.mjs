import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isAllowedLocalApiRequest, productionOriginFor } from './production-api-proxy.mjs'

const local = 'https://localhost:5173'
const request = (method, origin, host = 'localhost:5173') => ({ method, headers: { host, ...(origin ? { origin } : {}) } })

test('local API proxy accepts browser requests from its exact HTTPS origin', () => {
  assert.equal(isAllowedLocalApiRequest(request('POST', local), local), true)
  assert.equal(isAllowedLocalApiRequest(request('DELETE', local), local), true)
  assert.equal(isAllowedLocalApiRequest(request('GET'), local), true)
  assert.equal(productionOriginFor(request('POST', local)), 'https://stickerstudio.igorcodes.de')
})

test('local API proxy rejects cross-origin writes before rewriting Origin', () => {
  for (const origin of [undefined, 'http://localhost:5173', 'https://localhost:5174', 'https://evil.example']) {
    assert.equal(isAllowedLocalApiRequest(request('POST', origin), local), false)
  }
  assert.equal(isAllowedLocalApiRequest(request('DELETE', local, 'evil.example'), local), false)
  assert.equal(isAllowedLocalApiRequest(request('GET', 'https://evil.example'), local), false)
})

test('HTTP/2 authority is accepted when Host is absent', () => {
  const req = { method: 'POST', headers: { ':authority': 'localhost:5173', origin: local } }
  assert.equal(isAllowedLocalApiRequest(req, local), true)
})
