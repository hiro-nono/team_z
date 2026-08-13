## Git 開発フロー

本プロジェクトでは、`main` ブランチで直接開発を行わない。

### ブランチ構成

```text
main
 └── dev
      ├── feature/xxx
      ├── feature/yyy
      └── feature/zzz
```

### 基本フロー

1. dev を最新化する
```
git checkout dev
git pull origin dev
```

2. dev から feature ブランチを作成する
```
git checkout -b feature/<機能名>
```

3. feature ブランチで開発する
```
git add .
git commit -m "変更内容"
```

4. feature ブランチをPushする
```
git push
```

5. GitHubで feature/* → dev のPull Requestを作成する
※ PRは確認後に`dev`へマージすること

## 開発環境
開発環境では、Docker Composeを使用してPostgreSQLを起動します。

FrontendとBackendはローカル環境で起動します。

開発環境
│
├── Frontend
│   └── Bun + React + TypeScript + Vite + Tailwind CSS
│
└── Backend
    └── Go + Gin

### フロントエンド
1. 依存関係をインストール
```
bun install
```

2. 起動

```
bun run dev
```

3. http://localhost:5173へアクセス

### バックエンド
1. 依存関係をインストール
```
go mod download
```

2. 起動
```
go run ./cmd/server
```

### DB

Supabase より提供されるAPIをつかって、PostgreSQLをしようします。

# ER図

```mermaid
erDiagram
    AUTH ||--|| ACCOUNT : has
    ACCOUNT ||--|| ACCOUNT_STATUS_LOG : has
    ACCOUNT ||--|| GOOGLE_CALENDAR_CONNECTION : has

    AUTH {
        uuid id PK
        string email
        string password
    }

    ACCOUNT {
        uuid id PK
        uuid auth_id FK
        string role
        string status
        datetime created_at
        datetime updated_at
    }

    ACCOUNT_STATUS_LOG {
        uuid id PK
        uuid account_id FK
        string event_type
        string status
        datetime created_at
    }

    GOOGLE_CALENDAR_CONNECTION {
        uuid id PK
        uuid account_id FK
        string provider
        string provider_id
        string access_token
        string refresh_token
        string expired_at
        datetime created_at
        datetime updated_at
    }
```