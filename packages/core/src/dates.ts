const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_NAMES_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_NAMES_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const TOKEN_PATTERN = /YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd|HH|H|hh|h|mm|m|ss|s|SSS|A|a|ZZ|Z/g

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

interface DateFields {
  year: number
  month: number
  day: number
  hours24: number
  minutes: number
  seconds: number
  milliseconds: number
  dayOfWeek: number
  tzOffsetMinutes: number
}

function localFields(date: Date): DateFields {
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    hours24: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
    milliseconds: date.getMilliseconds(),
    dayOfWeek: date.getDay(),
    tzOffsetMinutes: -date.getTimezoneOffset(),
  }
}

function utcFields(date: Date): DateFields {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
    hours24: date.getUTCHours(),
    minutes: date.getUTCMinutes(),
    seconds: date.getUTCSeconds(),
    milliseconds: date.getUTCMilliseconds(),
    dayOfWeek: date.getUTCDay(),
    tzOffsetMinutes: 0,
  }
}

function formatFields(fields: DateFields, pattern: string): string {
  const { year, month, day, hours24, minutes, seconds, milliseconds, dayOfWeek, tzOffsetMinutes } = fields
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  const tzSign = tzOffsetMinutes >= 0 ? '+' : '-'
  const tzHours = pad(Math.floor(Math.abs(tzOffsetMinutes) / 60))
  const tzMinutes = pad(Math.abs(tzOffsetMinutes) % 60)

  return pattern.replace(TOKEN_PATTERN, (token) => {
    switch (token) {
      case 'YYYY': return String(year)
      case 'YY': return pad(year % 100)
      case 'MMMM': return MONTH_NAMES_LONG[month]
      case 'MMM': return MONTH_NAMES_SHORT[month]
      case 'MM': return pad(month + 1)
      case 'M': return String(month + 1)
      case 'DD': return pad(day)
      case 'D': return String(day)
      case 'dddd': return DAY_NAMES_LONG[dayOfWeek]
      case 'ddd': return DAY_NAMES_SHORT[dayOfWeek]
      case 'HH': return pad(hours24)
      case 'H': return String(hours24)
      case 'hh': return pad(hours12)
      case 'h': return String(hours12)
      case 'mm': return pad(minutes)
      case 'm': return String(minutes)
      case 'ss': return pad(seconds)
      case 's': return String(seconds)
      case 'SSS': return pad(milliseconds, 3)
      case 'A': return hours24 < 12 ? 'AM' : 'PM'
      case 'a': return hours24 < 12 ? 'am' : 'pm'
      case 'ZZ': return `${tzSign}${tzHours}${tzMinutes}`
      case 'Z': return `${tzSign}${tzHours}:${tzMinutes}`
      default: return token
    }
  })
}

export function formatDate(date: Date, pattern: string): string {
  return formatFields(localFields(date), pattern)
}

export function formatDateUTC(date: Date, pattern: string): string {
  return formatFields(utcFields(date), pattern)
}

export const DATE_FORMATS = {
  isoDate: 'YYYY-MM-DD',
  isoDateTime: 'YYYY-MM-DDTHH:mm:ss',
  isoDateTimeMs: 'YYYY-MM-DDTHH:mm:ss.SSS',
  isoDateTimeTz: 'YYYY-MM-DDTHH:mm:ssZ',
  usDate: 'MM/DD/YYYY',
  usDateTime: 'MM/DD/YYYY hh:mm A',
  euDate: 'DD/MM/YYYY',
  euDateTime: 'DD/MM/YYYY HH:mm',
  dottedDate: 'DD.MM.YYYY',
  longDate: 'MMMM D, YYYY',
  shortDate: 'MMM D, YYYY',
  dayMonthYearDashed: 'DD-MM-YYYY',
  time24: 'HH:mm:ss',
  time24Short: 'HH:mm',
  time12: 'hh:mm:ss A',
  time12Short: 'hh:mm A',
  fullDateTime: 'dddd, MMMM D, YYYY HH:mm:ss',
  logTimestamp: 'YYYY-MM-DD HH:mm:ss.SSS',
  fileNameSafe: 'YYYY-MM-DD_HH-mm-ss',
} as const

export type DateFormatName = keyof typeof DATE_FORMATS

export function formatDateAs(date: Date, formatName: DateFormatName): string {
  return formatDate(date, DATE_FORMATS[formatName])
}

export function formatDateAsUTC(date: Date, formatName: DateFormatName): string {
  return formatDateUTC(date, DATE_FORMATS[formatName])
}

export type DbDialect = 'mysql' | 'postgres' | 'sqlite' | 'mongodb' | 'mssql' | 'oracle'

export interface FormatDateForDbOptions {
  utc?: boolean
}

const DB_DATE_FORMATTERS: Record<DbDialect, (date: Date, utc: boolean) => string> = {
  mysql: (date, utc) => (utc ? formatDateUTC : formatDate)(date, 'YYYY-MM-DD HH:mm:ss'),
  sqlite: (date, utc) => (utc ? formatDateUTC : formatDate)(date, 'YYYY-MM-DD HH:mm:ss'),
  postgres: (date, utc) => (utc ? formatDateUTC : formatDate)(date, 'YYYY-MM-DD HH:mm:ss.SSS'),
  mssql: (date, utc) => (utc ? formatDateUTC : formatDate)(date, 'YYYY-MM-DD HH:mm:ss.SSS'),
  oracle: (date, utc) => (utc ? formatDateUTC : formatDate)(date, 'DD-MMM-YYYY').toUpperCase(),
  mongodb: (date) => date.toISOString(),
}

export function formatDateForDb(date: Date, dialect: DbDialect, options: FormatDateForDbOptions = {}): string {
  return DB_DATE_FORMATTERS[dialect](date, options.utc ?? true)
}
