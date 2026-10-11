import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export function localHttpsOptions(root) {
  const directory = resolve(root, 'node_modules/.cache/sticker-studio-local-https')
  const keyPath = join(directory, 'localhost-key.pem')
  const certificatePath = join(directory, 'localhost-cert.pem')
  if (!existsSync(keyPath) || !existsSync(certificatePath)) {
    mkdirSync(directory, { recursive: true })
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes',
      '-keyout', keyPath, '-out', certificatePath, '-days', '365',
      '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ], { stdio: 'ignore' })
  }
  chmodSync(keyPath, 0o600)
  return { key: readFileSync(keyPath), cert: readFileSync(certificatePath) }
}
