import { importPKCS8, importSPKI, type KeyLike } from 'jose'
import { SYMMETRIC_JWT_ALGORITHMS, type JwtAlgorithm } from '../constants.js'

export type JwtKeyMaterial = string | KeyLike

export interface ResolvedJwtKeys {
  signingKey: Uint8Array | KeyLike
  verificationKey: Uint8Array | KeyLike
}

function isSymmetricAlgorithm(algorithm: JwtAlgorithm): boolean {
  return (SYMMETRIC_JWT_ALGORITHMS as readonly string[]).includes(algorithm)
}

export async function resolveJwtKeys(
  algorithm: JwtAlgorithm,
  secret: string | undefined,
  privateKey: JwtKeyMaterial | undefined,
  publicKey: JwtKeyMaterial | undefined,
): Promise<ResolvedJwtKeys> {
  if (isSymmetricAlgorithm(algorithm)) {
    if (!secret) {
      throw new Error(`jwt(): "secret" is required when algorithm is "${algorithm}"`)
    }
    const key = new TextEncoder().encode(secret)
    return { signingKey: key, verificationKey: key }
  }

  if (!privateKey || !publicKey) {
    throw new Error(`jwt(): "privateKey" and "publicKey" are required when algorithm is "${algorithm}"`)
  }

  const signingKey = typeof privateKey === 'string' ? await importPKCS8(privateKey, algorithm) : privateKey
  const verificationKey = typeof publicKey === 'string' ? await importSPKI(publicKey, algorithm) : publicKey
  return { signingKey, verificationKey }
}
