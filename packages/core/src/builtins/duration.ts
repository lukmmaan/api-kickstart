import { TTL_UNIT_MILLISECONDS } from '../constants.js'

export function parseDurationMs(duration: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(duration)
  if (!match) throw new Error(`Invalid duration: "${duration}"`)
  return Number(match[1]) * TTL_UNIT_MILLISECONDS[match[2] as keyof typeof TTL_UNIT_MILLISECONDS]
}
