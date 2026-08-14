import pg from 'pg'

const { Pool } = pg

export class DatabaseError extends Error {
  constructor(code, statusCode, message, options = {}) {
    super(message, options)
    this.name = 'DatabaseError'
    this.code = code
    this.statusCode = statusCode
  }
}

function isFalse(value) {
  return typeof value === 'string' && ['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase())
}

export function createDatabasePool({ env = process.env, poolFactory = (options) => new Pool(options) } = {}) {
  const connectionString = typeof env.DATABASE_URL === 'string' ? env.DATABASE_URL.trim() : ''
  if (!connectionString) {
    throw new DatabaseError('DATABASE_NOT_CONFIGURED', 503, 'DATABASE_URLがサーバーに設定されていません。')
  }

  const ssl = isFalse(env.DATABASE_SSL) ? false : { rejectUnauthorized: false }

  return poolFactory({
    connectionString,
    ssl,
    max: 10,
  })
}
