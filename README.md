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

## Vertical Slice: PDF → AI抽出 → Action Decision

保護者がPDFをアップロードすると、サーバー側のAIが複数の行事・提出期限を抽出します。その後、Backendが決定論的に予定候補の扱いを判定し、画面に表示します。

Google Calendar OAuth / Calendar APIへの実登録はまだ行いません。

### 構成

- Frontend: React + TypeScript + Vite + Tailwind CSS
- API: Node.js標準HTTPサーバー
- AI: OpenAI Responses API（APIキーはサーバーのみで利用）
- PostgreSQL: 将来の履歴保存用。現在のVertical Sliceでは使用しない

### データフロー

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
候補別UI + 構造化JSON
```

LLMは事実抽出とconfidenceまでを出力します。`action_decision` と `action_reason` はLLMには持たせず、Backendが付与します。

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
| `CONFIRM_REQUIRED` | 確定日付あり、confidence 0.70〜0.89 |
| `BLOCKED` | 日付なし、曖昧日付、confidence < 0.70、または日付形式不正 |

source evidenceに「上旬」「頃」「来週」などが含まれる場合は、日付が具体化されていてもBackendが`BLOCKED`にします。

### 必要な環境

- Node.js 20.6以上
- npm
- OpenAI APIキー

### 起動方法

1. AI APIキーを設定します。

```bash
cp backend/.env.example backend/.env
```

`backend/.env` の `OPENAI_API_KEY` を実際のキーに変更してください。このファイルはGitへコミットしません。

2. バックエンドを起動します。

```bash
node --env-file=backend/.env backend/server.mjs
```

3. 別ターミナルでフロントエンドを起動します。

```bash
cd frontend
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開きます。フロントエンドは`/api/analyze`をViteのプロキシ経由でバックエンドへ送信します。

### テスト・確認コマンド

```bash
node --test backend/tests/*.test.mjs
node --check backend/server.mjs
cd frontend
npm run lint
npm run build
```

テストには以下のfixture/mockケースを含みます。

1. 行事1件
2. 行事＋提出期限
3. 複数行事
4. 「9月上旬」などの曖昧日付
5. 日程情報なし
6. 壊れたAI schema
7. AIが具体日付を出してもevidenceが「頃」のケース

### Google Calendar連携時の接続ポイント

Calendar API連携では、Backendの`calendar_candidates`に付与された`action_decision`を入口にします。

- `AUTO_CREATE`: OAuth済みユーザーのCalendarイベント作成処理へ渡す
- `CONFIRM_REQUIRED`: ユーザー確認後に作成処理へ渡す
- `BLOCKED`: Calendar APIへ渡さない

Calendar API用のOAuthトークンや登録処理は、LLM呼び出し処理とは分離して追加します。

## PostgreSQL

将来の履歴保存用にDocker ComposeでPostgreSQLを起動できます。現在のVertical SliceではDBを使用しません。

```bash
docker compose --env-file .env.dev up -d
```

停止する場合は以下を実行します。

```bash
docker compose down
```
