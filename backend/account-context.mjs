export const ACCOUNT_ID_HEADER = 'x-account-id'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class AccountContextError extends Error {
  constructor(code, statusCode, message) {
    super(message)
    this.name = 'AccountContextError'
    this.code = code
    this.statusCode = statusCode
  }
}

export function getAccountIdFromRequest(request) {
  const rawAccountId = request.headers[ACCOUNT_ID_HEADER]
  const accountId = Array.isArray(rawAccountId) ? rawAccountId[0] : rawAccountId

  if (typeof accountId !== 'string' || accountId.trim() === '') {
    throw new AccountContextError('ACCOUNT_ID_REQUIRED', 401, 'X-Account-IDヘッダーが必要です。')
  }

  const normalizedAccountId = accountId.trim().toLowerCase()
  if (!UUID_PATTERN.test(normalizedAccountId)) {
    throw new AccountContextError('ACCOUNT_ID_INVALID', 400, 'X-Account-IDの形式が不正です。')
  }

  return normalizedAccountId
}
