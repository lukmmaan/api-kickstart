import pinoLib, { type Logger as PinoInstance, type LoggerOptions as PinoOptions } from 'pino'
import type { Logger } from 'api-kickstart'

export interface PinoLoggerOptions {
  instance?: PinoInstance
  pinoOptions?: PinoOptions
}

function wrap(instance: PinoInstance): Logger {
  return {
    debug: (...args) => instance.debug(...(args as Parameters<PinoInstance['debug']>)),
    info: (...args) => instance.info(...(args as Parameters<PinoInstance['info']>)),
    warn: (...args) => instance.warn(...(args as Parameters<PinoInstance['warn']>)),
    error: (...args) => instance.error(...(args as Parameters<PinoInstance['error']>)),
    child: (bindings) => wrap(instance.child(bindings)),
  }
}

export function pinoLogger(options: PinoLoggerOptions = {}): Logger {
  const instance = options.instance ?? pinoLib(options.pinoOptions ?? {})
  return wrap(instance)
}
