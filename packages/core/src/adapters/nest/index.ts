import 'reflect-metadata'
import expressLib from 'express'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { FrameworkAdapter } from '../../index.js'
import { KickstartModule, dispatchRef } from './controller.js'
import { captureMultipartBody } from './multipart.js'

export function nest(): FrameworkAdapter {
  let app: NestExpressApplication | null = null

  return {
    name: 'nest',

    onRequest(handler) {
      dispatchRef.current = handler
    },

    listen(port, cb) {
      void (async () => {
        app = await NestFactory.create<NestExpressApplication>(KickstartModule, { logger: false, bodyParser: false })
        app.use(captureMultipartBody)
        app.use(expressLib.json())
        app.use(expressLib.urlencoded({ extended: true }))
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
