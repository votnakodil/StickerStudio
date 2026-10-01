import readline from 'node:readline/promises';
import { randomBytes, randomInt } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

class CookieJar {
  constructor() {
    this.cookies = [];
  }

  setCookie(header, requestUrl) {
    const url = new URL(requestUrl);
    const [first, ...attributes] = header.split(';').map(part => part.trim());
    const separator = first.indexOf('=');
    if (separator < 1) return false;

    const cookie = {
      name: first.slice(0, separator),
      value: first.slice(separator + 1),
      domain: url.hostname,
      hostOnly: true,
      path: '/',
      secure: false,
      expires: null
    };

    for (const attribute of attributes) {
      const index = attribute.indexOf('=');
      const key = (index < 0 ? attribute : attribute.slice(0, index)).toLowerCase();
      const value = index < 0 ? '' : attribute.slice(index + 1);

      if (key === 'domain' && value) {
        const domain = value.replace(/^\./, '').toLowerCase();
        if (url.hostname !== domain && !url.hostname.endsWith(`.${domain}`)) {
          return false;
        }
        cookie.domain = domain;
        cookie.hostOnly = false;
      }
      if (key === 'path' && value.startsWith('/')) cookie.path = value;
      if (key === 'secure') cookie.secure = true;
      if (key === 'expires' && value) {
        const time = Date.parse(value);
        if (!Number.isNaN(time)) cookie.expires = time;
      }
      if (key === 'max-age' && value) {
        const seconds = Number(value);
        if (Number.isFinite(seconds)) cookie.expires = Date.now() + seconds * 1000;
      }
    }

    this.cookies = this.cookies.filter(existing => !(
      existing.name === cookie.name &&
      existing.domain === cookie.domain &&
      existing.path === cookie.path
    ));

    if (cookie.expires !== null && cookie.expires <= Date.now()) return false;
    this.cookies.push(cookie);
    return true;
  }

  getCookieString(requestUrl) {
    const url = new URL(requestUrl);
    const now = Date.now();

    this.cookies = this.cookies.filter(cookie =>
      cookie.expires === null || cookie.expires > now
    );

    return this.cookies.filter(cookie => {
      if (cookie.secure && url.protocol !== 'https:') return false;
      if (cookie.hostOnly && url.hostname !== cookie.domain) return false;
      if (
        !cookie.hostOnly &&
        url.hostname !== cookie.domain &&
        !url.hostname.endsWith(`.${cookie.domain}`)
      ) return false;
      if (!url.pathname.startsWith(cookie.path)) return false;
      return true;
    }).map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  }

}

let jar = new CookieJar();
const workspace = 'https://app.workspace.vk.ru';
const allowedHosts = new Set([
  'app.workspace.vk.ru',
  'o2.mail.ru',
  'account.mail.ru',
  'auth.mail.ru'
]);
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
let requestNumber = 0;

function safeUrl(url) {
  const { origin, pathname } = new URL(url);
  return origin + pathname;
}

async function get(initialUrl, initialReferer) {
  let url = new URL(initialUrl);
  let referer = initialReferer;

  for (let hop = 0; hop <= 15; hop++) {
    if (
      url.protocol !== 'https:' ||
      !allowedHosts.has(url.hostname) ||
      url.port ||
      url.username ||
      url.password
    ) {
      throw new Error('Перенаправление за пределы разрешённых HTTPS-адресов.');
    }

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/140.0.0.0 Safari/537.36',
      Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8'
    };

    const cookie = jar.getCookieString(url.href);
    if (cookie) headers.Cookie = cookie;
    if (referer) headers.Referer = referer;

    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(20000)
      });
    } catch (error) {
      const code = error.cause?.code ?? error.name;
      throw new Error(`Сетевая ошибка (${code}) на ${safeUrl(url)}.`);
    }

    const setCookies = response.headers.getSetCookie();
    for (const value of setCookies) {
      try {
        jar.setCookie(value, url.href);
      } catch {
        // Некорректный Set-Cookie не скрывает результат HTTP-запроса.
      }
    }

    console.log(`[${++requestNumber}] GET ${safeUrl(url)} → ${response.status}`);

    if (redirectStatuses.has(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('HTTP redirect без Location.');
      referer = initialReferer ?? url.origin + '/';
      url = new URL(location, url);
      continue;
    }

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} на ${safeUrl(url)}.`);
    }
    if (
      /<title>\s*Site Unavailable\s*<\/title>/i.test(text) &&
      /Unable to access this site/i.test(text)
    ) {
      throw new Error(
        `Сайт ${url.hostname} недоступен из этой среды: ` +
        'вместо ответа пришла страница «Site Unavailable».'
      );
    }
    return { url, text, status: response.status };
  }

  throw new Error('Больше 15 перенаправлений.');
}

function extractCsrf(html) {
  const values = new Set();
  const variants = [
    html,
    html.replace(/&quot;/g, '"').replace(/&#34;/g, '"'),
    html.replace(/\\"/g, '"')
  ];

  for (const source of variants) {
    const pattern =
      /(?:["']csrf["']|\bcsrf)\s*:\s*("(?:\\.|[^"\\])*"|'[^'\r\n]+')/g;

    for (const match of source.matchAll(pattern)) {
      let value;
      try {
        value = match[1].startsWith('"')
          ? JSON.parse(match[1])
          : match[1].slice(1, -1);
      } catch {
        continue;
      }
      if (typeof value === 'string' && value.length > 0) {
        values.add(value);
      }
    }
  }

  if (values.size > 1) {
    throw new Error('В HTML несколько разных csrf: нужно уточнить структуру страницы.');
  }
  return [...values][0];
}

async function promptEmail() {
  if (!process.stdin.isTTY) {
    throw new Error('Запусти скрипт в интерактивном терминале.');
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const email = (await rl.question('Workspace email: ')).trim();
    if (!email || !email.includes('@')) {
      throw new Error('Введи email аккаунта Workspace.');
    }
    return email;
  } finally {
    rl.close();
  }
}

function promptPassword() {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdin.setRawMode) {
      reject(new Error(
        'Скрытый ввод пароля доступен только в интерактивном терминале.'
      ));
      return;
    }

    const previousRawMode = Boolean(process.stdin.isRaw);
    const characters = [];
    process.stdout.write('Workspace password (ввод скрыт): ');

    const finish = error => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(previousRawMode);
      process.stdin.pause();
      process.stdout.write('\n');

      if (error) reject(error);
      else resolve(characters.join(''));
    };

    const onData = buffer => {
      for (const character of buffer.toString('utf8')) {
        if (character === '\r' || character === '\n') {
          finish(characters.length ? null : new Error('Пароль не введён.'));
          return;
        }
        if (character === '\u0003') {
          finish(new Error('Ввод отменён.'));
          return;
        }
        if (character === '\u007f' || character === '\b') {
          characters.pop();
        } else if (character >= ' ' && character !== '\u007f') {
          characters.push(character);
        }
      }
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function postPassword(email, password, actToken, o2Url) {
  const url = new URL('https://auth.mail.ru/cgi-bin/auth');
  url.search = new URLSearchParams({
    platform: 'touch',
    project: 'login',
    reset_soft_vkid_bind: '1'
  }).toString();

  const body = new URLSearchParams({
    Password: password,
    new_auth_form: '1',
    FromAccount:
      'opener%3Do2%26twoSteps%3D1%26remind_target%3D_self%26source%3Dws-superapp',
    act_token: actToken,
    page: o2Url,
    lang: 'ru_RU',
    username: email,
    Login: email,
    saveauth: '1'
  });

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/140.0.0.0 Safari/537.36',
    'Content-Type': 'application/x-www-form-urlencoded',
    Origin: 'https://account.mail.ru',
    Referer: 'https://account.mail.ru/'
  };

  const cookie = jar.getCookieString(url.href);
  if (cookie) headers.Cookie = cookie;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    throw new Error(
      `Сетевая ошибка (${error.cause?.code ?? error.name}) на ${safeUrl(url)}.`
    );
  }

  const setCookies = response.headers.getSetCookie();
  for (const value of setCookies) {
    try {
      jar.setCookie(value, url.href);
    } catch {
      // Пропускаем некорректный cookie.
    }
  }

  const location = response.headers.get('location');
  await response.body?.cancel();

  return {
    status: response.status,
    location
  };
}

async function postO2Login(email, o2Csrf, pageUrl) {
  const url = new URL('https://o2.mail.ru/login');
  const failUrl = new URL(pageUrl);
  failUrl.searchParams.set('fail', '1');

  const body = new URLSearchParams({
    o2csrf: o2Csrf,
    Page: encodeURIComponent(pageUrl),
    FailPage: encodeURIComponent(failUrl.href),
    browser_data: encodeURIComponent('{}'),
    mode: '',
    login: email
  });

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/140.0.0.0 Safari/537.36',
    'Content-Type': 'application/x-www-form-urlencoded',
    Origin: 'https://o2.mail.ru',
    Referer: pageUrl
  };

  const cookie = jar.getCookieString(url.href);
  if (cookie) headers.Cookie = cookie;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    throw new Error(
      `Сетевая ошибка (${error.cause?.code ?? error.name}) на ${safeUrl(url)}.`
    );
  }

  for (const value of response.headers.getSetCookie()) {
    try {
      jar.setCookie(value, url.href);
    } catch {
      // Пропускаем некорректный cookie.
    }
  }

  const location = response.headers.get('location');
  await response.body?.cancel();
  return { status: response.status, location };
}

async function requestSilentToken(targetID) {
  const url = new URL(workspace + '/api/v1/silent_token');
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/140.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json; charset=UTF-8',
    Origin: workspace,
    Referer: workspace + '/home'
  };

  const cookie = jar.getCookieString(url.href);
  if (cookie) headers.Cookie = cookie;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clientID: '9oxgKFbOIviE1bXPWf1YfbgkAxNLRopf',
        targetID,
        grantType: 'ws_app_silent_token'
      }),
      redirect: 'manual',
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    throw new Error(
      `Сетевая ошибка (${error.cause?.code ?? error.name}) на ${safeUrl(url)}.`
    );
  }

  const status = response.status;
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`silent_token вернул не JSON; HTTP ${status}.`);
  }

  return {
    status,
    token: typeof data.silent_token === 'string' ? data.silent_token : ''
  };
}

async function requestMessengerSession(silentToken, email) {
  const url =
    'https://u.myteam.vmailru.net/api/v149/messenger/auth/withSession';

  const caps = {
    assertCaps:
      '094613584C7F11D18222444553540000,' +
      '0946135C4C7F11D18222444553540000,' +
      '0946135b4c7f11d18222444553540000,' +
      '0946135E4C7F11D18222444553540000,' +
      'AABC2A1AF270424598B36993C6231952,' +
      '1f99494e76cbc880215d6aeab8e42268,' +
      'A20C362CD4944B6EA3D1E77642201FD8,' +
      'B5ED3E51C7AC4137B5926BC686E7A60D,' +
      '094613504c7f11d18222444553540000,' +
      '094613514c7f11d18222444553540000,' +
      '094613564c7f11d18222444553540000,' +
      '094613503c7f11d18222444553540000',
    interestCaps:
      '8eec67ce70d041009409a7c1602a5c84,' +
      '094613504c7f11d18222444553540000,' +
      '094613514c7f11d18222444553540000,' +
      '094613564c7f11d18222444553540000',
    subscriptions: 'status,ownReactions',
    events:
      'myInfo,presence,buddylist,typing,hiddenChat,hist,mchat,sentIM,' +
      'imState,dataIM,offlineIM,userAddedToBuddyList,service,lifestream,' +
      'apps,permitDeny,diff,webrtcMsg',
    includePresenceFields:
      'aimId,displayId,friendly,friendlyName,state,userType,statusMsg,' +
      'statusTime,ssl,mute,counterEnabled,abContactName,abPhoneNumber,' +
      'abPhones,official,quiet,autoAddition,largeIconId,nick,userState'
  };

  const hex = randomBytes(16).toString('hex');
  const deviceId =
    `${hex.slice(0, 6)}-${hex.slice(6, 10)}-${hex.slice(10, 14)}-` +
    `${hex.slice(14, 18)}-${hex.slice(18)}`;

  const body = {
    silent_token: silentToken,
    context: {
      ts: Math.floor(Date.now() / 1000),
      trigger: 'omicronConfigChanged',
      k: randomBytes(12).toString('base64url'),
      view: 'online',
      clientName: 'webVKTeams',
      language: 'en-US',
      deviceId,
      sessionTimeout: 2592000,
      ...caps,
      userSn: email
    }
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/154.0.0.0 Safari/537.36',
        Accept: '*/*',
        'Content-Type': 'application/json',
        Origin: 'https://myteam.mail.ru',
        Referer: 'https://myteam.mail.ru/'
      },
      body: JSON.stringify(body),
      redirect: 'manual',
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    throw new Error(
      `Сетевая ошибка (${error.cause?.code ?? error.name}) на ${safeUrl(url)}.`
    );
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      `Messenger auth/withSession вернул не JSON; HTTP ${response.status}.`
    );
  }

  const payload = result?.start_session_response?.response;
  return {
    status: response.status,
    statusCode: payload?.statusCode,
    aimsid:
      typeof payload?.data?.aimsid === 'string'
        ? payload.data.aimsid
        : '',
    hasAccessToken:
      typeof result.access_token === 'string' &&
      result.access_token.length > 0,
    fetchBaseURL:
      typeof payload?.data?.fetchBaseURL === 'string'
        ? payload.data.fetchBaseURL
        : ''
  };
}

const botChatId = '100500';
const messengerOrigin = 'https://u.myteam.vmailru.net';
const messengerUserAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/154.0.0.0 Safari/537.36';
const knownPackStickerURL = 'https://files.myteam.mail.ru/get/2b88c0006DeKNLTtvoKCiQ6abccb1d1ai';

function stickerReference(pack) {
  if (pack === 'СанеCHECK' || pack === '1678156') {
    return knownPackStickerURL;
  }
  const url = new URL(pack);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'files.myteam.mail.ru' ||
    url.port || url.username || url.password ||
    !/^\/get\/[A-Za-z0-9]+$/.test(url.pathname) ||
    url.search || url.hash
  ) {
    throw new Error(
      'Для другого пака передай URL существующего стикера из него ' +
      '(https://files.myteam.mail.ru/get/...).'
    );
  }
  return url.href;
}

async function parseCli() {
  const [fileArgument, pack, ...extra] = process.argv.slice(2);
  const usage =
    'Запуск: node scripts/add-sticker.mjs <путь-к-файлу> <пак>';

  if (fileArgument === '--help' || fileArgument === '-h') {
    console.log(usage);
    console.log(
      'Пак: СанеCHECK, 1678156 или URL существующего стикера из другого пака.'
    );
    return null;
  }
  if (!fileArgument || !pack?.trim() || extra.length) {
    throw new Error(usage);
  }

  const filePath = resolve(fileArgument);
  let file;
  try {
    file = await stat(filePath);
  } catch {
    throw new Error('Указанный файл недоступен.');
  }
  if (!file.isFile() || file.size === 0) {
    throw new Error('Укажи непустой обычный файл.');
  }
  const filename = basename(filePath);
  if (!/^[\x20-\x7E]+$/.test(filename) || /["\\]/.test(filename)) {
    throw new Error('Имя файла должно содержать только обычные ASCII-символы без кавычек.');
  }
  let referenceURL;
  try {
    referenceURL = stickerReference(pack.trim());
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        'Пак не подтверждён HAR: укажи СанеCHECK, 1678156 ' +
        'или URL существующего стикера из нужного пака.'
      );
    }
    throw error;
  }
  return {
    filePath,
    filename,
    size: file.size,
    referenceURL,
    packId: pack === 'СанеCHECK' || pack === '1678156' ? '1678156' : null
  };
}

async function requestMyPacks(aimsid) {
  const url = new URL('https://u.myteam.vmailru.net/api/v149/store/store/my');
  url.searchParams.set('aimsid', aimsid);

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    throw new Error(
      `Сетевая ошибка (${error.cause?.code ?? error.name}) при получении паков.`
    );
  }

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Список паков: HTTP ${response.status}.`);
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Список паков: ответ не JSON; HTTP ${response.status}.`);
  }
  return { status: response.status, payload };
}

function packStickerCount(payload, packId) {
  const packs = payload?.result?.sticker_packs;
  if (!Array.isArray(packs)) return null;
  const pack = packs.find(item => String(item?.id) === String(packId));
  return Array.isArray(pack?.stickers) ? pack.stickers.length : null;
}

async function confirmPackGrowth(aimsid, packId, previousCount) {
  if (!Number.isInteger(previousCount)) return null;
  for (let attempt = 0; attempt < 10; attempt++) {
    if (attempt) await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      const packs = await requestMyPacks(aimsid);
      const count = packStickerCount(packs.payload, packId);
      if (count !== null && count > previousCount) return count;
    } catch {
      // После отправки файла продолжаем проверку, не повторяя добавление.
    }
  }
  return null;
}

function nextRequestId() {
  return `${randomInt(100000)}-${Math.floor(Date.now() / 1000)}`;
}

async function rapiRequest(method, aimsid, params, expectedCode, senderEmail) {
  const url = `${messengerOrigin}/api/v149/rapi/${method}`;
  const headers = {
    'User-Agent': messengerUserAgent,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Origin: 'https://myteam.mail.ru',
    Referer: 'https://myteam.mail.ru/'
  };
  if (senderEmail) headers['X-Req-Sender-Sn'] = senderEmail;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reqId: nextRequestId(), aimsid, params }),
      redirect: 'manual',
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    throw new Error(`Сетевая ошибка (${error.cause?.code ?? error.name}) при ${method}.`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`${method}: ответ не JSON; HTTP ${response.status}.`);
  }
  if (response.status !== 200 || data?.status?.code !== expectedCode) {
    throw new Error(`${method}: HTTP ${response.status}, код ${data?.status?.code ?? 'нет'}.`);
  }
  return data.results;
}

function sendBotText(text, aimsid, email) {
  return rapiRequest('message/send', aimsid, {
    target: botChatId,
    parts: { mainPart: { text: { plain: text } } }
  }, 20000, email);
}

function botButton(message, callbackData) {
  return Array.isArray(message?.inlineKeyboardMarkup) &&
    message.inlineKeyboardMarkup.some(row =>
    Array.isArray(row) && row.some(button => button?.callbackData === callbackData)
  );
}

function eventURL(raw, aimsid) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Messenger не вернул адрес получения событий.');
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'u.myteam.vmailru.net' ||
    url.port || url.username || url.password ||
    !/^\/api\/v149\/bos\/[^/]+\/aim\/fetchEvents$/.test(url.pathname) ||
    url.searchParams.get('aimsid') !== aimsid
  ) {
    throw new Error('Messenger вернул неожиданный адрес получения событий.');
  }
  return url;
}

class MessengerEvents {
  constructor(fetchBaseURL, aimsid) {
    this.aimsid = aimsid;
    this.url = eventURL(fetchBaseURL, aimsid);
  }

  async next() {
    const requestURL = new URL(this.url);
    requestURL.searchParams.set('timeout', '30000');

    let response;
    try {
      response = await fetch(requestURL, {
        method: 'GET',
        headers: {
          'User-Agent': messengerUserAgent,
          Accept: 'application/json',
          Origin: 'https://myteam.mail.ru',
          Referer: 'https://myteam.mail.ru/'
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(40000)
      });
    } catch (error) {
      throw new Error(`Сетевая ошибка (${error.cause?.code ?? error.name}) при ожидании бота.`);
    }

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(`Messenger events: ответ не JSON; HTTP ${response.status}.`);
    }
    const payload = result?.response;
    if (response.status !== 200 || payload?.statusCode !== 200) {
      throw new Error(`Messenger events: HTTP ${response.status}, код ${payload?.statusCode ?? 'нет'}.`);
    }
    this.url = eventURL(payload?.data?.fetchBaseURL, this.aimsid);
    return Array.isArray(payload?.data?.events) ? payload.data.events : [];
  }

  async waitForBot(predicate, description, polls = 6) {
    for (let attempt = 0; attempt < polls; attempt++) {
      const events = await this.next();
      for (const event of events) {
        if (event?.type !== 'histDlgState' || event?.eventData?.sn !== botChatId) {
          continue;
        }
        const found = predicate(event.eventData);
        if (found) return found;
      }
    }
    throw new Error(`Не получено сообщение Stickers Bot: ${description}.`);
  }
}

async function getBotHistory(aimsid, patchVersion, fromMsgId = '-1', count = -1) {
  const results = await rapiRequest('getHistory', aimsid, {
    sn: botChatId,
    fromMsgId,
    count,
    lang: 'en',
    mentions: { resolve: false },
    patchVersion
  }, 20000);
  return Array.isArray(results?.messages) ? results.messages : [];
}

class NotAuthorError extends Error {
  constructor() {
    super('Stickers Bot сообщил, что вы не автор стикера из выбранного пака.');
    this.name = 'NotAuthorError';
  }
}

function parseOwnedPackLinks(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const heading = /^Your sticker packs: (\d+)$/.exec(lines[0] ?? '');
  if (!heading) throw new Error('Stickers Bot не вернул список авторских паков.');
  const links = lines.slice(1);
  if (links.length !== Number(heading[1])) {
    throw new Error('Количество ссылок в ответе Stickers Bot не совпадает с заголовком.');
  }
  return links.map(link => {
    let url;
    try {
      url = new URL(link);
    } catch {
      throw new Error('Stickers Bot вернул некорректную ссылку на пак.');
    }
    if (url.protocol !== 'https:' || url.hostname !== 'myteam.mail.ru' ||
        url.port || url.username || url.password || url.search || url.hash ||
        !/^\/s\/[A-Za-z0-9_]+$/.test(url.pathname)) {
      throw new Error('Stickers Bot вернул неожиданную ссылку на пак.');
    }
    return url.href;
  });
}

async function getOwnedPackLinks(events, aimsid, email) {
  await sendBotText('/help', aimsid, email);
  const menu = await events.waitForBot(
    state => state.messages?.find(message => botButton(message, 'packlist')),
    'меню со списком своих паков'
  );
  await rapiRequest('getBotCallbackAnswer', aimsid, {
    chatId: botChatId,
    msgId: String(menu.msgId),
    callbackData: 'packlist'
  }, 20080);
  const response = await events.waitForBot(
    state => state.messages?.find(message =>
      typeof message.text === 'string' &&
      message.text.startsWith('Your sticker packs:')
    ),
    'список своих паков'
  );
  return parseOwnedPackLinks(response.text);
}

async function startNewPack(events, aimsid, email) {
  await sendBotText('/help', aimsid, email);
  const menu = await events.waitForBot(
    state => state.messages?.find(message => botButton(message, 'addpack')),
    'меню создания пака'
  );
  await rapiRequest('getBotCallbackAnswer', aimsid, {
    chatId: botChatId,
    msgId: String(menu.msgId),
    callbackData: 'addpack'
  }, 20080);
  await events.waitForBot(
    state => state.messages?.find(message =>
      typeof message.text === 'string' &&
      message.text.startsWith('Send me a picture to add it to the new sticker pack')
    ),
    'запрос картинки для нового пака'
  );
}

async function startPackEditAction(events, aimsid, email, callbackData, prompt) {
  if (!['packname', 'packlink'].includes(callbackData)) {
    throw new Error('Неизвестное действие Stickers Bot.');
  }
  await sendBotText('/help', aimsid, email);
  const menuState = await events.waitForBot(
    state => {
      const message = state.messages?.find(item => botButton(item, 'changepack'));
      return message && typeof state.patchVersion === 'string'
        ? { message, patchVersion: state.patchVersion }
        : null;
    },
    'меню редактирования пака'
  );
  await rapiRequest('getBotCallbackAnswer', aimsid, {
    chatId: botChatId,
    msgId: String(menuState.message.msgId),
    callbackData: 'changepack'
  }, 20080);

  const editState = await events.waitForBot(
    state => typeof state.patchVersion === 'string' &&
      state.patchVersion !== menuState.patchVersion &&
      typeof state.lastMsgId === 'string' && state,
    'список действий с паком'
  );
  const history = await getBotHistory(aimsid, menuState.patchVersion);
  let action = editState.messages?.find(message => botButton(message, callbackData)) ||
    history.find(message => botButton(message, callbackData));
  if (!action) {
    const latest = await getBotHistory(
      aimsid, editState.patchVersion, editState.lastMsgId, 1
    );
    action = latest.find(message => botButton(message, callbackData));
  }
  if (!action?.msgId) {
    throw new Error(`Кнопка ${callbackData} не найдена в истории Stickers Bot.`);
  }
  await rapiRequest('getBotCallbackAnswer', aimsid, {
    chatId: botChatId,
    msgId: String(action.msgId),
    callbackData
  }, 20080);
  await events.waitForBot(
    state => state.messages?.find(message =>
      typeof message.text === 'string' && message.text.startsWith(prompt)
    ),
    `запрос бота: ${callbackData}`
  );
}

async function requestPackName(events, aimsid, email, referenceURL, name) {
  await startPackEditAction(
    events, aimsid, email, 'packname',
    'Send me a sticker from the sticker pack you want to name'
  );
  await sendBotText(referenceURL, aimsid, email);
  await events.waitForBot(
    state => state.messages?.find(message =>
      typeof message.text === 'string' &&
      message.text.startsWith('Send me the name for your sticker pack')
    ),
    'запрос названия пака'
  );
  await sendBotText(name, aimsid, email);
}

async function requestPackLink(events, aimsid, email, referenceURL, slug) {
  await startPackEditAction(
    events, aimsid, email, 'packlink',
    'Send me a sticker from the sticker pack you want to create a sanitized link for'
  );
  await sendBotText(referenceURL, aimsid, email);
  await events.waitForBot(
    state => state.messages?.find(message =>
      typeof message.text === 'string' && message.text.startsWith('Send me an address.')
    ),
    'запрос адреса пака'
  );
  await sendBotText(slug, aimsid, email);
}

async function choosePack(events, aimsid, email, referenceURL) {
  await sendBotText('/help', aimsid, email);
  const menuState = await events.waitForBot(
    state => {
      const message = state.messages?.find(item => botButton(item, 'changepack'));
      return message && typeof state.patchVersion === 'string'
        ? { message, patchVersion: state.patchVersion }
        : null;
    },
    'меню смены пака'
  );
  await rapiRequest('getBotCallbackAnswer', aimsid, {
    chatId: botChatId,
    msgId: String(menuState.message.msgId),
    callbackData: 'changepack'
  }, 20080);

  const editState = await events.waitForBot(
    state => typeof state.patchVersion === 'string' &&
      state.patchVersion !== menuState.patchVersion &&
      typeof state.lastMsgId === 'string' && state,
    'меню редактирования пака'
  );
  // В HAR браузер запрашивает новый ответ бота со старой patchVersion.
  // Новая patchVersion возвращает пустую дельту и скрывает кнопку Add.
  const history = await getBotHistory(aimsid, menuState.patchVersion);
  let addMessage = editState.messages?.find(message => botButton(message, 'add')) ||
    history.find(message => botButton(message, 'add'));
  if (!addMessage) {
    const latest = await getBotHistory(
      aimsid, editState.patchVersion, editState.lastMsgId, 1
    );
    addMessage = latest.find(message => botButton(message, 'add'));
  }
  if (!addMessage?.msgId) {
    throw new Error('Кнопка Add не найдена в актуальной истории Stickers Bot.');
  }
  await rapiRequest('getBotCallbackAnswer', aimsid, {
    chatId: botChatId,
    msgId: String(addMessage.msgId),
    callbackData: 'add'
  }, 20080);

  await events.waitForBot(
    state => state.messages?.find(message =>
      typeof message.text === 'string' &&
      message.text.startsWith('Send me a sticker from your own sticker pack')
    ),
    'запрос стикера из нужного пака'
  );
  await sendBotText(referenceURL, aimsid, email);
  const answer = await events.waitForBot(
    state => {
      for (const message of state.messages ?? []) {
        if (typeof message.text !== 'string') continue;
        if (message.text.includes('not the author of this sticker')) return 'not-author';
        if (message.text.startsWith('Send me a picture to add it to this sticker pack')) {
          return 'author';
        }
      }
      return null;
    },
    'подтверждение авторства пака'
  );
  if (answer === 'not-author') throw new NotAuthorError();
}

async function initFileUpload(aimsid, filename, size) {
  const url = new URL(`${messengerOrigin}/api/v149/files/init`);
  url.search = new URLSearchParams({
    aimsid,
    ts: String(Math.floor(Date.now() / 1000)),
    size: String(size),
    filename,
    client: 'VKTeams',
    target: botChatId
  }).toString();

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': messengerUserAgent,
        Accept: 'application/json',
        Origin: 'https://myteam.mail.ru',
        Referer: 'https://myteam.mail.ru/'
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    throw new Error(`Сетевая ошибка (${error.cause?.code ?? error.name}) при files/init.`);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`files/init: ответ не JSON; HTTP ${response.status}.`);
  }
  if (response.status !== 200 || data?.status?.code !== 200) {
    throw new Error(`files/init: HTTP ${response.status}, код ${data?.status?.code ?? 'нет'}.`);
  }
  const uploadPath = data?.result?.url;
  if (
    data?.result?.host !== 'ub.myteam.vmailru.net' ||
    typeof uploadPath !== 'string' ||
    !/^\/api\/v149\/files\/server\/[^/]+\/upload\/[A-Za-z0-9-]+\/$/.test(uploadPath)
  ) {
    throw new Error('files/init вернул неожиданный адрес загрузки.');
  }
  const uploadURL = new URL(uploadPath, 'https://ub.myteam.vmailru.net');
  uploadURL.searchParams.set('aimsid', aimsid);
  return uploadURL;
}

async function uploadSticker(uploadURL, filename, bytes) {
  let response;
  try {
    response = await fetch(uploadURL, {
      method: 'POST',
      headers: {
        'User-Agent': messengerUserAgent,
        Accept: 'application/json',
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Range': `bytes 0-${bytes.length - 1}/${bytes.length}`,
        'X-Requested-With': 'XMLHttpRequest',
        Origin: 'https://myteam.mail.ru',
        Referer: 'https://myteam.mail.ru/'
      },
      body: bytes,
      redirect: 'manual',
      signal: AbortSignal.timeout(60000)
    });
  } catch (error) {
    throw new Error(`Сетевая ошибка (${error.cause?.code ?? error.name}) при загрузке файла.`);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Загрузка файла: ответ не JSON; HTTP ${response.status}.`);
  }
  if (response.status !== 200 || data?.status?.code !== 200) {
    throw new Error(`Загрузка файла: HTTP ${response.status}, код ${data?.status?.code ?? 'нет'}.`);
  }
  const fileid = data?.result?.fileid;
  const staticURL = data?.result?.static_url;
  let parsed;
  try {
    parsed = new URL(staticURL);
  } catch {
    throw new Error('Загрузка файла не вернула корректный static_url.');
  }
  if (
    typeof fileid !== 'string' || !/^[A-Za-z0-9]+$/.test(fileid) ||
    parsed.protocol !== 'https:' ||
    parsed.hostname !== 'files.myteam.mail.ru' ||
    parsed.pathname !== `/get/${fileid}` ||
    parsed.search || parsed.hash || parsed.port || parsed.username || parsed.password
  ) {
    throw new Error('Загрузка файла вернула неожиданный fileid/static_url.');
  }
  return staticURL;
}

async function confirmStickerAdded(events) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const batch = await events.next();
    for (const event of batch) {
      if (event?.type !== 'histDlgState' || event?.eventData?.sn !== botChatId) {
        continue;
      }
      if (event.eventData.messages?.some(message =>
        message?.text?.includes('Sticker added')
      )) {
        return true;
      }
    }
  }
  return false;
}

async function authenticateMessenger(credentials) {
  jar = new CookieJar();
  requestNumber = 0;
  console.log('Подключение к Workspace…\n');

  await get(workspace + '/');
  const csrfResponse = await get(workspace + '/api/v1/csrf_token');

  let csrf;
  try {
    csrf = JSON.parse(csrfResponse.text).token;
  } catch {
    throw new Error('csrf_token вернул не JSON.');
  }
  if (typeof csrf !== 'string' || !csrf) {
    throw new Error('В ответе csrf_token нет непустого поля token.');
  }
  console.log('Workspace CSRF получен.');

  const state =
    'v2.' + Buffer.from(`${csrf}:/`, 'utf8').toString('base64url');

  const loginUrl = new URL('https://o2.mail.ru/xlogin');
  loginUrl.search = new URLSearchParams({
    client_id: '9oxgKFbOIviE1bXPWf1YfbgkAxNLRopf',
    redirect_uri: workspace + '/v2/login',
    response_type: 'code',
    prompt: 'select_account',
    force_us: '1',
    source: 'ws-superapp',
    state
  }).toString();

  let page = await get(loginUrl);

  if (
    page.url.hostname === 'o2.mail.ru' &&
    page.url.pathname === '/xlogin'
  ) {
    // После ответа 200 этот переход выполняет скрипт страницы O2.
    const accountUrl = new URL('https://account.mail.ru/login');
    accountUrl.search = new URLSearchParams({
      opener: 'o2',
      page: page.url.href,
      logo_target: '_blank',
      signup_target: '_self',
      remind_target: '_self',
      cancel_page: page.url.href,
      allow_login_ext: '1',
      source: 'ws-superapp'
    }).toString();

    page = await get(accountUrl, page.url.href);
  }

  if (
    page.url.hostname !== 'account.mail.ru' ||
    page.url.pathname !== '/login'
  ) {
    throw new Error(
      `Цепочка остановилась на ${safeUrl(page.url)}, ` +
      'а не account.mail.ru/login.'
    );
  }

  const actToken = extractCsrf(page.text);
  if (!actToken) {
    throw new Error('Страница входа получена, но csrf в HTML не найден.');
  }
  console.log('Параметры страницы входа получены.');

  const email = credentials ? credentials.email : await promptEmail();
  const password = credentials ? credentials.password : await promptPassword();
  if (typeof email !== 'string' || !email ||
      typeof password !== 'string' || !password) {
    throw new Error('Укажи email и пароль Workspace.');
  }

  console.log('Отправка запроса входа…');
  const result = await postPassword(
    email,
    password,
    actToken,
    loginUrl.href
  );

  console.log(`POST status: ${result.status}`);
  console.log(
    `Redirect: ${
      result.location
        ? safeUrl(new URL(result.location, 'https://auth.mail.ru'))
        : 'нет'
    }`
  );

  if (result.status !== 302 || !result.location) {
    throw new Error('Password POST не вернул ожидаемый 302 с Location.');
  }

  const finalPage = await get(
    new URL(result.location, 'https://auth.mail.ru'),
    'https://account.mail.ru/'
  );

  if (
    finalPage.url.hostname !== 'o2.mail.ru' ||
    finalPage.url.pathname !== '/xlogin'
  ) {
    throw new Error(
      `После SDC получена страница ${safeUrl(finalPage.url)} ` +
      'вместо o2.mail.ru/xlogin.'
    );
  }

  const loginCount =
    finalPage.text.match(/"loginsLength"\s*:\s*(\d+)/)?.[1];
  console.log(`O2_LOGINS_LENGTH=${loginCount ?? 'не найдено'}`);
  if (loginCount !== '1') {
    throw new Error('O2 не подтвердил наличие одного авторизованного аккаунта.');
  }

  const o2Csrf =
    finalPage.text.match(/"o2csrf"\s*:\s*"([^"]+)"/)?.[1];
  if (!o2Csrf) {
    throw new Error('В HTML авторизованной страницы O2 не найден o2csrf.');
  }
  console.log('Параметры O2 получены.');

  const o2Result = await postO2Login(
    email,
    o2Csrf,
    finalPage.url.href
  );
  const redirect = o2Result.location
    ? new URL(o2Result.location, 'https://o2.mail.ru')
    : null;

  console.log(`O2 POST status: ${o2Result.status}`);
  console.log(
    `O2 Redirect: ${redirect ? safeUrl(redirect) : 'нет'}`
  );
  console.log(
    `AUTH_CODE_PRESENT=${Boolean(redirect?.searchParams.get('code'))}`
  );
  console.log(
    `STATE_PRESENT=${Boolean(redirect?.searchParams.get('state'))}`
  );

  if (
    o2Result.status !== 302 ||
    redirect?.origin !== workspace ||
    redirect.pathname !== '/v2/login' ||
    !redirect.searchParams.get('code') ||
    redirect.searchParams.get('state') !== state
  ) {
    throw new Error(
      'O2 не вернул ожидаемый Workspace callback с code и исходным state.'
    );
  }

  const callback = await get(redirect, finalPage.url.href);
  if (
    callback.url.origin !== workspace ||
    callback.url.pathname !== '/'
  ) {
    throw new Error(
      `Workspace callback привёл на ${safeUrl(callback.url)}.`
    );
  }
  console.log(`WORKSPACE_CALLBACK_FINAL_STATUS=${callback.status}`);

  const userinfo = await get(
    workspace + '/api/v2/userinfo',
    workspace + '/'
  );
  let user;
  try {
    user = JSON.parse(userinfo.text);
  } catch {
    throw new Error('Workspace userinfo вернул не JSON.');
  }

  console.log(`USERINFO_STATUS=${userinfo.status}`);
  console.log(
    `USERINFO_SUB_PRESENT=${
      typeof user.sub === 'string' && user.sub.length > 0
    }`
  );
  if (typeof user.sub !== 'string' || !user.sub) {
    throw new Error('Workspace userinfo не подтвердил пользователя.');
  }

  const silent = await requestSilentToken('messenger');
  if (!silent.token || silent.status !== 200) {
    throw new Error('Messenger silent_token не получен.');
  }

  if (
    typeof user.email !== 'string' ||
    user.email.toLowerCase() !== email.toLowerCase()
  ) {
    throw new Error('Email Workspace не совпадает с введённым email.');
  }

  const session = await requestMessengerSession(
    silent.token,
    user.email
  );

  if (
    session.status !== 200 ||
    session.statusCode !== 200 ||
    !session.aimsid ||
    !session.hasAccessToken
  ) {
    throw new Error('Messenger сессия не создана.');
  }
  console.log('Messenger сессия создана.');

  return { session, email: user.email };
}

async function main() {
  const options = await parseCli();
  if (!options) return;
  console.log('Файл и пак проверены.');
  const { session, email } = await authenticateMessenger();

  if (!session.fetchBaseURL) {
    throw new Error(
      'withSession не вернул fetchBaseURL. Формат начального адреса событий ' +
      'в предоставленном HAR отсутствует; добавление не начато.'
    );
  }
  const events = new MessengerEvents(session.fetchBaseURL, session.aimsid);

  const packs = await requestMyPacks(session.aimsid);
  console.log(`Запрос списка своих паков: HTTP ${packs.status}.`);

  await choosePack(events, session.aimsid, email, options.referenceURL);
  console.log('URL стикера из нужного пака отправлен Stickers Bot.');

  const bytes = await readFile(options.filePath);
  if (bytes.length !== options.size) {
    throw new Error('Размер файла изменился после проверки. Повтори запуск.');
  }
  const uploadURL = await initFileUpload(
    session.aimsid,
    options.filename,
    bytes.length
  );
  const staticURL = await uploadSticker(uploadURL, options.filename, bytes);
  console.log('Файл загружен.');

  let previousCount = packStickerCount(packs.payload, options.packId);
  if (options.packId) {
    try {
      const latest = await requestMyPacks(session.aimsid);
      previousCount = packStickerCount(latest.payload, options.packId) ?? previousCount;
    } catch {
      // Если список недоступен, остаётся проверка ответа бота.
    }
  }
  await sendBotText(staticURL, session.aimsid, email);
  console.log('URL загруженного файла отправлен Stickers Bot.');

  const confirmedCount = options.packId
    ? await confirmPackGrowth(session.aimsid, options.packId, previousCount)
    : null;
  let confirmed = confirmedCount !== null;
  if (!confirmed) {
    try {
      confirmed = await confirmStickerAdded(events);
    } catch {
      // Отправку не повторяем: состояние бота теперь неизвестно.
    }
  }
  if (confirmed) {
    console.log(confirmedCount === null
      ? 'Stickers Bot подтвердил добавление стикера.'
      : `Количество стикеров в паке выросло до ${confirmedCount}.`);
  } else {
    console.error(
      'Ответ Stickers Bot не подтверждён. Проверь пак вручную перед повторным запуском.'
    );
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(`\nОШИБКА: ${error.message}`);
    process.exitCode = 1;
  });
}

export {
  authenticateMessenger,
  requestMyPacks,
  packStickerCount,
  confirmPackGrowth,
  MessengerEvents,
  choosePack,
  NotAuthorError,
  parseOwnedPackLinks,
  getOwnedPackLinks,
  startNewPack,
  requestPackName,
  requestPackLink,
  initFileUpload,
  uploadSticker,
  sendBotText,
  confirmStickerAdded,
  stickerReference
};
