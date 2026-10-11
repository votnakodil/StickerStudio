import type { AuthService, OtpChallenge } from './authService'

type AuthFailureKind = 'network' | 'expired' | 'server'

export class AuthRequestError extends Error {
  readonly kind: AuthFailureKind
  readonly status?: number
  constructor(kind: AuthFailureKind, message: string, status?: number) {
    super(message)
    this.name = 'AuthRequestError'
    this.kind = kind
    this.status = status
  }
}

function positiveSeconds(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback
}

function challengeFrom(value: unknown): OtpChallenge {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    expiresIn: positiveSeconds(data.expiresInSeconds ?? data.expiresIn ?? data.expires_in_seconds, 600),
    resendIn: positiveSeconds(data.resendInSeconds ?? data.resendIn ?? data.resend_in_seconds, 120),
  }
}

function errorDetail(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || !('detail' in value)) return
  return typeof value.detail === 'string' ? value.detail : undefined
}

export function createProductionAuthService(request: typeof fetch = fetch): AuthService {
  async function call(path: string, init: RequestInit): Promise<Response> {
    try {
      return await request(`/api/auth/${path}`, { credentials: 'same-origin', cache: 'no-store', ...init })
    } catch {
      throw new AuthRequestError('network', 'Connection lost. Please try again.')
    }
  }
  async function fail(response: Response): Promise<never> {
    const detail = errorDetail(await response.json().catch(() => null))
    const expired = response.status === 410 || Boolean(detail && /expir/i.test(detail))
    throw new AuthRequestError(expired ? 'expired' : 'server', detail ?? 'Authentication failed. Please try again.', response.status)
  }
  const post = (path: string, body?: object) => call(path, {
    method: 'POST',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  })
  return {
    async sendOtp(email) {
      const response = await post('start', { email })
      if (!response.ok) return fail(response)
      return challengeFrom(await response.json().catch(() => null))
    },
    async verifyOtp(email, code) {
      const response = await post('verify', { email, code })
      if (response.status === 400 || response.status === 401) {
        const detail = errorDetail(await response.json().catch(() => null))
        if (detail && /expir/i.test(detail)) throw new AuthRequestError('expired', detail, response.status)
        return false
      }
      if (!response.ok) return fail(response)
      return true
    },
    async getSession() {
      const response = await call('me', { method: 'GET' })
      if (response.status === 401) return false
      if (!response.ok) return fail(response)
      return true
    },
    async logout() {
      const response = await post('logout')
      if (!response.ok) return fail(response)
    },
    async logoutAll() {
      const response = await post('logout-all')
      if (!response.ok) return fail(response)
    },
  }
}

export const productionAuthService = createProductionAuthService()
