import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { mockClient } from 'aws-sdk-client-mock'
import { beforeEach, describe, expect, it } from 'vitest'
import { s3Storage } from './index.js'

const s3Mock = mockClient(S3Client)

beforeEach(() => {
  s3Mock.reset()
})

describe('s3Storage', () => {
  it('put() sends a PutObjectCommand with the bucket, key, body, and content type', async () => {
    s3Mock.on(PutObjectCommand).resolves({})
    const storage = s3Storage({ bucket: 'my-bucket', client: new S3Client({ region: 'us-east-1' }) })

    await storage.put('uploads/a.txt', Buffer.from('hello'), { contentType: 'text/plain' })

    const calls = s3Mock.commandCalls(PutObjectCommand)
    expect(calls).toHaveLength(1)
    expect(calls[0].args[0].input).toMatchObject({
      Bucket: 'my-bucket',
      Key: 'uploads/a.txt',
      ContentType: 'text/plain',
    })
  })

  it('get() returns the object body as a Buffer', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: { transformToByteArray: async () => new Uint8Array(Buffer.from('file contents')) } as never,
    })
    const storage = s3Storage({ bucket: 'my-bucket', client: new S3Client({ region: 'us-east-1' }) })

    const result = await storage.get('uploads/a.txt')
    expect(result?.toString('utf8')).toBe('file contents')
  })

  it('get() returns null when the object does not exist', async () => {
    const notFound = Object.assign(new Error('not found'), { name: 'NoSuchKey' })
    s3Mock.on(GetObjectCommand).rejects(notFound)
    const storage = s3Storage({ bucket: 'my-bucket', client: new S3Client({ region: 'us-east-1' }) })

    await expect(storage.get('missing.txt')).resolves.toBeNull()
  })

  it('get() rethrows errors that are not NoSuchKey', async () => {
    s3Mock.on(GetObjectCommand).rejects(new Error('access denied'))
    const storage = s3Storage({ bucket: 'my-bucket', client: new S3Client({ region: 'us-east-1' }) })

    await expect(storage.get('forbidden.txt')).rejects.toThrow('access denied')
  })

  it('delete() sends a DeleteObjectCommand for the given key', async () => {
    s3Mock.on(DeleteObjectCommand).resolves({})
    const storage = s3Storage({ bucket: 'my-bucket', client: new S3Client({ region: 'us-east-1' }) })

    await storage.delete('uploads/a.txt')

    const calls = s3Mock.commandCalls(DeleteObjectCommand)
    expect(calls[0].args[0].input).toMatchObject({ Bucket: 'my-bucket', Key: 'uploads/a.txt' })
  })

  it('getSignedUrl() returns a signed URL pointing at the bucket and key', async () => {
    const storage = s3Storage({
      bucket: 'my-bucket',
      client: new S3Client({ region: 'us-east-1', credentials: { accessKeyId: 'test', secretAccessKey: 'test' } }),
    })

    const url = await storage.getSignedUrl('uploads/a.txt', { expiresInSeconds: 60 })

    expect(url).toContain('my-bucket')
    expect(url).toContain('uploads/a.txt')
    expect(url).toContain('X-Amz-Signature')
    expect(url).toContain('X-Amz-Expires=60')
  })
})
