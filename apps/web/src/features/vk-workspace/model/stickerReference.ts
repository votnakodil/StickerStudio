export function isValidStickerReference(value: string) {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' && url.hostname === 'files.myteam.mail.ru' && !url.port && !url.username && !url.password && /^\/get\/[A-Za-z0-9]+$/.test(url.pathname) && !url.search && !url.hash
  } catch { return false }
}
