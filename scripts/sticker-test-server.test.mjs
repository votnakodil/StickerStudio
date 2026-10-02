import assert from 'node:assert/strict';
import { test } from 'node:test';
import { failureKind, startServer } from './sticker-test-server.mjs';

test('a possible bot send always remains an unknown result', () => {
  assert.equal(failureKind(new Error('Network timeout'), true), 'unknown');
  assert.equal(failureKind(new Error('HTTP 401'), true), 'unknown');
});

test('authentication errors stay distinct from ordinary failures', () => {
  assert.equal(failureKind(new Error('Список паков: HTTP 401.')), 'auth_required');
  assert.equal(failureKind(new Error('Network timeout')), 'retryable');
});

test('session route exposes only a structured authentication state before login', async () => {
  const server = await startServer(0);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/session`);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      kind: 'auth_required', error: 'Сначала войдите в VK Teams.'
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('authorization completes without fetching packs and returns no credentials or session token', async () => {
  let calls = 0;
  const server = await startServer(0, {
    authenticate: async ({ email, password }) => {
      calls++;
      assert.equal(email, 'preview@example.com');
      assert.equal(password, 'preview-only');
      return { email, session: { aimsid: 'private-session-token' } };
    }
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const invalid = await fetch(`${origin}/api/authorize`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'preview@example.com', password: '' })
    });
    assert.equal(invalid.status, 400);
    assert.equal(calls, 0);
    const response = await fetch(`${origin}/api/authorize`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ' preview@example.com ', password: 'preview-only' })
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { authenticated: true, email: 'preview@example.com' });
    assert.equal(calls, 1);
    const session = await fetch(`${origin}/api/session`);
    assert.equal(session.status, 200);
    assert.deepEqual(await session.json(), { packs: [], canUpload: false });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});


test('preparing a pack clicks the bot once and sends no image before Upload', async t => {
  const realFetch = globalThis.fetch;
  const external = [];
  const events = [];
  const fetchBaseURL = 'https://u.myteam.vmailru.net/api/v149/bos/test/aim/fetchEvents?aimsid=test-session';
  const server = await startServer(0, {
    authenticate: async () => ({ email: 'test@example.com', session: { aimsid: 'test-session', fetchBaseURL } })
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const parsed = new URL(url);
    if (parsed.origin === origin) return realFetch(url, options);
    external.push(parsed.pathname);
    if (parsed.pathname.endsWith('/store/my')) {
      return Response.json({ result: { sticker_packs: [] } });
    }
    if (parsed.pathname.endsWith('/fetchEvents')) {
      assert.ok(events.length);
      return Response.json({ response: { statusCode: 200, data: { fetchBaseURL, events: [events.shift()] } } });
    }
    if (parsed.pathname.endsWith('/message/send')) {
      const { params } = JSON.parse(options.body);
      assert.equal(params.parts.mainPart.text.plain, '/start');
      events.push({ type: 'histDlgState', eventData: { sn: '100500', patchVersion: '1', messages: [{
        msgId: 'menu', inlineKeyboardMarkup: [[{ callbackData: 'packlist' }, { callbackData: 'addpack' }, { callbackData: 'changepack' }]]
      }] } });
      return Response.json({ status: { code: 20000 }, results: {} });
    }
    if (parsed.pathname.endsWith('/getBotCallbackAnswer')) {
      assert.equal(JSON.parse(options.body).params.callbackData, 'addpack');
      events.push({ type: 'histDlgState', eventData: { sn: '100500', patchVersion: '2', messages: [{ text: 'Send me a picture to add it to the new sticker pack' }] } });
      return Response.json({ status: { code: 20080 }, results: {} });
    }
    assert.equal(parsed.pathname, '/api/v92/store/openstore/filespackinfowithmeta');
    return new Response(null, { status: 404 });
  });
  try {
    await fetch(`${origin}/api/authorize`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@example.com', password: 'test-only' }) });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`${origin}/api/prepare-pack`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'New Pack' }) });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ready: true, name: 'New Pack', slug: 'new_pack' });
    }
    assert.equal(external.filter(path => path.endsWith('/message/send')).length, 1);
    assert.equal(external.filter(path => path.endsWith('/getBotCallbackAnswer')).length, 1);
    assert.ok(external.every(path => !/upload/i.test(path)));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
