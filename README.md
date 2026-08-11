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
    ACCOUNT ||--o{ ACCOUNT_STATUS_LOG : has
    ACCOUNT ||--o{ ACCOUNT_PERMISSION_GRANT : has

    ACCOUNT ||--|| TEACHER : has
    TEACHER ||--o{ TEACHER_SCHOOL : belongs
    SCHOOL ||--o{ TEACHER_SCHOOL : has

    ACCOUNT ||--o{ GUARDIAN_STUDENT : guardian
    STUDENT ||--o{ GUARDIAN_STUDENT : student

    SCHOOL ||--o{ STUDENT_ENROLLMENT : has
    STUDENT ||--o{ STUDENT_ENROLLMENT : belongs

    ACCOUNT ||--o{ NEWS_INPUT : writes
    NEWS_INPUT ||--|| NEWS : generates

    ACCOUNT {
        uuid id PK
        uuid auth_id
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

    ACCOUNT_PERMISSION_GRANT {
        uuid id PK
        uuid account_id FK
        string permission
        datetime created_at
        datetime updated_at
    }

    SCHOOL {
        uuid id PK
        string name
        string type
        string prefecture
        string city
        datetime created_at
        datetime updated_at
    }

    TEACHER {
        uuid id PK
        uuid account_id FK
        string family_name
        string given_name
        datetime created_at
        datetime updated_at
    }

    TEACHER_SCHOOL {
        uuid id PK
        uuid teacher_id FK
        uuid school_id FK
        datetime started_at
        datetime ended_at
        datetime created_at
        datetime updated_at
    }

    STUDENT {
        uuid id PK
        string family_name
        string given_name
        datetime created_at
        datetime updated_at
    }

    GUARDIAN_STUDENT {
        uuid id PK
        uuid guardian_account_id FK
        uuid student_id FK
        datetime created_at
        datetime updated_at
    }

    CLASS {
        uuid id PK
        uuid school_id FK
        string grade
        string code
        string name
        string academic_year
        datetime created_at
        datetime updated_at
    }

    STUDENT_ENROLLMENT {
        uuid id PK
        uuid student_id FK
        uuid school_id FK
        string class_name
        string grade
        string academic_year
        datetime started_at
        datetime ended_at
        datetime created_at
        datetime updated_at
    }

    NEWS_INPUT {
        uuid id PK
        uuid author_id FK
    }

    NEWS {
        uuid id PK
        uuid news_input_id FK
    }
```