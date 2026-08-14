## Git 開発フロー

本プロジェクトでは、`main` ブランチで直接開発を行わない。

```text
main
 └── dev
      ├── feature/xxx
      ├── feature/yyy
      └── feature/zzz
```

1. `dev` を最新化する
2. `dev` から `feature/<機能名>` を作成する
3. featureブランチで開発・コミットする
4. featureブランチをPushする
5. GitHubで `feature/*` から `dev` へのPull Requestを作成する

## MVP: PDF → AI抽出 → Action Decision → Google Calendar

保護者がPDFをアップロードすると、サーバー側のAIが複数の行事・提出期限を抽出します。Backendがschema validationと決定論的なAction Decisionを行い、Google OAuth済みの場合だけ予定候補をGoogle Calendarへ登録できます。

### 構成

- Frontend: React + TypeScript + Vite + Tailwind CSS
- API: Node.js標準HTTPサーバー
- AI: OpenAI SDK Responses API（既定はOrcaRouter、OpenAI directへ切替可能。APIキーはBackendのみで利用）
- Google連携: 公式 `googleapis` Node.jsクライアント、OAuth 2.0 server-side web application
- Token保存: Supabase PostgreSQLの`google_calendar_connections`をBackendから直接参照・更新（OAuth stateはIn-memory）
- PostgreSQL: `DATABASE_URL`で接続。Google Calendar OAuth接続情報を保存し、将来の履歴保存にも利用

### OrcaRouter / OpenAI direct切替

AIリクエストは`backend/ai-client.mjs`に分離しています。既定ではOrcaRouterのOpenAI SDK互換`baseURL`を使い、現在のResponses API、PDFの`input_file`、Strict Structured Output、Backendのschema validation、Action Decisionを維持します。

`backend/.env`の基本設定は次のとおりです。

```dotenv
AI_PROVIDER=orcarouter
AI_BASE_URL=https://api.orcarouter.ai/v1
AI_API_KEY=replace-with-your-orcarouter-key
AI_MODEL=openai/gpt-4o-mini
AI_DEBUG=false
```

OpenAI directへ切り替えて切り分ける場合は、環境変数だけ変更します。

```dotenv
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=replace-with-your-openai-key
AI_MODEL=gpt-4.1-mini
```

`AI_MODEL`は環境変数から変更できます。OrcaRouterでは最初から`orcarouter/auto`を使わず、`openai/gpt-4o-mini`を既定の明示モデルにしています。`AI_DEBUG=true`の場合だけ、Backendログにprovider、要求モデル、OrcaRouterのresolved model、request IDなどの非秘密metadataを出力します。APIキーやToken、PDF本文はログ・Frontendレスポンスへ出しません。

OrcaRouterの実ネットワーク経路とPDF対応を確認するには、キーをBackendの`.env`だけに設定して、通常のPDF解析を実行します。キーがない環境では、テストがResponsesリクエスト形状とエラー処理をモック検証します。

### AI・予定登録のデータフロー

```text
PDF upload
  ↓
POST /api/analyze
  ↓
AI fact extraction（複数calendar_candidates）
  ↓
Backend schema validation
  ↓
Backend Action Decision
  ├─ AUTO_CREATE
  ├─ CONFIRM_REQUIRED
  └─ BLOCKED
  ↓
候補別UI
  ↓
POST /api/calendar/events
  ↓
Backendがcandidateを再検証・再判定
  ↓
Google OAuth token refresh
  ↓
Google Calendar Events API（primary calendar）
```

LLMは事実抽出とconfidenceだけを出力します。`action_decision`、`action_reason`、登録可否はLLMに決めさせず、Backendが毎回再計算します。

### Structured Output

```json
{
  "document_type": "school_notice",
  "summary": "遠足と参加同意書についてのお知らせ",
  "calendar_candidates": [
    {
      "kind": "event",
      "title": "秋の遠足",
      "date": "2026-09-04",
      "date_status": "exact",
      "start_time": "08:30",
      "end_time": null,
      "location": null,
      "items": ["弁当", "水筒"],
      "required_actions": [],
      "confidence": 0.97,
      "source_evidence": "9月4日（金）8時30分集合"
    }
  ],
  "general_items": [],
  "general_actions": []
}
```

`date_status` はAIによる事実抽出上の情報です。

- `exact`: PDFから日付が確定できる
- `ambiguous`: 「9月上旬」「月末」「来週」など具体化できない
- `missing`: 日程情報が存在しない

### Action Decisionルール

閾値は [`backend/action-decision.mjs`](backend/action-decision.mjs) に定数として定義しています。

| 状態 | 条件 |
|---|---|
| `AUTO_CREATE` | titleあり、確定日付、曖昧表現なし、confidence >= 0.90 |
| `CONFIRM_REQUIRED` | 確定日付あり、confidence 0.70〜0.89。登録には `confirmed: true` が必要 |
| `BLOCKED` | 日付なし、曖昧日付、confidence < 0.70、またはschema／日付形式不正 |

source evidenceに「上旬」「頃」「来週」などが含まれる場合は、日付が具体化されていてもBackendが`BLOCKED`にします。Calendar APIへ渡す直前にも同じ判定を行うため、Frontendから送られた判定値は信用しません。

### Google OAuthとCalendar API

以下のAPIをBackendに実装しています。

- `GET /api/google/auth/start`: stateを生成・保存し、認可URLだけを返す
- `GET /api/google/auth/callback`: stateを検証してcodeをtokenへ交換し、tokenをBackendだけに保存
- `GET /api/google/status`: Frontend向けに接続済みかどうかだけを返す
- `GET /api/google/connection/status`: `X-Account-ID`に紐づく接続状態だけを返す
- `POST /api/calendar/events`: candidateを再検証・再判定してGoogle Calendarへ登録

OAuth scopeは `https://www.googleapis.com/auth/calendar.events` のみです。`access_type: offline` を使用し、access tokenの期限が近い場合はrefresh tokenでBackendが自動更新します。refresh tokenが再認証時に返らない場合は、既存refresh tokenを保持します。

Backendは認証境界から渡される`X-Account-ID`ヘッダーをAccountIDとして取得します。featureブランチ内には既存の認証middlewareやTanStack Query導入がないため、現段階ではこのヘッダーを信頼できる認証層から付与する前提です。Frontend request bodyの`account_id`は受け付けず、AccountIDはUUID形式だけを許可します。

OAuth接続情報は`DATABASE_URL`で接続したPostgreSQLからAccountIDをキーに取得します。Supabase JS SDKは使わず、Node.jsの`pg`でparameterized queryを実行します。接続状態APIのレスポンスには`connected`だけを含め、access token・refresh token・client secretは返しません。

Calendarイベントの変換は以下です。

- `title` → `summary`
- `date + start_time` → `start.dateTime`
- `date`だけ → all-day event（`start.date`と翌日の`end.date`）
- `location` → `location`
- `items`、`required_actions`、`source_evidence` → `description`
- timezoneは`Asia/Tokyo`
- 終了時刻がなく開始時刻だけある場合は、MVPでは60分後を終了時刻として設定し、その旨をdescriptionに記載

同じアカウントで `kind + title + date + start_time` が一致するcandidateはSHA-256 fingerprintで重複判定し、既存のGoogle event情報を返します。

### Token保存と開発上の注意

OAuth tokenは`google_calendar_connections`テーブルへ保存します。`InMemoryOAuthStateStore`はOAuth callbackのstate一時保存だけに使います。access token、refresh token、client secretはFrontendへ返さず、ログにも出力しません。

DB接続が未設定の場合、OAuth接続状態・Calendar登録は503で停止します。OAuth接続情報を保存するテーブルは既存Supabase側に用意する前提で、Backendはmigrationを実行しません。

```text
Account
- id

GoogleCalendarConnection
- id
- account_id
- provider_user_id
- access_token
- refresh_token
- expires_at
- scopes
```

MVPでは最小scopeを使うためGoogle user IDを取得せず、`provider_user_id`はnullを許容しています。

### 必要な環境

- Node.js 20.6以上
- npm
- OrcaRouter APIキー（または切り分け用のOpenAI APIキー）
- Google CloudプロジェクトのOAuth Web Client ID／Secret
- Supabase PostgreSQLの`DATABASE_URL`

### 起動方法

1. Backendの依存関係をインストールします。

```bash
cd backend
npm install
cd ..
```

2. 環境変数ファイルを作成します。

```bash
cp backend/.env.example backend/.env
```

`backend/.env` に `AI_PROVIDER`、`AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`、`DATABASE_URL`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`を設定してください。実際のsecretをGitへコミットしないでください。

3. Backendを起動します。

```bash
cd backend
npm run dev
```

4. 別ターミナルでFrontendを起動します。

```bash
cd frontend
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開きます。Frontendの`/api`リクエストはVite proxy経由で http://localhost:3001 のBackendへ送信されます。

### Google Cloud Consoleでの手動設定

ローカルでOAuthを動かすには、次を一度設定します。

1. Google Cloud Consoleでプロジェクトを作成または選択する
2. **Google Calendar API**を有効化する
3. OAuth consent screenを設定する。Externalの場合は自分のGoogleアカウントをTest userへ追加する
4. CredentialsからOAuth Client IDを作成し、Application typeを**Web application**にする
5. Authorized redirect URIに次を完全一致で追加する

   `http://localhost:3001/api/google/auth/callback`

6. 発行されたClient IDとClient Secretを`backend/.env`へ設定する
7. `.env`の`GOOGLE_REDIRECT_URI`とConsoleのredirect URIが一致していることを確認する

Redirect URIが1文字でも異なる場合、Googleは`redirect_uri_mismatch`を返します。

### テスト・確認コマンド

```bash
cd backend
npm test
node --check server.mjs
node --check google-auth.mjs
node --check google-calendar.mjs

cd ../frontend
npm run lint
npm run build
```

テストには以下のAI／Action Decision／Google mockケースを含みます。

1. 行事1件
2. 行事＋提出期限
3. 複数行事
4. 「9月上旬」などの曖昧日付
5. 日程情報なし
6. 壊れたAI schema
7. evidence内の曖昧表現
8. OrcaRouter baseURL、Responses API、PDF `input_file`、Strict Structured Output
9. OpenAI direct切替とAPIキー非公開
10. AI upstream errorとtimeoutのBackendエラー化
11. OAuth URLとoffline scope
12. OAuth state不一致
13. AUTO_CREATE登録
14. CONFIRM_REQUIREDの確認前拒否／確認後登録
15. BLOCKEDの常時拒否
16. fingerprintによる重複登録防止
17. access token refreshとrefresh token保持
18. AccountIDヘッダーの401/400、parameterized query、DBエラー、Token非漏えい