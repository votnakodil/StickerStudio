import { mockAuthService } from './mockAuthService'

export const authService = mockAuthService
export { isAllowedEmail, normalizeEmail } from './authService'
export type { AuthService, OtpChallenge } from './authService'
