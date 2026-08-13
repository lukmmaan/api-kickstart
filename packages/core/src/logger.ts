import type { Logger } from './types.js'

export function defaultLogger(bindings: Record<string, unknown> = {}): Logger {
  return {
    debug: (...args) => console.debug(bindings, ...args),
    info: (...args) => console.info(bindings, ...args),
    warn: (...args) => console.warn(bindings, ...args),
    error: (...args) => console.error(bindings, ...args),
    child: (extra) => defaultLogger({ ...bindings, ...extra }),
  }
}
