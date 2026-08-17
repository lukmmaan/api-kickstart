import { describe, expect, it } from 'vitest'
import { DATE_FORMATS, formatDate, formatDateAs, formatDateForDb } from './dates.js'

const sample = new Date(2024, 0, 5, 9, 7, 3, 45)

describe('formatDate', () => {
  it('formats year, month, day tokens', () => {
    expect(formatDate(sample, 'YYYY-MM-DD')).toBe('2024-01-05')
    expect(formatDate(sample, 'YY-M-D')).toBe('24-1-5')
  })

  it('formats hour/minute/second tokens in 24h and 12h', () => {
    expect(formatDate(sample, 'HH:mm:ss')).toBe('09:07:03')
    expect(formatDate(sample, 'hh:mm A')).toBe('09:07 AM')

    const pm = new Date(2024, 0, 5, 13, 7, 3)
    expect(formatDate(pm, 'hh:mm a')).toBe('01:07 pm')

    const noon = new Date(2024, 0, 5, 12, 0, 0)
    expect(formatDate(noon, 'hh A')).toBe('12 PM')
  })

  it('formats month and day names', () => {
    expect(formatDate(sample, 'dddd, MMMM D')).toBe('Friday, January 5')
    expect(formatDate(sample, 'ddd MMM D')).toBe('Fri Jan 5')
  })

  it('formats milliseconds and passes through literal characters', () => {
    expect(formatDate(sample, 'YYYY-MM-DD HH:mm:ss.SSS')).toBe('2024-01-05 09:07:03.045')
    expect(formatDate(sample, 'YYYY/MM/DD')).toBe('2024/01/05')
  })
})

describe('formatDateAs', () => {
  it('applies every named preset without throwing and produces non-empty output', () => {
    for (const name of Object.keys(DATE_FORMATS) as (keyof typeof DATE_FORMATS)[]) {
      const result = formatDateAs(sample, name)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    }
  })

  it('formats the isoDate preset', () => {
    expect(formatDateAs(sample, 'isoDate')).toBe('2024-01-05')
  })

  it('formats the usDate preset', () => {
    expect(formatDateAs(sample, 'usDate')).toBe('01/05/2024')
  })
})

describe('formatDateForDb', () => {
  it('formats for mysql and sqlite as space-separated datetime', () => {
    expect(formatDateForDb(sample, 'mysql')).toBe('2024-01-05 09:07:03')
    expect(formatDateForDb(sample, 'sqlite')).toBe('2024-01-05 09:07:03')
  })

  it('formats for postgres and mssql with milliseconds', () => {
    expect(formatDateForDb(sample, 'postgres')).toBe('2024-01-05 09:07:03.045')
    expect(formatDateForDb(sample, 'mssql')).toBe('2024-01-05 09:07:03.045')
  })

  it('formats for oracle as DD-MON-YYYY', () => {
    expect(formatDateForDb(sample, 'oracle')).toBe('05-JAN-2024')
  })

  it('formats for mongodb as a native ISO string', () => {
    expect(formatDateForDb(sample, 'mongodb')).toBe(sample.toISOString())
  })
})
