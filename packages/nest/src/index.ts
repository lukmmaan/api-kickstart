import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { FrameworkAdapter } from 'api-kickstart'
import { KickstartModule, dispatchRef } from './controller.js'

export function nest(): FrameworkAdapter {
  let app: NestExpressApplication | null = null

  return {
    name: 'nest',

    onRequest(handler) {
      dispatchRef.current = handler
    },

    listen(port, cb) {
      void (async () => {
        app = await NestFactory.create<NestExpressApplication>(KickstartModule, { logger: false })
        await app.listen(port)
        cb?.()
      })()
      return null
    },

    handler() {
      return app?.getHttpAdapter().getInstance()
    },

    async close() {
      await app?.close()
    },
  }
}
