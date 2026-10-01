import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  authenticateMessenger,
  requestMyPacks,
  packStickerCount,
  confirmPackGrowth,
  MessengerEvents,
  choosePack,
  getOwnedPackLinks,
  startNewPack,
  requestPackName,
  requestPackLink,
  initFileUpload,
  uploadSticker,
  sendBotText,
  confirmStickerAdded,
  stickerReference
} from './add-sticker.mjs';

const htmlPath = fileURLToPath(new URL('./sticker-test.html', import.meta.url));
const maxImageBytes = 20 * 1024 * 1024;
const stickerURLPattern = /^https:\/\/files\.myteam\.mail\.ru\/get\/[A-Za-z0-9]+$/;
const cyrillic = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};
let session = null;
let busy = false;
const ownedPacksByEmail = new Map();

function sendJson(response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(data));
}

async function readBody(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('Файл или запрос слишком большой.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function findStickerURL(value, depth = 0) {
  if (depth > 5) return null;
  if (typeof value === 'string') {
    return stickerURLPattern.test(value) ? value : null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const child of Object.values(value)) {
    const found = findStickerURL(child, depth + 1);
    if (found) return found;
  }
  return null;
}

function stickerReferenceFromPack(pack) {
  if (!Array.isArray(pack.stickers)) return null;
  const url = findStickerURL(pack.stickers);
  if (url) return url;
  for (const sticker of pack.stickers) {
    const ids = typeof sticker === 'string'
      ? [sticker]
      : sticker && typeof sticker === 'object'
        ? [sticker.stickerId, sticker.fileid, sticker.id]
        : [];
    const id = ids.find(value =>
      typeof value === 'string' && /^[A-Za-z0-9]{24,64}$/.test(value)
    );
    if (id) return `https://files.myteam.mail.ru/get/${id}`;
  }
  return null;
}

function extractPacks(payload) {
  // Подтверждённый формат из проверки store/my: result.sticker_packs.
  const packs = payload?.result?.sticker_packs;
  if (!Array.isArray(packs)) return [];
  return packs.filter(pack =>
    (typeof pack?.id === 'number' || typeof pack?.id === 'string') &&
    typeof pack?.title === 'string' && pack.title.trim()
  ).map(pack => ({
    id: String(pack.id),
    name: pack.title.trim(),
    stickerCount: Array.isArray(pack.stickers) ? pack.stickers.length : null,
    referenceURL: stickerReferenceFromPack(pack)
  }));
}

function packView(pack) {
  return {
    id: pack.id,
    slug: pack.slug,
    name: pack.name,
    stickerCount: pack.stickerCount,
    needsStickerURL: !pack.referenceURL && pack.id !== '1678156',
    installed: pack.installed
  };
}

function cachedOwnedPacks(value) {
  return Array.isArray(value) && value.length <= 1000 &&
    value.every(pack => pack && typeof pack.id === 'string' &&
      /^\d+$/.test(pack.id) && typeof pack.slug === 'string' &&
      /^[A-Za-z0-9_]+$/.test(pack.slug))
    ? value
    : null;
}

function mergeOwnedPacks(owned, installed) {
  const installedById = new Map(installed.map(pack => [pack.id, pack]));
  return owned.map(pack => {
    const local = installedById.get(pack.id);
    return {
      ...pack,
      referenceURL: local?.referenceURL ?? pack.referenceURL,
      installed: Boolean(local)
    };
  });
}

function safeFilename(raw) {
  let filename;
  try {
    filename = decodeURIComponent(raw ?? '');
  } catch {
    throw new Error('Некорректное имя файла.');
  }
  if (!filename || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Некорректное имя файла.');
  }
  if (/^[\x20-\x7E]+$/.test(filename) && !/["\\]/.test(filename)) {
    return filename;
  }
  const extension = filename.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] ?? '';
  return `sticker-${Date.now()}${extension}`;
}

function packNameAndSlug(raw) {
  const name = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  if (!name || name.length > 64 || !/^[A-Za-zА-Яа-яЁё0-9 _-]+$/u.test(name)) {
    throw new Error('Введите название до 64 символов: буквы, цифры, пробел, дефис или _.');
  }
  const slug = Array.from(name.toLowerCase(), character =>
    cyrillic[character] ?? character
  ).join('').replace(/[ _-]+/g, '_').replace(/^_+|_+$/g, '');
  if (!slug || slug.length > 64 || !/^[a-z0-9_]+$/.test(slug)) {
    throw new Error('Не удалось получить допустимый адрес из названия.');
  }
  return { name, slug };
}

async function lookupPackSlug(slug) {
  const url = new URL('https://u.icq.net/api/v92/store/openstore/filespackinfowithmeta');
  url.search = new URLSearchParams({
    store_id: slug, lang: 'en', client: 'myteam', platform: 'web', size: 'large'
  }).toString();
  let response;
  try {
    response = await fetch(url, {
      method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(10000)
    });
  } catch {
    throw new Error('Не удалось проверить адрес пака. Повторите позже.');
  }
  if (response.status === 404) {
    await response.body?.cancel();
    return null;
  }
  if (response.status !== 200) {
    await response.body?.cancel();
    throw new Error('Не удалось проверить адрес пака. Повторите позже.');
  }
  const payload = await response.json().catch(() => null);
  if (payload?.status !== 200 ||
      !Number.isSafeInteger(payload?.data?.id) ||
      payload?.data?.store_id?.toLowerCase() !== slug) {
    throw new Error('Ответ проверки адреса пака не распознан.');
  }
  return String(payload.data.id);
}

async function waitForPack(predicate, attempts = 10) {
  for (let i = 0; i < attempts; i++) {
    const result = await requestMyPacks(session.session.aimsid);
    const found = predicate(extractPacks(result.payload));
    if (found) return found;
    if (i + 1 < attempts) await new Promise(done => setTimeout(done, 1200));
  }
  return null;
}

function selectedReference(pack, suppliedURL) {
  if (pack.referenceURL) return stickerReference(pack.referenceURL);
  if (pack.id === '1678156') return stickerReference('1678156');
  if (suppliedURL) return stickerReference(suppliedURL);
  throw new Error('Для этого пака нужна ссылка на один уже существующий в нём стикер.');
}

async function resolveOwnedPackIds(links) {
  const results = await Promise.all(links.map(async link => {
    const slug = new URL(link).pathname.slice(3);
    const url = new URL(
      'https://u.icq.net/api/v92/store/openstore/filespackinfowithmeta'
    );
    url.search = new URLSearchParams({
      store_id: slug,
      lang: 'en',
      client: 'myteam',
      platform: 'web',
      size: 'large'
    }).toString();
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(10000)
      });
      if (response.status !== 200) {
        await response.body?.cancel();
        return null;
      }
      const payload = await response.json();
      const data = payload?.data;
      const id = data?.id;
      if (!(payload?.status === 200 &&
        Number.isSafeInteger(id) && id > 0 &&
        data?.store_id === slug)) return null;
      const fileId = Array.isArray(data.content)
        ? data.content.find(item =>
          typeof item?.fileId === 'string' &&
          /^[A-Za-z0-9]{24,64}$/.test(item.fileId)
        )?.fileId
        : null;
      return {
        id: String(id),
        slug,
        name: typeof data.name === 'string' && data.name.trim()
          ? data.name.trim() : slug,
        stickerCount: Number.isSafeInteger(data.count) && data.count >= 0
          ? data.count : Array.isArray(data.content) ? data.content.length : null,
        referenceURL: fileId
          ? `https://files.myteam.mail.ru/get/${fileId}` : null
      };
    } catch {
      return null;
    }
  }));
  return {
    ids: new Set(results.filter(Boolean).map(pack => pack.id)),
    packs: results.filter(Boolean),
    unavailableCount: results.filter(pack => pack === null).length
  };
}

async function confirmPublicPackGrowth(pack, previousCount) {
  if (!pack.slug || !Number.isInteger(previousCount)) return null;
  for (let i = 0; i < 8; i++) {
    if (i) await new Promise(done => setTimeout(done, 1500));
    const result = await resolveOwnedPackIds([
      `https://myteam.mail.ru/s/${pack.slug}`
    ]);
    const latest = result.packs.find(item => item.id === pack.id);
    if (latest && Number.isInteger(latest.stickerCount) &&
        latest.stickerCount > previousCount) return latest.stickerCount;
  }
  return null;
}

async function startServer(port = 4177) {
  const page = await readFile(htmlPath);
  const server = http.createServer(async (request, response) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    if (request.headers.host !== `127.0.0.1:${server.address().port}`) {
      sendJson(response, 403, { error: 'Неверный адрес запроса.' });
      return;
    }
    const pathname = new URL(request.url, origin).pathname;

    if (request.method === 'GET' && pathname === '/') {
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy':
          "default-src 'none'; script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline'; connect-src 'self'; " +
          "img-src 'self' data:; form-action 'self'; base-uri 'none'"
      });
      response.end(page);
      return;
    }
    if (request.method !== 'POST' ||
        !['/api/login', '/api/upload', '/api/check-name', '/api/create-pack', '/api/refresh-packs'].includes(pathname)) {
      sendJson(response, 404, { error: 'Страница не найдена.' });
      return;
    }
    if (request.headers.origin !== origin) {
      sendJson(response, 403, { error: 'Запрос разрешён только с локальной страницы.' });
      return;
    }
    if (busy) {
      sendJson(response, 409, { error: 'Предыдущая операция ещё выполняется.' });
      return;
    }

    busy = true;
    try {
      if (pathname === '/api/login') {
        if (request.headers['content-type'] !== 'application/json') {
          sendJson(response, 415, { error: 'Ожидается JSON.' });
          return;
        }
        const body = JSON.parse((await readBody(request, 32 * 1024)).toString('utf8'));
        const email = body?.email;
        const password = body?.password;
        if (typeof email !== 'string' || !email.trim() ||
            typeof password !== 'string' || !password) {
          sendJson(response, 400, { error: 'Введите email и пароль VK Teams.' });
          return;
        }
        session = null;
        const auth = await authenticateMessenger({ email: email.trim(), password });
        const result = await requestMyPacks(auth.session.aimsid);
        const allPacks = extractPacks(result.payload);
        let events = null;
        if (auth.session.fetchBaseURL) {
          try {
            events = new MessengerEvents(auth.session.fetchBaseURL, auth.session.aimsid);
          } catch {
            // Без событий бота авторство паков нельзя подтвердить.
          }
        }
        if (!events) {
          throw new Error('Messenger не вернул адрес событий; список авторских паков недоступен.');
        }
        const accountKey = auth.email.toLowerCase();
        const cached = cachedOwnedPacks(body?.ownedPacks) ??
          ownedPacksByEmail.get(accountKey) ?? null;
        let links;
        let note;
        if (cached) {
          links = cached.map(pack => `https://myteam.mail.ru/s/${pack.slug}`);
          note = 'Список авторских паков взят из локального сохранения без сообщений боту.';
        } else {
          links = await getOwnedPackLinks(events, auth.session.aimsid, auth.email);
        }
        const resolved = await resolveOwnedPackIds(links);
        if (links.length && resolved.unavailableCount === links.length) {
          throw new Error('Не удалось получить данные авторских паков по ссылкам Stickers Bot.');
        }
        if (!cached) {
          note = `В списке бота: ${links.length}; ссылки без доступных данных: ${resolved.unavailableCount}.`;
        }
        const packs = mergeOwnedPacks(resolved.packs, allPacks);
        ownedPacksByEmail.set(
          accountKey, packs.map(pack => ({ id: pack.id, slug: pack.slug }))
        );
        session = {
          ...auth,
          packs,
          events
        };
        sendJson(response, 200, {
          packs: packs.map(packView),
          canUpload: Boolean(session.events),
          note: `Авторских паков: ${packs.length}; добавлено в VK Teams: ` +
            `${packs.filter(pack => pack.installed).length}. ${note}`
        });
        return;
      }

      if (!session) {
        sendJson(response, 401, { error: 'Сначала войдите в VK Teams.' });
        return;
      }
      if (!session.events) {
        sendJson(response, 409, { error: 'Messenger не вернул адрес событий для Stickers Bot.' });
        return;
      }
      if (pathname === '/api/refresh-packs') {
        const latest = await requestMyPacks(session.session.aimsid);
        const allPacks = extractPacks(latest.payload);
        const links = await getOwnedPackLinks(
          session.events, session.session.aimsid, session.email
        );
        const { packs, unavailableCount } = await resolveOwnedPackIds(links);
        if (links.length && unavailableCount === links.length) {
          throw new Error('Не удалось получить ID авторских паков по ссылкам Stickers Bot.');
        }
        session.packs = mergeOwnedPacks(packs, allPacks);
        ownedPacksByEmail.set(
          session.email.toLowerCase(),
          session.packs.map(pack => ({ id: pack.id, slug: pack.slug }))
        );
        sendJson(response, 200, {
          packs: session.packs.map(packView),
          note: `Авторских паков: ${session.packs.length}; добавлено в VK Teams: ` +
            `${session.packs.filter(pack => pack.installed).length}. ` +
            `В списке бота: ${links.length}; ссылки без доступных данных: ${unavailableCount}.`
        });
        return;
      }
      if (pathname === '/api/check-name') {
        if (request.headers['content-type'] !== 'application/json') {
          sendJson(response, 415, { error: 'Ожидается JSON.' });
          return;
        }
        const body = JSON.parse((await readBody(request, 4096)).toString('utf8'));
        const { name, slug } = packNameAndSlug(body?.name);
        sendJson(response, 200, {
          name, slug, available: (await lookupPackSlug(slug)) === null
        });
        return;
      }
      if (pathname === '/api/create-pack') {
        let rawName;
        try {
          rawName = decodeURIComponent(request.headers['x-pack-name'] ?? '');
        } catch {
          throw new Error('Некорректное название пака.');
        }
        const { name, slug } = packNameAndSlug(rawName);
        if (await lookupPackSlug(slug)) {
          sendJson(response, 409, {
            error: `Адрес ${slug} уже занят. Введите другое название для стикерпака.`
          });
          return;
        }
        if (request.headers['content-type'] !== 'application/octet-stream') {
          sendJson(response, 415, { error: 'Ожидается файл изображения.' });
          return;
        }
        const filename = safeFilename(request.headers['x-file-name']);
        const bytes = await readBody(request, maxImageBytes);
        if (!bytes.length) throw new Error('Выберите непустой файл.');
        const baseline = await requestMyPacks(session.session.aimsid);
        const baselineIds = new Set(extractPacks(baseline.payload).map(pack => pack.id));
        let imageSent = false;
        try {
          await startNewPack(session.events, session.session.aimsid, session.email);
          const uploadURL = await initFileUpload(session.session.aimsid, filename, bytes.length);
          const staticURL = await uploadSticker(uploadURL, filename, bytes);
          await sendBotText(staticURL, session.session.aimsid, session.email);
          imageSent = true;
          const newPack = await waitForPack(packs => {
            const added = packs.filter(pack => !baselineIds.has(pack.id));
            return added.length === 1 && added[0].referenceURL ? added[0] : null;
          });
          if (!newPack) {
            throw new Error('Новый пак пока не появился в списке с первым стикером.');
          }
          await requestPackName(
            session.events, session.session.aimsid, session.email,
            newPack.referenceURL, name
          );
          const named = await waitForPack(packs =>
            packs.find(pack => pack.id === newPack.id && pack.name === name)
          );
          if (!named) throw new Error('Название пака не подтверждено.');
          await requestPackLink(
            session.events, session.session.aimsid, session.email,
            newPack.referenceURL, slug
          );
          let confirmed = false;
          for (let i = 0; i < 10; i++) {
            const linkedId = await lookupPackSlug(slug);
            if (linkedId === newPack.id) {
              confirmed = true;
              break;
            }
            if (linkedId && linkedId !== newPack.id) {
              throw new Error(`Адрес ${slug} уже занят другим паком. Введите другое название.`);
            }
            if (i < 9) await new Promise(done => setTimeout(done, 1200));
          }
          if (!confirmed) throw new Error('Адрес нового пака не подтверждён.');
          named.slug = slug;
          named.installed = true;
          session.packs.push(named);
          ownedPacksByEmail.set(
            session.email.toLowerCase(),
            session.packs.map(pack => ({ id: pack.id, slug: pack.slug }))
          );
          sendJson(response, 200, {
            pack: packView(named),
            url: `https://myteam.mail.ru/s/${slug}`
          });
        } catch (error) {
          throw new Error(imageSent
            ? `${error.message} Картинка уже отправлена боту: проверьте новый пак перед повторным созданием.`
            : error.message);
        }
        return;
      }
      if (request.headers['content-type'] !== 'application/octet-stream') {
        sendJson(response, 415, { error: 'Ожидается файл изображения.' });
        return;
      }
      const pack = session.packs.find(item => item.id === request.headers['x-pack-id']);
      if (!pack) {
        sendJson(response, 400, { error: 'Выберите пак из списка.' });
        return;
      }
      const referenceURL = selectedReference(pack, request.headers['x-sticker-reference']);
      const filename = safeFilename(request.headers['x-file-name']);
      const bytes = await readBody(request, maxImageBytes);
      if (!bytes.length) throw new Error('Выберите непустой файл.');

      await choosePack(session.events, session.session.aimsid, session.email, referenceURL);
      const uploadURL = await initFileUpload(session.session.aimsid, filename, bytes.length);
      const staticURL = await uploadSticker(uploadURL, filename, bytes);

      let previousCount = pack.stickerCount;
      try {
        const latest = await requestMyPacks(session.session.aimsid);
        previousCount = packStickerCount(latest.payload, pack.id) ?? previousCount;
      } catch {
        // Сохранённое при входе число позволит проверить добавление.
      }
      await sendBotText(staticURL, session.session.aimsid, session.email);

      const stickerCount = pack.installed
        ? await confirmPackGrowth(session.session.aimsid, pack.id, previousCount)
        : await confirmPublicPackGrowth(pack, previousCount);
      let confirmed = stickerCount !== null;
      if (!confirmed) {
        try {
          confirmed = await confirmStickerAdded(session.events);
        } catch {
          // Повторная отправка может добавить дубликат.
        }
      }
      if (stickerCount !== null) pack.stickerCount = stickerCount;
      sendJson(response, 200, { confirmed, stickerCount });
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof SyntaxError ? 'Некорректный JSON.' : error.message
      });
    } finally {
      busy = false;
    }
  });

  await new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', done);
  });
  console.log(`Тестовая страница: http://127.0.0.1:${server.address().port}/`);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startServer().catch(error => {
    console.error(`Не удалось запустить локальную страницу: ${error.message}`);
    process.exitCode = 1;
  });
}

export {
  extractPacks, mergeOwnedPacks, packNameAndSlug, lookupPackSlug,
  resolveOwnedPackIds, startServer
};
