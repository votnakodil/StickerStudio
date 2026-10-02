import { mockAuthService } from '@/features/auth/api/mockAuthService'

export const authService = mockAuthService
export { isAllowedEmail, normalizeEmail } from '@/features/auth/api/authService'
export type { AuthService, OtpChallenge } from '@/features/auth/api/authService'
