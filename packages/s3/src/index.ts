import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner'
import type { StorageAdapter, StorageObjectMeta, StorageSignedUrlOptions } from 'api-kickstart'

const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 900

export interface S3StorageOptions {
  bucket: string
  client?: S3Client
  region?: string
  endpoint?: string
  forcePathStyle?: boolean
  credentials?: { accessKeyId: string; secretAccessKey: string }
}

function isNoSuchKeyError(err: unknown): boolean {
  return err instanceof Error && err.name === 'NoSuchKey'
}

export function s3Storage(options: S3StorageOptions): StorageAdapter {
  const client = options.client ?? new S3Client({
    region: options.region,
    endpoint: options.endpoint,
    forcePathStyle: options.forcePathStyle,
    credentials: options.credentials,
  })

  return {
    async put(key: string, data: Buffer, meta?: StorageObjectMeta): Promise<void> {
      await client.send(new PutObjectCommand({
        Bucket: options.bucket,
        Key: key,
        Body: data,
        ContentType: meta?.contentType,
        ContentLength: meta?.size ?? data.length,
      }))
    },

    async get(key: string): Promise<Buffer | null> {
      try {
        const response = await client.send(new GetObjectCommand({ Bucket: options.bucket, Key: key }))
        if (!response.Body) return null
        const bytes = await response.Body.transformToByteArray()
        return Buffer.from(bytes)
      } catch (err) {
        if (isNoSuchKeyError(err)) return null
        throw err
      }
    },

    async delete(key: string): Promise<void> {
      await client.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: key }))
    },

    async getSignedUrl(key: string, urlOptions?: StorageSignedUrlOptions): Promise<string> {
      const command = new GetObjectCommand({ Bucket: options.bucket, Key: key })
      return presign(client, command, { expiresIn: urlOptions?.expiresInSeconds ?? DEFAULT_SIGNED_URL_EXPIRY_SECONDS })
    },
  }
}
