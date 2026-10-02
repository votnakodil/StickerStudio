export interface OtpChallenge {
  expiresIn: number
  resendIn: number
}

export interface AuthService {
  sendOtp(email: string): Promise<OtpChallenge>
  verifyOtp(email: string, code: string): Promise<boolean>
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export function isAllowedEmail(email: string) {
  const normalized = normalizeEmail(email)
  const match = /^([a-z0-9.!#$%&'*+/=?^_`{|}~-]+)@free-lines\.ru$/.exec(normalized)
  return Boolean(match && !match[1].startsWith('.') && !match[1].endsWith('.') && !match[1].includes('..'))
}
