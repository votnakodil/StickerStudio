export const PRODUCTION_API_ORIGIN = 'https://stickerstudio.igorcodes.de'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function isAllowedLocalApiRequest(request, localOrigin) {
  const expected = new URL(localOrigin)
  const host = request.headers.host ?? request.headers[':authority']
  if (host !== expected.host) return false
  if (request.headers.host && request.headers[':authority'] && request.headers.host !== request.headers[':authority']) return false
  const origin = request.headers.origin
  if (origin && origin !== localOrigin) return false
  return SAFE_METHODS.has(request.method ?? 'GET') || origin === localOrigin
}

export function productionOriginFor(request) {
  return SAFE_METHODS.has(request.method ?? 'GET') ? undefined : PRODUCTION_API_ORIGIN
}
