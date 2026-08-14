import type { DbAdapter } from '@api-kickstart/api-kickstart'

export interface Post {
  id: string
  title: string
  body: string
  authorId: string
  published: boolean
}

const posts = new Map<string, Post>([
  ['1', { id: '1', title: 'Hello, world', body: 'My first post.', authorId: '2', published: true }],
  ['2', { id: '2', title: 'Draft in progress', body: 'Not ready yet.', authorId: '2', published: false }],
  ['3', { id: '3', title: 'Bob writes too', body: 'Second author, second post.', authorId: '3', published: true }],
])

let nextId = 4

function matches(where: Record<string, unknown>) {
  return (post: Post) => Object.entries(where).every(([key, value]) => value === undefined || (post as unknown as Record<string, unknown>)[key] === value)
}

export function createInMemoryDb(): DbAdapter {
  const client = {
    posts: {
      async findMany({ where }: { where: Record<string, unknown> }): Promise<Post[]> {
        return [...posts.values()].filter(matches(where))
      },
      async findFirst({ where }: { where: Record<string, unknown> }): Promise<Post | null> {
        return [...posts.values()].find(matches(where)) ?? null
      },
      async create({ data }: { data: Omit<Post, 'id'> }): Promise<Post> {
        const id = String(nextId++)
        const record: Post = { id, ...data }
        posts.set(id, record)
        return record
      },
      async update({ where, data }: { where: { id: string }; data: Partial<Post> }): Promise<Post> {
        const existing = posts.get(where.id)
        if (!existing) throw new Error(`post "${where.id}" not found`)
        const updated = { ...existing, ...data }
        posts.set(where.id, updated)
        return updated
      },
      async delete({ where }: { where: { id: string } }): Promise<void> {
        posts.delete(where.id)
      },
    },
  }

  return {
    client,
    translateScope(filter) {
      return filter
    },
    normalizeError(err) {
      return err instanceof Error ? err : null
    },
    async healthcheck() {
      return true
    },
  }
}
