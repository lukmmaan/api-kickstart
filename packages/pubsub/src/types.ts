import type { ClientConfig } from '@google-cloud/pubsub'

export interface PubsubOptions {
  projectId?: string
  clientConfig?: ClientConfig
}
