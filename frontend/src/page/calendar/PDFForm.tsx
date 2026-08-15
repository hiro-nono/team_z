import { type ChangeEvent, type DragEvent, useEffect, useState } from 'react'
import {
  useAnalyzePdfMutation,
  useGoogleStatusQuery,
  useRegisterCalendarEventMutation,
  useStartGoogleAuthMutation,
} from '../../hooks/calendar'
import type { ActionDecision, CalendarCandidate, CalendarCandidateWithDecision, DateStatus, SchoolNoticeWithDecision } from '../../type'
import { candidateKey } from './actionDecision'
import { getErrorMessage } from './errorMessages'

type RegistrationState = 'loading' | 'success' | 'error'

type RegistrationResult = {
  state: RegistrationState
  message: string
  htmlLink: string | null
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

const DECISION_STYLES: Record<ActionDecision, { label: string; icon: string; className: string }> = {
  AUTO_CREATE: {
    label: '自動登録可能',
    icon: '✓',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  CONFIRM_REQUIRED: {
    label: '確認が必要',
    icon: '!',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  BLOCKED: {
    label: '登録できません',
    icon: '×',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  },
}

function isSchoolNotice(value: unknown): value is SchoolNoticeWithDecision {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const notice = value as Record<string, unknown>
  return (
    notice.document_type === 'school_notice' &&
    typeof notice.summary === 'string' &&
    Array.isArray(notice.calendar_candidates) &&
    Array.isArray(notice.general_items) &&
    Array.isArray(notice.general_actions)
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(date: string | null, dateStatus: DateStatus) {
  if (date) {
    return date.replaceAll('-', '/')
  }

  return dateStatus === 'ambiguous' ? '日付が曖昧' : '日付未定'
}

function formatSchedule(candidate: CalendarCandidate) {
  const date = formatDate(candidate.date, candidate.date_status)
  const times = [candidate.start_time, candidate.end_time].filter((time): time is string => time !== null)
  return times.length > 0 ? `${date} ${times.join('〜')}` : date
}

function CandidateCard({
  candidate,
  registration,
  onRegister,
}: {
  candidate: CalendarCandidateWithDecision
  registration?: RegistrationResult
  onRegister: (candidate: CalendarCandidateWithDecision) => void
}) {
  const decisionStyle = DECISION_STYLES[candidate.action_decision]
  const kindLabel = candidate.kind === 'event' ? '行事' : '提出期限'
  const isLoading = registration?.state === 'loading'

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{kindLabel}</span>
            <span className="text-xs text-slate-500">信頼度 {Math.round(candidate.confidence * 100)}%</span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-950">{candidate.title || 'タイトル未抽出'}</h3>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${decisionStyle.className}`}>
          <span aria-hidden="true">{decisionStyle.icon}</span>
          {decisionStyle.label}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-slate-500">予定日時</p>
          <p className="mt-1 font-semibold text-slate-900">{formatSchedule(candidate)}</p>
        </div>
        {candidate.location && (
          <div>
            <p className="text-xs font-medium text-slate-500">場所</p>
            <p className="mt-1 text-slate-900">{candidate.location}</p>
          </div>
        )}
      </div>

      {(candidate.items.length > 0 || candidate.required_actions.length > 0) && (
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
          {candidate.items.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500">持ち物</p>
              <p className="mt-1 text-slate-900">{candidate.items.join('、')}</p>
            </div>
          )}
          {candidate.required_actions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500">必要な行動</p>
              <p className="mt-1 text-slate-900">{candidate.required_actions.join('、')}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm">
        <p className="text-xs font-medium text-slate-500">判定理由</p>
        <p className="mt-1 text-slate-700">{candidate.action_reason}</p>
      </div>
      <p className="mt-3 border-l-2 border-slate-300 pl-3 text-xs leading-5 text-slate-500">根拠：「{candidate.source_evidence}」</p>

      {candidate.action_decision !== 'BLOCKED' && (
        <button
          type="button"
          onClick={() => onRegister(candidate)}
          disabled={isLoading}
          className="mt-4 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
        >
          {isLoading ? 'Google Calendarへ登録中…' : candidate.action_decision === 'AUTO_CREATE' ? 'Google Calendarに登録' : '内容を確認して登録'}
        </button>
      )}

      {registration?.state === 'success' && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <p className="font-semibold">✓ {registration.message}</p>
          {registration.htmlLink && (
            <a className="mt-1 inline-block underline" href={registration.htmlLink} target="_blank" rel="noreferrer">Google Calendarで開く</a>
          )}
        </div>
      )}
      {registration?.state === 'error' && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{registration.message}</p>}
    </article>
  )
}

function PDFForm() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<SchoolNoticeWithDecision | null>(null)
  const [error, setError] = useState('')
  const [googleMessage, setGoogleMessage] = useState(() => {
    const googleResult = new URLSearchParams(window.location.search).get('google')
    if (googleResult === 'connected') {
      return 'Google Calendarと接続しました。'
    }
    if (googleResult === 'error') {
      return 'Google Calendarとの接続に失敗しました。もう一度お試しください。'
    }
    return ''
  })
  const [registrations, setRegistrations] = useState<Record<string, RegistrationResult>>({})

  const googleStatusQuery = useGoogleStatusQuery()
  const startGoogleAuthMutation = useStartGoogleAuthMutation()
  const analyzePdfMutation = useAnalyzePdfMutation()
  const registerCalendarEventMutation = useRegisterCalendarEventMutation()

  const isGoogleConnected = googleStatusQuery.data?.connected ?? false
  const isGoogleLoading = googleStatusQuery.isLoading || startGoogleAuthMutation.isPending
  const isAnalyzing = analyzePdfMutation.isPending

  useEffect(() => {
    const googleResult = new URLSearchParams(window.location.search).get('google')
    if (!googleResult) {
      return
    }

    window.history.replaceState({}, '', window.location.pathname)
    if (googleResult === 'connected') {
      void googleStatusQuery.refetch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectFile = (nextFile: File | undefined) => {
    setError('')
    setResult(null)
    setRegistrations({})

    if (!nextFile) {
      return
    }

    const isPdf = nextFile.type === 'application/pdf' || nextFile.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setFile(null)
      setError('PDFファイルを選択してください。')
      return
    }

    if (nextFile.size > MAX_FILE_SIZE_BYTES) {
      setFile(null)
      setError('ファイルサイズは10MB以下にしてください。')
      return
    }

    setFile(nextFile)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    selectFile(event.target.files?.[0])
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    selectFile(event.dataTransfer.files[0])
  }

  const handleAnalyze = () => {
    if (!file || isAnalyzing) {
      return
    }

    setError('')
    setResult(null)
    setRegistrations({})

    analyzePdfMutation.mutate(file, {
      onSuccess: (payload) => {
        if (!isSchoolNotice(payload)) {
          setError('AIの出力形式が正しくありません。')
          return
        }

        setResult(payload)
      },
      onError: (caughtError) => {
        setError(getErrorMessage(caughtError, 'PDFの解析に失敗しました。'))
      },
    })
  }

  const handleGoogleConnect = () => {
    setGoogleMessage('')

    startGoogleAuthMutation.mutate(undefined, {
      onSuccess: (data) => {
        window.location.assign(data.url)
      },
      onError: (caughtError) => {
        setGoogleMessage(getErrorMessage(caughtError, 'Google OAuthを開始できませんでした。'))
      },
    })
  }

  const handleRegister = (candidate: CalendarCandidateWithDecision) => {
    const key = candidateKey(candidate)
    setRegistrations((current) => ({
      ...current,
      [key]: { state: 'loading', message: '', htmlLink: null },
    }))

    registerCalendarEventMutation.mutate({
      candidate,
      confirmed: candidate.action_decision === 'CONFIRM_REQUIRED',
    }, {
      onSuccess: (data) => {
        setRegistrations((current) => ({
          ...current,
          [key]: {
            state: 'success',
            message: data.duplicate ? 'この予定はすでに登録済みです。' : 'Google Calendarに登録しました。',
            htmlLink: data.event.htmlLink || null,
          },
        }))
      },
      onError: (caughtError) => {
        setRegistrations((current) => ({
          ...current,
          [key]: {
            state: 'error',
            message: getErrorMessage(caughtError, 'Google Calendarへの登録に失敗しました。'),
            htmlLink: null,
          },
        }))
      },
    })
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold tracking-wide text-indigo-600">学校のおたより整理AI</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                PDFをアップロードして、予定候補を安全に整理
              </h1>
            </div>
            <button
              type="button"
              onClick={handleGoogleConnect}
              disabled={isGoogleLoading || isGoogleConnected}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-default ${isGoogleConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-300'}`}
            >
              {isGoogleConnected ? '✓ Google Calendar 接続済み' : isGoogleLoading ? '接続状態を確認中…' : 'Google Calendarと連携'}
            </button>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            AIが抽出した予定候補をBackendが確認し、自動登録・要確認・登録不可に分類します。登録前にもBackendが判定を再計算します。
          </p>
          {googleMessage && <p className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700" role="status">{googleMessage}</p>}
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="upload-heading">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 id="upload-heading" className="text-lg font-semibold text-slate-950">おたよりPDF</h2>
              <p className="mt-1 text-sm text-slate-500">PDF形式・10MB以下</p>
            </div>
            {file && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">選択済み</span>}
          </div>

          <label
            htmlFor="pdf-file"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 text-center transition hover:border-indigo-400 hover:bg-indigo-50/40 focus-within:border-indigo-500"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-2xl text-indigo-600" aria-hidden="true">↑</span>
            <span className="mt-4 text-sm font-semibold text-slate-800">クリックまたはドラッグ＆ドロップ</span>
            <span className="mt-1 text-xs text-slate-500">PDFファイルを1つ選択</span>
            <input id="pdf-file" type="file" accept="application/pdf,.pdf" onChange={handleFileChange} className="sr-only" />
          </label>

          {file && (
            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <span className="min-w-0 truncate font-medium text-slate-700">{file.name}</span>
              <span className="shrink-0 text-slate-500">{formatFileSize(file.size)}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!file || isAnalyzing}
            className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isAnalyzing ? 'AIが解析しています…' : 'PDFを解析する'}
          </button>

          {isAnalyzing && <p className="mt-3 text-center text-xs text-slate-500" role="status">PDFの内容を読み取り、予定候補を確認しています。</p>}
          {error && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p>}
        </section>

        {result && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="result-heading">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Action decision</p>
              <h2 id="result-heading" className="mt-1 text-xl font-semibold text-slate-950">解析結果</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{result.summary || '要約はありません。'}</p>
            </div>

            {result.calendar_candidates.length > 0 ? (
              <div className="mt-6 space-y-4">
                {result.calendar_candidates.map((candidate, index) => (
                  <CandidateCard
                    key={`${candidate.title}-${candidate.date ?? candidate.date_status}-${index}`}
                    candidate={candidate}
                    registration={registrations[candidateKey(candidate)]}
                    onRegister={handleRegister}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">予定候補は見つかりませんでした。</p>
            )}

            {(result.general_items.length > 0 || result.general_actions.length > 0) && (
              <div className="mt-6 grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-2">
                {result.general_items.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">全体の持ち物</h3>
                    <p className="mt-2 text-sm text-slate-600">{result.general_items.join('、')}</p>
                  </div>
                )}
                {result.general_actions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">全体の必要な行動</h3>
                    <p className="mt-2 text-sm text-slate-600">{result.general_actions.join('、')}</p>
                  </div>
                )}
              </div>
            )}

            <details className="mt-6 overflow-hidden rounded-lg border border-slate-200">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">構造化JSONを表示</summary>
              <pre className="overflow-x-auto border-t border-slate-200 bg-slate-950 p-4 text-xs leading-6 text-emerald-300">{JSON.stringify(result, null, 2)}</pre>
            </details>
          </section>
        )}
      </div>
    </main>
  )
}

export default PDFForm
