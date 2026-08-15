import axios from 'axios'

// Goバックエンドのエラーレスポンスは{"error": "..."}という技術的な英語文字列を返す
// (詳細を漏らさないための意図的な設計。各controllerのコメント参照)。
// Frontendではこれを既知のメッセージにマッピングし、日本語で表示する。
const ERROR_MESSAGE_MAP: Record<string, string> = {
  'file is required': 'PDFファイルを選択してください。',
  'file size must be 10MB or less': 'ファイルサイズは10MB以下にしてください。',
  'only pdf files are supported': 'PDFファイルを選択してください。',
  'uploaded file is not a valid pdf': 'PDFとして読み取れないファイルです。',
  'request must be multipart/form-data': 'PDFの送信形式が不正です。',
  'failed to read uploaded file': 'ファイルの読み取りに失敗しました。',
  'ai provider is not configured': 'AI解析が現在利用できません。',
  'ai analysis timed out': 'AI解析がタイムアウトしました。もう一度お試しください。',
  'failed to connect to ai provider': 'AIサービスへ接続できませんでした。',
  'ai provider returned an error': 'AIサービスからエラーが返されました。',
  'ai returned an invalid response': 'AIの出力形式が正しくありません。',
  'failed to analyze pdf': 'PDFの解析に失敗しました。',
  'candidate is invalid': '予定候補の内容が不正なため登録できません。',
  'account not found': 'アカウント情報を取得できませんでした。再度ログインしてください。',
  'google calendar is not connected': 'Google Calendarと連携してください。',
  'google reauthorization is required': 'Google Calendarとの連携を再度行ってください。',
  'failed to create calendar event': 'Google Calendarへの登録に失敗しました。',
  unauthorized: 'ログインが必要です。再度ログインしてください。',
  'invalid auth user id': 'ログイン情報が正しくありません。再度ログインしてください。',
  'failed to create authorization url': 'Google OAuthを開始できませんでした。',
  'failed to get connection status': 'Google Calendarの接続状態を取得できませんでした。',
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const payload: unknown = error.response?.data
    if (typeof payload === 'object' && payload !== null) {
      const raw = (payload as { error?: unknown }).error
      if (typeof raw === 'string' && raw.length > 0) {
        return ERROR_MESSAGE_MAP[raw] ?? fallback
      }
    }
  }

  return fallback
}
