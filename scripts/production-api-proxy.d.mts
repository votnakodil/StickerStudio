import type { IncomingMessage } from 'node:http'
export const PRODUCTION_API_ORIGIN: string
export function isAllowedLocalApiRequest(request: Pick<IncomingMessage, 'method' | 'headers'>, localOrigin: string): boolean
export function productionOriginFor(request: Pick<IncomingMessage, 'method'>): string | undefined
