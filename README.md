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
├── Docker
│   └── PostgreSQL
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

Docker Composeを使用してPostgreSQLを起動します。

```
docker compose --env-file .env.dev up -d
```

PostgreSQLの確認

```
docker compose ps
```

PostgreSQLのコンテナが running になっていれば起動成功です。

NAME        SERVICE     STATUS
db          db          running

Dockerコンテナの停止

開発終了時は以下を実行します。

```
docker compose down
```

PostgreSQLのデータを保持したままコンテナを停止します。

PostgreSQLを初期化する場合

データベースを完全に削除して最初からやり直す場合：

```
docker compose down -v
```

-v を付けるとPostgreSQLのVolumeも削除され、保存されているデータがすべて削除されます。