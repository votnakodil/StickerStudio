import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createProductionAuthService, AuthRequestError } from '../src/features/auth/api/productionAuthService.ts'

function harness(responses) {
  const requests = []
  const service = createProductionAuthService(async (url, init) => {
    requests.push({ url, init })
    return responses.shift()
  })
  return { service, requests }
}

test('OTP requests use same-origin cookies and never put the code in a URL', async () => {
  const { service, requests } = harness([
    Response.json({ expiresInSeconds: 600, resendInSeconds: 120 }),
    new Response(null, { status: 204 }),
    Response.json({ email: 'person@free-lines.ru' }),
  ])
  assert.deepEqual(await service.sendOtp('person@free-lines.ru'), { expiresIn: 600, resendIn: 120 })
  assert.equal(await service.verifyOtp('person@free-lines.ru', '123456'), true)
  assert.equal(await service.getSession(), true)
  assert.deepEqual(requests.map(({ url, init }) => [url, init.method, init.credentials, init.cache]), [
    ['/api/auth/start', 'POST', 'same-origin', 'no-store'],
    ['/api/auth/verify', 'POST', 'same-origin', 'no-store'],
    ['/api/auth/me', 'GET', 'same-origin', 'no-store'],
  ])
  assert.deepEqual(JSON.parse(requests[1].init.body), { email: 'person@free-lines.ru', code: '123456' })
  assert.equal(requests[1].url.includes('123456'), false)
})

test('anonymous session is expected and verification failures have useful categories', async () => {
  const { service } = harness([
    Response.json({ detail: 'Authentication required.' }, { status: 401 }),
    Response.json({ detail: 'Incorrect code.' }, { status: 400 }),
    Response.json({ detail: 'Code expired.' }, { status: 410 }),
  ])
  assert.equal(await service.getSession(), false)
  assert.equal(await service.verifyOtp('person@free-lines.ru', '000000'), false)
  await assert.rejects(service.verifyOtp('person@free-lines.ru', '000000'), (error) => error instanceof AuthRequestError && error.kind === 'expired')
})

test('logout endpoints clear only through server requests', async () => {
  const { service, requests } = harness([new Response(null, { status: 204 }), new Response(null, { status: 204 })])
  await service.logout()
  await service.logoutAll()
  assert.deepEqual(requests.map(({ url, init }) => [url, init.method, init.credentials]), [
    ['/api/auth/logout', 'POST', 'same-origin'],
    ['/api/auth/logout-all', 'POST', 'same-origin'],
  ])
})

test('network failures do not masquerade as invalid OTP codes', async () => {
  const service = createProductionAuthService(async () => { throw new TypeError('offline') })
  await assert.rejects(service.verifyOtp('person@free-lines.ru', '123456'), (error) => error instanceof AuthRequestError && error.kind === 'network')
})


test('expired code is not reported as an incorrect code when the API uses HTTP 400', async () => {
  const { service } = harness([Response.json({ detail: 'Code expired.' }, { status: 400 })])
  await assert.rejects(service.verifyOtp('person@free-lines.ru', '000000'),
    (error) => error instanceof AuthRequestError && error.kind === 'expired')
})
