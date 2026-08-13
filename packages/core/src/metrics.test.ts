import { describe, expect, it } from 'vitest'
import { MetricsCollector } from './metrics.js'

describe('MetricsCollector', () => {
  it('aggregates count, duration, and error count per route', () => {
    const collector = new MetricsCollector()
    collector.record('GET /users', 10, 200)
    collector.record('GET /users', 20, 200)
    collector.record('GET /users', 5, 500)

    const snapshot = collector.snapshot()
    expect(snapshot['GET /users']).toEqual({ count: 3, totalDurationMs: 35, errorCount: 1 })
  })

  it('keeps separate entries per route label', () => {
    const collector = new MetricsCollector()
    collector.record('GET /users', 10, 200)
    collector.record('POST /users', 15, 201)

    const snapshot = collector.snapshot()
    expect(Object.keys(snapshot).sort()).toEqual(['GET /users', 'POST /users'])
  })

  it('does not count non-5xx statuses as errors', () => {
    const collector = new MetricsCollector()
    collector.record('GET /users', 10, 404)
    expect(collector.snapshot()['GET /users'].errorCount).toBe(0)
  })

  it('renders Prometheus exposition format with route labels', () => {
    const collector = new MetricsCollector()
    collector.record('GET /users', 10, 200)
    const text = collector.toPrometheus()
    expect(text).toContain('api_kickstart_requests_total{route="GET /users"} 1')
    expect(text).toContain('api_kickstart_request_duration_ms_sum{route="GET /users"} 10')
    expect(text).toContain('api_kickstart_errors_total{route="GET /users"} 0')
  })
})
