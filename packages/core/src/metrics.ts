export interface RouteMetrics {
  count: number
  totalDurationMs: number
  errorCount: number
}

export class MetricsCollector {
  private byRoute = new Map<string, RouteMetrics>()

  record(routeLabel: string, durationMs: number, status: number): void {
    const entry = this.byRoute.get(routeLabel) ?? { count: 0, totalDurationMs: 0, errorCount: 0 }
    entry.count += 1
    entry.totalDurationMs += durationMs
    if (status >= 500) entry.errorCount += 1
    this.byRoute.set(routeLabel, entry)
  }

  snapshot(): Record<string, RouteMetrics> {
    return Object.fromEntries(this.byRoute)
  }

  toPrometheus(): string {
    const lines: string[] = []

    lines.push('# HELP api_kickstart_requests_total Total requests handled per route')
    lines.push('# TYPE api_kickstart_requests_total counter')
    for (const [route, stats] of this.byRoute) {
      lines.push(`api_kickstart_requests_total{route="${route}"} ${stats.count}`)
    }

    lines.push('# HELP api_kickstart_request_duration_ms_sum Total request duration in milliseconds per route')
    lines.push('# TYPE api_kickstart_request_duration_ms_sum counter')
    for (const [route, stats] of this.byRoute) {
      lines.push(`api_kickstart_request_duration_ms_sum{route="${route}"} ${stats.totalDurationMs}`)
    }

    lines.push('# HELP api_kickstart_errors_total Total 5xx responses per route')
    lines.push('# TYPE api_kickstart_errors_total counter')
    for (const [route, stats] of this.byRoute) {
      lines.push(`api_kickstart_errors_total{route="${route}"} ${stats.errorCount}`)
    }

    return `${lines.join('\n')}\n`
  }
}
