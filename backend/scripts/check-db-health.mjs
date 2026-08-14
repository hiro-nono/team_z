import { createDatabasePool, DatabaseError } from '../db.mjs'

function print(result) {
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

function safeError(error) {
  if (error instanceof DatabaseError && error.code === 'DATABASE_NOT_CONFIGURED') {
    return {
      code: 'DATABASE_NOT_CONFIGURED',
      message: 'DATABASE_URL is not configured.',
    }
  }

  return {
    code: 'DATABASE_UNAVAILABLE',
    message: 'Could not connect to PostgreSQL.',
  }
}

let pool

try {
  pool = createDatabasePool()
  await pool.query('SELECT 1 AS ok')
  print({ ok: true, database: 'postgresql' })
} catch (error) {
  print({ ok: false, error: safeError(error) })
  process.exitCode = 1
} finally {
  if (pool) {
    await pool.end()
  }
}
