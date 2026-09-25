import type { AuthService, OtpChallenge } from './authService'

const CODE = '123456'
const OTP_LIFETIME_SECONDS = 10 * 60
const RESEND_SECONDS = 2 * 60

const challenges = new Map<string, number>()

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export const mockAuthService: AuthService = {
  async sendOtp(email): Promise<OtpChallenge> {
    await wait(450)
    challenges.set(email, Date.now() + OTP_LIFETIME_SECONDS * 1000)
    return { expiresIn: OTP_LIFETIME_SECONDS, resendIn: RESEND_SECONDS }
  },

  async verifyOtp(email, code): Promise<boolean> {
    await wait(450)
    const expiresAt = challenges.get(email)
    if (!expiresAt || Date.now() >= expiresAt) throw new Error('expired')
    return code === CODE
  },
}
