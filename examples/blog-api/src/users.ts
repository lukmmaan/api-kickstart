export interface DemoUser {
  id: string
  username: string
  password: string
  role: 'admin' | 'author' | 'reader'
}

export const users: DemoUser[] = [
  { id: '1', username: 'admin', password: 'admin123', role: 'admin' },
  { id: '2', username: 'alice', password: 'alice123', role: 'author' },
  { id: '3', username: 'bob', password: 'bob123', role: 'author' },
  { id: '4', username: 'reader', password: 'reader123', role: 'reader' },
]

export function findUserById(id: string): DemoUser | undefined {
  return users.find((u) => u.id === id)
}

export function findUserByCredentials(username: string, password: string): DemoUser | undefined {
  return users.find((u) => u.username === username && u.password === password)
}
