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

### Docker Compose

開発環境では `docker-compose.yml` を使用する。

環境変数は `.env.dev` から読み込む。

```text
.env.dev
   ↓
docker-compose.yml
   ↓
Docker
├── frontend
├── backend
└── PostgreSQL
```

###  ビルド

```bash
docker compose --env-file .env.dev build
```

### コンテナの起動

```bash
docker compose --env-file .env.dev up
```

### 確認

```bash
docker compose ps
```

すべてのコンテナが `running` になっていれば起動成功です。

```text
NAME        SERVICE     STATUS
db          db          running
```

### 2回目以降の開発

一度セットアップが完了した後は、基本的に以下だけで開発を開始できます。

```bash
docker compose --env-file .env.dev up
```

コードやDockerfile、依存関係を変更した場合は、必要に応じて再ビルドします。

```bash
docker compose --env-file .env.dev up --build
```