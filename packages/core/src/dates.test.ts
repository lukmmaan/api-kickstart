import { describe, expect, it } from 'vitest'
import { DATE_FORMATS, formatDate, formatDateAs, formatDateAsUTC, formatDateForDb, formatDateUTC } from './dates.js'

const sample = new Date(2024, 0, 5, 9, 7, 3, 45)
const sampleUtc = new Date(Date.UTC(2024, 0, 5, 9, 7, 3, 45))

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

describe('formatDateUTC', () => {
  it('formats using the date UTC fields regardless of the local timezone', () => {
    expect(formatDateUTC(sampleUtc, 'YYYY-MM-DD HH:mm:ss')).toBe('2024-01-05 09:07:03')
    expect(formatDateUTC(sampleUtc, 'YYYY-MM-DD HH:mm:ss.SSS')).toBe('2024-01-05 09:07:03.045')
  })

  it('formats month/day names and the 12h clock from UTC fields', () => {
    expect(formatDateUTC(sampleUtc, 'dddd, MMMM D')).toBe('Friday, January 5')
    expect(formatDateUTC(sampleUtc, 'hh:mm A')).toBe('09:07 AM')
  })

  it('always reports a zero offset for the Z/ZZ tokens', () => {
    expect(formatDateUTC(sampleUtc, 'Z')).toBe('+00:00')
    expect(formatDateUTC(sampleUtc, 'ZZ')).toBe('+0000')
  })
})

describe('formatDateAs / formatDateAsUTC', () => {
  it('applies every named preset without throwing and produces non-empty output', () => {
    for (const name of Object.keys(DATE_FORMATS) as (keyof typeof DATE_FORMATS)[]) {
      expect(formatDateAs(sample, name).length).toBeGreaterThan(0)
      expect(formatDateAsUTC(sampleUtc, name).length).toBeGreaterThan(0)
    }
  })

  it('formats the isoDate preset', () => {
    expect(formatDateAs(sample, 'isoDate')).toBe('2024-01-05')
  })

  it('formats the usDate preset', () => {
    expect(formatDateAs(sample, 'usDate')).toBe('01/05/2024')
  })

  it('formats the isoDateTimeTz preset with a UTC offset', () => {
    expect(formatDateAsUTC(sampleUtc, 'isoDateTimeTz')).toBe('2024-01-05T09:07:03+00:00')
  })
})

describe('formatDateForDb', () => {
  it('defaults to UTC for mysql and sqlite', () => {
    expect(formatDateForDb(sampleUtc, 'mysql')).toBe('2024-01-05 09:07:03')
    expect(formatDateForDb(sampleUtc, 'sqlite')).toBe('2024-01-05 09:07:03')
  })

  it('defaults to UTC for postgres and mssql, with milliseconds', () => {
    expect(formatDateForDb(sampleUtc, 'postgres')).toBe('2024-01-05 09:07:03.045')
    expect(formatDateForDb(sampleUtc, 'mssql')).toBe('2024-01-05 09:07:03.045')
  })

  it('defaults to UTC for oracle, as DD-MON-YYYY', () => {
    expect(formatDateForDb(sampleUtc, 'oracle')).toBe('05-JAN-2024')
  })

  it('formats for mongodb as a native ISO string, unaffected by the utc option', () => {
    expect(formatDateForDb(sampleUtc, 'mongodb')).toBe(sampleUtc.toISOString())
    expect(formatDateForDb(sampleUtc, 'mongodb', { utc: false })).toBe(sampleUtc.toISOString())
  })

  it('falls back to local time when { utc: false } is passed', () => {
    expect(formatDateForDb(sample, 'mysql', { utc: false })).toBe(formatDate(sample, 'YYYY-MM-DD HH:mm:ss'))
    expect(formatDateForDb(sample, 'postgres', { utc: false })).toBe(formatDate(sample, 'YYYY-MM-DD HH:mm:ss.SSS'))
    expect(formatDateForDb(sample, 'oracle', { utc: false })).toBe(formatDate(sample, 'DD-MMM-YYYY').toUpperCase())
  })
})
