import { createDatabasePool, DatabaseError } from '../db.mjs'

const schemaName = process.env.DATABASE_SCHEMA?.trim() || 'public'
const tableName = 'google_calendar_connections'

// This is a read-only compatibility contract inferred from the repository.
// It is not a migration and does not create or alter any database objects.
const expectedColumns = [
  { name: 'id', dataTypes: ['uuid'], nullable: 'NO' },
  { name: 'account_id', dataTypes: ['uuid'], nullable: 'NO' },
  { name: 'provider_user_id', dataTypes: ['text', 'character varying'], nullable: 'YES' },
  { name: 'access_token', dataTypes: ['text', 'character varying'], nullable: 'YES' },
  { name: 'refresh_token', dataTypes: ['text', 'character varying'], nullable: 'YES' },
  { name: 'expires_at', dataTypes: ['timestamp with time zone', 'timestamp without time zone'], nullable: 'YES' },
  { name: 'scopes', dataTypes: ['ARRAY'], udtNames: ['_text'], nullable: 'YES' },
  { name: 'updated_at', dataTypes: ['timestamp with time zone', 'timestamp without time zone'], nullable: 'YES' },
]

const expectedConstraints = [
  { type: 'PRIMARY KEY', columns: ['id'] },
  { type: 'UNIQUE', columns: ['account_id'] },
]

const tableSql = `
  SELECT table_name, table_type
  FROM information_schema.tables
  WHERE table_schema = $1 AND table_name = $2
`

const columnsSql = `
  SELECT ordinal_position, column_name, data_type, udt_name, is_nullable
  FROM information_schema.columns
  WHERE table_schema = $1 AND table_name = $2
  ORDER BY ordinal_position
`

const constraintsSql = `
  SELECT tc.constraint_name, tc.constraint_type, kcu.column_name, kcu.ordinal_position
  FROM information_schema.table_constraints AS tc
  LEFT JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_catalog = kcu.constraint_catalog
    AND tc.constraint_schema = kcu.constraint_schema
    AND tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
    AND tc.table_name = kcu.table_name
  WHERE tc.table_schema = $1 AND tc.table_name = $2
  ORDER BY tc.constraint_name, kcu.ordinal_position
`

function groupConstraints(rows) {
  const byName = new Map()
  for (const row of rows) {
    if (!byName.has(row.constraint_name)) {
      byName.set(row.constraint_name, {
        name: row.constraint_name,
        type: row.constraint_type,
        columns: [],
      })
    }
    if (row.column_name) {
      byName.get(row.constraint_name).columns.push(row.column_name)
    }
  }
  return [...byName.values()]
}

function buildDifferences(columns, constraints) {
  const actualByName = new Map(columns.map((column) => [column.column_name, column]))
  const missingColumns = []
  const typeMismatches = []
  const nullableMismatches = []

  for (const expected of expectedColumns) {
    const actual = actualByName.get(expected.name)
    if (!actual) {
      missingColumns.push(expected.name)
      continue
    }
    const typeMatches = expected.dataTypes.includes(actual.data_type)
      && (!expected.udtNames || expected.udtNames.includes(actual.udt_name))
    if (!typeMatches) {
      typeMismatches.push({
        column: expected.name,
        expected: expected.udtNames
          ? `${expected.dataTypes.join(' or ')} (${expected.udtNames.join(' or ')})`
          : expected.dataTypes.join(' or '),
        actual: `${actual.data_type} (${actual.udt_name})`,
      })
    }
    if (actual.is_nullable !== expected.nullable) {
      nullableMismatches.push({ column: expected.name, expected: expected.nullable, actual: actual.is_nullable })
    }
  }

  const extraColumns = columns
    .map((column) => column.column_name)
    .filter((columnName) => !expectedColumns.some((expected) => expected.name === columnName))

  const missingExpectedConstraints = expectedConstraints
    .filter((expected) => !constraints.some((actual) => (
      actual.type === expected.type
      && actual.columns.length === expected.columns.length
      && actual.columns.every((column, index) => column === expected.columns[index])
    )))
    .map((expected) => `${expected.type} (${expected.columns.join(', ')})`)

  return { missingColumns, typeMismatches, nullableMismatches, extraColumns, missingExpectedConstraints }
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function safeError(error) {
  if (error instanceof DatabaseError && error.code === 'DATABASE_NOT_CONFIGURED') {
    return { code: 'DATABASE_NOT_CONFIGURED', message: 'DATABASE_URL is not configured.' }
  }
  return { code: 'DATABASE_UNAVAILABLE', message: 'Could not query PostgreSQL metadata.' }
}

let pool

try {
  pool = createDatabasePool()
  await pool.query('SELECT 1 AS ok')

  const tableResult = await pool.query(tableSql, [schemaName, tableName])
  const table = tableResult.rows[0]
  if (!table) {
    print({
      connected: true,
      table: { schema: schemaName, name: tableName, exists: false },
      columns: [],
      constraints: [],
      differences: { tableMissing: true },
    })
  } else {
    const [columnsResult, constraintsResult] = await Promise.all([
      pool.query(columnsSql, [schemaName, tableName]),
      pool.query(constraintsSql, [schemaName, tableName]),
    ])
    const constraints = groupConstraints(constraintsResult.rows)
    print({
      connected: true,
      table: { schema: schemaName, name: tableName, exists: true, type: table.table_type },
      columns: columnsResult.rows,
      constraints,
      differences: buildDifferences(columnsResult.rows, constraints),
    })
  }
} catch (error) {
  print({ connected: false, error: safeError(error) })
  process.exitCode = 1
} finally {
  if (pool) {
    await pool.end()
  }
}
