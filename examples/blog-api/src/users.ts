import { hashPassword, verifyPassword } from 'api-kickstart/auth'

export interface DemoUser {
  id: string
  username: string
  passwordHash: string
  role: 'admin' | 'author' | 'reader'
}

interface SeedUser {
  id: string
  username: string
  password: string
  role: DemoUser['role']
}

const seeds: SeedUser[] = [
  { id: '1', username: 'admin', password: 'admin123', role: 'admin' },
  { id: '2', username: 'alice', password: 'alice123', role: 'author' },
  { id: '3', username: 'bob', password: 'bob123', role: 'author' },
  { id: '4', username: 'reader', password: 'reader123', role: 'reader' },
]

export const users: DemoUser[] = await Promise.all(
  seeds.map(async (seed) => ({
    id: seed.id,
    username: seed.username,
    passwordHash: await hashPassword(seed.password),
    role: seed.role,
  })),
)

export function findUserById(id: string): DemoUser | undefined {
  return users.find((u) => u.id === id)
}

export async function findUserByCredentials(username: string, password: string): Promise<DemoUser | undefined> {
  const user = users.find((u) => u.username === username)
  if (!user) return undefined
  const valid = await verifyPassword(password, user.passwordHash)
  return valid ? user : undefined
}
