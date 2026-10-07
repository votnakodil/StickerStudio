import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MessengerEvents, getOwnedPackLinks, startNewPack, choosePack } from './add-sticker.mjs';

const eventURL = 'https://u.myteam.vmailru.net/api/v149/bos/test/aim/fetchEvents?aimsid=test-session';
const menu = {
  msgId: '90071992547409931',
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
  assert.deepEqual(callbacks.map(item => item.msgId), ['90071992547409931', '90071992547409931', '90071992547409931']);
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
  assert.equal((await events.menu('test@example.com')).message.msgId, '90071992547409931');
  await events.menu('test@example.com');
  assert.equal(attempts, 2);
});

for (const updatedMenuInHistory of [false, true]) {
  test(`pack selection waits for Add rather than an unrelated event (history=${updatedMenuInHistory})`, async t => {
    const pending = [];
    const callbacks = [];
    const commands = [];
    const add = { msgId: '90071992547409931', inlineKeyboardMarkup: [[{ text: 'Add a sticker', callbackData: 'add' }]] };
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/fetchEvents')) {
        assert.ok(pending.length, 'must not poll after the expected response');
        return pending.shift();
      }
      const { params } = JSON.parse(options.body);
      if (path.endsWith('/message/send')) {
        const text = params.parts.mainPart.text.plain;
        commands.push(text);
        pending.push(eventResponse(text === '/start' ? [menu] : [{ text: 'Send me a picture to add it to this sticker pack' }], text === '/start' ? '1' : '5'));
        return Response.json({ status: { code: 20000 }, results: {} });
      }
      if (path.endsWith('/getHistory')) {
        return Response.json({ status: { code: 20000 }, results: { messages: updatedMenuInHistory && params.fromMsgId === '90071992547409930' ? [add] : [] } });
      }
      assert.ok(path.endsWith('/getBotCallbackAnswer'));
      callbacks.push(params);
      if (params.callbackData === 'changepack') {
        const unrelated = eventResponse([{ text: 'Your sticker packs: 0' }], '2');
        const body = await unrelated.json();
        body.response.data.events[0].eventData.lastMsgId = 'newer-pack-list';
        pending.push(Response.json(body));
        if (!updatedMenuInHistory) pending.push(eventResponse([add], '3'));
      } else {
        assert.equal(params.callbackData, 'add');
        assert.equal(params.msgId, '90071992547409931');
        pending.push(eventResponse([{ text: 'Send me a sticker from your own sticker pack' }], '4'));
      }
      return Response.json({ status: { code: 20080 }, results: {} });
    });
    await choosePack(new MessengerEvents(eventURL, 'test-session'), 'test-session', 'test@example.com', 'https://files.myteam.mail.ru/get/test-reference');
    assert.deepEqual(callbacks.map(item => item.callbackData), ['changepack', 'add']);
    assert.deepEqual(commands, ['/start', 'https://files.myteam.mail.ru/get/test-reference']);
  });
}
