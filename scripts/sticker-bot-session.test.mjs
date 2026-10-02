import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MessengerEvents, getOwnedPackLinks, startNewPack } from './add-sticker.mjs';

const eventURL = 'https://u.myteam.vmailru.net/api/v149/bos/test/aim/fetchEvents?aimsid=test-session';
const menu = {
  msgId: 'original-menu',
  inlineKeyboardMarkup: [[{ callbackData: 'packlist' }, { callbackData: 'addpack' }, { callbackData: 'changepack' }]]
};

function eventResponse(messages, version) {
  return Response.json({ response: { statusCode: 200, data: {
    fetchBaseURL: eventURL,
    events: [{ type: 'histDlgState', eventData: { sn: '100500', patchVersion: version, messages } }]
  } } });
}

test('pack listing and creation reuse one started menu until a new session is created', async t => {
  const commands = [];
  const callbacks = [];
  const pending = [];
  let version = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/fetchEvents')) {
      assert.ok(pending.length);
      return pending.shift();
    }
    const { params } = JSON.parse(options.body);
    if (path.endsWith('/message/send')) {
      commands.push(params.parts.mainPart.text.plain);
      pending.push(eventResponse([menu], String(++version)));
      return Response.json({ status: { code: 20000 }, results: { state: 'sent' } });
    }
    assert.ok(path.endsWith('/getBotCallbackAnswer'));
    callbacks.push(params);
    pending.push(eventResponse([{ text: params.callbackData === 'packlist'
      ? 'Your sticker packs: 0'
      : 'Send me a picture to add it to the new sticker pack' }], String(++version)));
    return Response.json({ status: { code: 20080 }, results: {} });
  });
  const events = new MessengerEvents(eventURL, 'test-session');
  assert.deepEqual(await getOwnedPackLinks(events, 'test-session', 'test@example.com'), []);
  assert.deepEqual(await getOwnedPackLinks(events, 'test-session', 'test@example.com'), []);
  await startNewPack(events, 'test-session', 'test@example.com');
  assert.deepEqual(commands, ['/start']);
  assert.deepEqual(callbacks.map(item => item.msgId), ['original-menu', 'original-menu', 'original-menu']);
  assert.equal((await events.menu('test@example.com')).patchVersion, '4');
  const nextSession = new MessengerEvents(eventURL, 'test-session');
  await Promise.all([nextSession.menu('test@example.com'), nextSession.menu('test@example.com')]);
  assert.deepEqual(commands, ['/start', '/start']);
});

test('failed bot initialization can be retried without caching a successful state', async t => {
  let attempts = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (new URL(url).pathname.endsWith('/fetchEvents')) return eventResponse([menu], '1');
    attempts++;
    if (attempts === 1) throw new Error('Test network failure');
    return Response.json({ status: { code: 20000 }, results: { state: 'sent' } });
  });
  const events = new MessengerEvents(eventURL, 'test-session');
  await assert.rejects(events.menu('test@example.com'));
  assert.equal((await events.menu('test@example.com')).message.msgId, 'original-menu');
  await events.menu('test@example.com');
  assert.equal(attempts, 2);
});
