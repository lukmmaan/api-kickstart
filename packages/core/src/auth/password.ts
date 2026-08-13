import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, options: ScryptOptions) => Promise<Buffer>

export interface PasswordHashOptions {
  keyLength?: number
  cost?: number
}

const DEFAULT_KEY_LENGTH = 64
const DEFAULT_COST = 16384

export async function hashPassword(password: string, options: PasswordHashOptions = {}): Promise<string> {
  const keyLength = options.keyLength ?? DEFAULT_KEY_LENGTH
  const cost = options.cost ?? DEFAULT_COST
  const salt = randomBytes(16)
  const derivedKey = await scryptAsync(password, salt, keyLength, { N: cost })
  return `scrypt$${cost}$${salt.toString('hex')}$${derivedKey.toString('hex')}`
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parts = hash.split('$')
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false

  const cost = Number(parts[1])
  const salt = Buffer.from(parts[2], 'hex')
  const expected = Buffer.from(parts[3], 'hex')
  if (!Number.isInteger(cost) || salt.length === 0 || expected.length === 0) return false

  const derivedKey = await scryptAsync(password, salt, expected.length, { N: cost })
  return derivedKey.length === expected.length && timingSafeEqual(derivedKey, expected)
}
