import { useMutation, useQuery } from '@tanstack/react-query'
import { privateApi, publicApi } from '../../axios'
import { PrivateGcTime, PrivateStaleTime } from '../cache'
import type {
  CalendarCandidate,
  CalendarEventResultType,
  GoogleAuthStartType,
  GoogleStatusType,
  SchoolNoticeWithDecision,
} from '../../type'

// query
const fetchGoogleStatus = async (): Promise<GoogleStatusType> => {
  const { data } = await privateApi.get<GoogleStatusType>('/api/google/status')
  return data
}

// func
// Google Calendarの連携状態確認(GET /api/google/status)
export const useGoogleStatusQuery = () =>
  useQuery<GoogleStatusType, Error, GoogleStatusType, ['google_status']>({
    queryKey: ['google_status'],
    queryFn: fetchGoogleStatus,
    staleTime: PrivateStaleTime,
    gcTime: PrivateGcTime,
    retry: false,
  })

// mutation
const startGoogleAuth = async (): Promise<GoogleAuthStartType> => {
  const { data } = await privateApi.post<GoogleAuthStartType>('/api/google/auth/start')
  return data
}

// func
// Google OAuth同意画面へのリダイレクト先URLを取得する(POST /api/google/auth/start)
export const useStartGoogleAuthMutation = () =>
  useMutation<GoogleAuthStartType, Error, void>({
    mutationFn: startGoogleAuth,
  })

// mutation
// action_decision/action_reasonはBackend(Go)がcandidateごとに計算して返す
const analyzePdf = async (file: File): Promise<SchoolNoticeWithDecision> => {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await publicApi.post<SchoolNoticeWithDecision>('/api/analyze', formData)
  return data
}

// func
// アップロードしたPDFをAI解析する(POST /api/analyze)
export const useAnalyzePdfMutation = () =>
  useMutation<SchoolNoticeWithDecision, Error, File>({
    mutationFn: analyzePdf,
  })

type RegisterCalendarEventInput = {
  candidate: CalendarCandidate
  confirmed: boolean
}

// mutation
// confirmedはaction_decisionがCONFIRM_REQUIREDの候補をユーザーが確認済みであることを示す。
// Backendはconfirmed=falseのままCONFIRM_REQUIRED/BLOCKEDの候補を登録させない。
const registerCalendarEvent = async ({ candidate, confirmed }: RegisterCalendarEventInput): Promise<CalendarEventResultType> => {
  const { data } = await privateApi.post<CalendarEventResultType>('/api/calendar/events', { candidate, confirmed })
  return data
}

// func
// 予定候補をGoogle Calendarへ登録する(POST /api/calendar/events)
export const useRegisterCalendarEventMutation = () =>
  useMutation<CalendarEventResultType, Error, RegisterCalendarEventInput>({
    mutationFn: registerCalendarEvent,
  })
