export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export const DATE_STATUS = Object.freeze({
  EXACT: 'exact',
  AMBIGUOUS: 'ambiguous',
  MISSING: 'missing',
})

export const AMBIGUOUS_DATE_PATTERN = /(上旬|中旬|下旬|前半|後半|月初|月末|頃|ごろ|ころ|未定|近日|来週|再来週|今週)/u

export const NOTICE_SCHEMA = {
  type: 'object',
  properties: {
    document_type: { type: 'string', enum: ['school_notice'] },
    summary: { type: 'string' },
    calendar_candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['event', 'deadline'] },
          title: { type: 'string' },
          date: { type: ['string', 'null'] },
          date_status: { type: 'string', enum: ['exact', 'ambiguous', 'missing'] },
          start_time: { type: ['string', 'null'] },
          end_time: { type: ['string', 'null'] },
          location: { type: ['string', 'null'] },
          items: { type: 'array', items: { type: 'string' } },
          required_actions: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          source_evidence: { type: 'string' },
        },
        required: [
          'kind',
          'title',
          'date',
          'date_status',
          'start_time',
          'end_time',
          'location',
          'items',
          'required_actions',
          'confidence',
          'source_evidence',
        ],
        additionalProperties: false,
      },
    },
    general_items: { type: 'array', items: { type: 'string' } },
    general_actions: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'document_type',
    'summary',
    'calendar_candidates',
    'general_items',
    'general_actions',
  ],
  additionalProperties: false,
}

export const SYSTEM_PROMPT = `あなたは学校・保育園のおたよりから、予定と保護者の行動を抽出するAIです。
PDFの内容だけを根拠に、指定されたJSON Schemaに厳密に従って回答してください。

重要な抽出ルール:
- これは事実抽出です。カレンダー登録可否やアクション判定は出力しないでください。
- document_typeは必ず"school_notice"にする。
- summaryにはおたより全体の短い要約を入れる。
- calendar_candidatesには、行事または提出期限など、日付に関係する情報を1件ずつ入れる。
- 日付がPDFから完全に確定できる場合だけdateをYYYY-MM-DDにし、date_statusを"exact"にする。
- 年を含めた日付がPDFから確定できない場合、dateはnullにし、date_statusを"ambiguous"にする。
- 「9月上旬」「月末」「来週」「頃」などの曖昧な日付は具体的な日付へ変換しない。dateはnull、date_statusは"ambiguous"にする。
- 日付に関する情報が見つからない場合、dateはnull、date_statusは"missing"にする。
- 時刻がPDFに書かれていない場合、start_timeとend_timeはnullにする。時刻を推測しない。
- locationもPDFに書かれていない場合はnullにする。
- itemsには、その候補に直接関係する持ち物だけを入れる。
- required_actionsには、その候補に直接関係する提出・記入・参加確認などだけを入れる。
- 候補ごとに、判断根拠となった短い原文をsource_evidenceへ入れる。原文がない候補は作らない。
- confidenceは、抽出した候補の事実関係に対する信頼度を0から1で出す。登録可否の判断には使わない。
- 候補に紐づかない持ち物はgeneral_itemsへ、候補に紐づかない行動はgeneral_actionsへ入れる。
- 推測や補完はせず、見つからない情報はnullまたは空配列にする。
- 説明文やMarkdownは出力しない。JSONだけを返す。`

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00Z`)
  return date.toISOString().slice(0, 10) === value
}

export function validateCandidate(candidate, index = 0) {
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return `calendar_candidates[${index}]がオブジェクトではありません。`
  }

  const requiredKeys = [
    'kind',
    'title',
    'date',
    'date_status',
    'start_time',
    'end_time',
    'location',
    'items',
    'required_actions',
    'confidence',
    'source_evidence',
  ]

  const missingKey = requiredKeys.find((key) => !(key in candidate))
  if (Object.keys(candidate).some((key) => !requiredKeys.includes(key)) || missingKey) {
    if (missingKey) {
      return `calendar_candidates[${index}].${missingKey}がありません。`
    }
    return `calendar_candidates[${index}]に必要な項目が揃っていません。`
  }

  if (!['event', 'deadline'].includes(candidate.kind) || typeof candidate.title !== 'string') {
    return `calendar_candidates[${index}]のkindまたはtitleが不正です。`
  }

  if (!Object.values(DATE_STATUS).includes(candidate.date_status)) {
    return `calendar_candidates[${index}].date_statusが不正です。`
  }

  if (candidate.date !== null && (typeof candidate.date !== 'string' || !isValidDate(candidate.date))) {
    return `calendar_candidates[${index}].dateはYYYY-MM-DDまたはnullで指定してください。`
  }

  if (candidate.date_status === DATE_STATUS.EXACT && candidate.date === null) {
    return `calendar_candidates[${index}]がexactなのにdateがnullです。`
  }

  if (candidate.date_status !== DATE_STATUS.EXACT && candidate.date !== null) {
    return `calendar_candidates[${index}]がexact以外なのにdateが設定されています。`
  }

  for (const key of ['start_time', 'end_time']) {
    if (candidate[key] !== null && (typeof candidate[key] !== 'string' || !TIME_PATTERN.test(candidate[key]))) {
      return `calendar_candidates[${index}].${key}はHH:mmまたはnullで指定してください。`
    }
  }

  if (candidate.location !== null && typeof candidate.location !== 'string') {
    return `calendar_candidates[${index}].locationは文字列またはnullで指定してください。`
  }

  for (const key of ['items', 'required_actions']) {
    if (!Array.isArray(candidate[key]) || candidate[key].some((item) => typeof item !== 'string')) {
      return `calendar_candidates[${index}].${key}は文字列の配列で指定してください。`
    }
  }

  if (typeof candidate.confidence !== 'number' || !Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1) {
    return `calendar_candidates[${index}].confidenceは0から1の数値で指定してください。`
  }

  if (typeof candidate.source_evidence !== 'string' || candidate.source_evidence.trim() === '') {
    return `calendar_candidates[${index}].source_evidenceは必須です。`
  }

  return null
}

export function validateNotice(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return 'AIの出力がオブジェクトではありません。'
  }

  const requiredKeys = ['document_type', 'summary', 'calendar_candidates', 'general_items', 'general_actions']
  if (Object.keys(value).some((key) => !requiredKeys.includes(key)) || requiredKeys.some((key) => !(key in value))) {
    return 'AIの出力に必要な項目が揃っていません。'
  }

  if (value.document_type !== 'school_notice' || typeof value.summary !== 'string') {
    return 'document_typeまたはsummaryの形式が不正です。'
  }

  if (!Array.isArray(value.calendar_candidates)) {
    return 'calendar_candidatesは配列で指定してください。'
  }

  for (const [index, candidate] of value.calendar_candidates.entries()) {
    const error = validateCandidate(candidate, index)
    if (error) {
      return error
    }
  }

  for (const key of ['general_items', 'general_actions']) {
    if (!Array.isArray(value[key]) || value[key].some((item) => typeof item !== 'string')) {
      return `${key}は文字列の配列で指定してください。`
    }
  }

  return null
}

export function isValidExactDate(value) {
  return typeof value === 'string' && isValidDate(value)
}
