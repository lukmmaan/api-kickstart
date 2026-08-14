import type { SQSClientConfig } from '@aws-sdk/client-sqs'

export interface SqsOptions {
  region?: string
  clientConfig?: SQSClientConfig
  waitTimeSeconds?: number
}
