package model

// SchoolNoticeSystemPrompt はOrcaRouterに送るSystem Promptで、
// 事実抽出のみを行わせ、カレンダー登録可否やAction Decisionを出力させないためのルールを与える
const SchoolNoticeSystemPrompt = `あなたは学校・保育園のおたよりから、予定と保護者の行動を抽出するAIです。
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
- 曜日だけから日付を推測しない。現在日時から日付を推測しない。
- 時刻がPDFに書かれていない場合、start_timeとend_timeはnullにする。時刻を推測しない。
- locationもPDFに書かれていない場合はnullにする。
- itemsには、その候補に直接関係する持ち物だけを入れる。
- required_actionsには、その候補に直接関係する提出・記入・参加確認などだけを入れる。
- 候補ごとに、判断根拠となった短い原文をsource_evidenceへ入れる。原文がない候補は作らない。
- confidenceは、抽出した候補の事実関係に対する信頼度を0から1で出す。登録可否の判断には使わない。
- 候補に紐づかない持ち物はgeneral_itemsへ、候補に紐づかない行動はgeneral_actionsへ入れる。
- 推測や補完はせず、見つからない情報はnullまたは空配列にする。
- 説明文やMarkdownは出力しない。JSONだけを返す。`

// SchoolNoticeJSONSchema はOrcaRouterのStructured Output(text.format.json_schema)に渡すJSON Schema。
// strict:trueで送るため、null許容フィールドも"type":["string","null"]で明示し、
// 全プロパティをrequiredに含め、additionalPropertiesはfalseにする。
var SchoolNoticeJSONSchema = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"document_type": map[string]any{
			"type": "string",
			"enum": []string{"school_notice"},
		},
		"summary": map[string]any{
			"type": "string",
		},
		"calendar_candidates": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"kind": map[string]any{
						"type": "string",
						"enum": []string{"event", "deadline"},
					},
					"title": map[string]any{
						"type": "string",
					},
					"date": map[string]any{
						"type": []string{"string", "null"},
					},
					"date_status": map[string]any{
						"type": "string",
						"enum": []string{"exact", "ambiguous", "missing"},
					},
					"start_time": map[string]any{
						"type": []string{"string", "null"},
					},
					"end_time": map[string]any{
						"type": []string{"string", "null"},
					},
					"location": map[string]any{
						"type": []string{"string", "null"},
					},
					"items": map[string]any{
						"type":  "array",
						"items": map[string]any{"type": "string"},
					},
					"required_actions": map[string]any{
						"type":  "array",
						"items": map[string]any{"type": "string"},
					},
					"confidence": map[string]any{
						"type":    "number",
						"minimum": 0,
						"maximum": 1,
					},
					"source_evidence": map[string]any{
						"type": "string",
					},
				},
				"required": []string{
					"kind",
					"title",
					"date",
					"date_status",
					"start_time",
					"end_time",
					"location",
					"items",
					"required_actions",
					"confidence",
					"source_evidence",
				},
				"additionalProperties": false,
			},
		},
		"general_items": map[string]any{
			"type":  "array",
			"items": map[string]any{"type": "string"},
		},
		"general_actions": map[string]any{
			"type":  "array",
			"items": map[string]any{"type": "string"},
		},
	},
	"required": []string{
		"document_type",
		"summary",
		"calendar_candidates",
		"general_items",
		"general_actions",
	},
	"additionalProperties": false,
}
