# 商談ノート

スマホで使える、シンプルな営業案件管理 Web アプリです。

## 基本機能

- 顧客名・案件名・見積金額（円）・受注確度・次回アクションの登録と編集
- 案件の削除（確認画面あり）
- 顧客名・案件名・次回アクションの検索、受注状況の絞り込み、並び替え
- 案件数・見積総額・受注見込み額・受注案件数の集計
- ブラウザへの自動保存と、再読み込み時の復元
- スマホ・タブレット・PC に対応した画面

受注確度が 0% の案件は「見送り」、100% は「受注」、それ以外は「進行中」として表示します。受注見込み額は「見積金額 × 受注確度」の合計です。初期状態は空で、「まずはサンプルで試す」からサンプル案件を追加できます。

## 開発

Node.js 20.19 以上、または 22.12 以上が必要です。この環境では Node.js 24 で検証しています。

```sh
cd /workspace/codex-practice
npm ci
npm run dev
```

Vite の開発サーバーが起動します。別の端末から使う場合は、同じネットワーク上で開発サーバーのホストにアクセスしてください。

```sh
npm run build
npm run preview
```

本番向けファイルは `dist/` に生成されます。静的サイトとして配信できます。

## 動作確認

```sh
npm test
```

Playwright で登録・編集・保存・検索・集計・削除・入力検証・スマホ表示などを検証します。このクラウド環境では `/usr/bin/chromium` を使います。別の環境では、次の手順で Chromium を用意できます。

```sh
npx playwright install chromium
npm test
```

必要な場合は `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` で Chromium の実行ファイルを指定できます。

## iPhone の Safari で使う

iOS 15.4 以降の Safari に対応するブラウザ機能を使用しています。タッチ端末の入力欄は 16px 以上にして、入力時の自動拡大を防いでいます。

クラウド環境で起動したサーバーを iPhone から開くには、Web プレビューやポート転送による外部アクセス用 URL、または静的サイトの公開先が必要です。クラウド環境内の `localhost` や内部 IP アドレスは、iPhone から直接開けません。

サーバーは次のコマンドで `0.0.0.0:5173` に起動します。`--strictPort` により、5173 が使用中なら別ポートへ自動変更せずエラーを表示します。

```sh
npm run dev -- --port 5173 --strictPort
```

公開 URL のホスト名が Vite に拒否された場合は、その正確なホスト名を `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` 環境変数に指定して起動できます。

## GitHub Pages への公開

Vite の `base` を `./` にして、リポジトリ名のパス配下で動作するようにしています。

### iPhone で最初に行う操作

1. Safari で GitHub にログインし、[このリポジトリの Pages 設定](https://github.com/hukudai76kanaya-collab/codex-practice/settings/pages)を開きます。操作欄が表示されない場合は、Safari のページメニューから **デスクトップ用Webサイトを表示** を選びます。
2. **Build and deployment → Source** を **GitHub Actions** に設定します。`Deploy from a branch` は選びません。
3. [公開ワークフロー](https://github.com/hukudai76kanaya-collab/codex-practice/actions/workflows/deploy-pages.yml)を開き、**Run workflow** → **Branch: main** → 緑色の **Run workflow** を押します。
4. 新しく作成された実行を開きます。`build` と `deploy` が両方緑色になったら、**Settings → Pages → Visit site**、または実行画面の `github-pages` に表示される URL を Safari で開きます。更新がすぐに表示されない場合は、少し待って再読み込みします。

リポジトリは現在 Private です。GitHub Free では Public リポジトリでのみ Pages を使えます。Pages 設定にプラン変更の案内が表示された場合は、Private リポジトリの Pages に対応するプラン（個人アカウントでは GitHub Pro など）を利用するか、リポジトリを Public に変更してください。Public にするとソースコードも公開されます。

Public への変更は、[Settings → General](https://github.com/hukudai76kanaya-collab/codex-practice/settings)の下部にある **Danger Zone → Change repository visibility → Change visibility → Make public** から行います。確認画面の指示に従い、変更後に Pages の設定をやり直します。変更操作はリポジトリ管理者が行ってください。

### 失敗した場合

- **Configure GitHub Pages** で失敗: Source が **GitHub Actions** になっているか、現在のプランで Pages を使えるか確認します。設定後に **Run workflow** で新しい実行を開始してください。
- **Waiting** / **Review deployments**: `github-pages` 環境の承認が必要です。公開する実行を確認して、画面の **Review deployments** から承認してください。
- Actions 自体が無効の場合: 管理者が **Settings → Actions → General** で GitHub Actions と使用中の公式 `actions/*` を許可します。

一度設定すると、以降は `main` への push で自動的にサイトが更新されます。リポジトリの Source 設定はブラウザから行うため、個人アクセストークンをアプリに追加する必要はありません。

ワークフローは Node.js 24 で `npm ci` と本番ビルドを実行し、Pages の設定を確認して、生成した `dist/` を公開します。Actions 自体も Node.js 24 対応版を使っています。開発サーバーは公開後のサイト表示には不要です。

## 保存について

案件は利用中のブラウザの `localStorage` に保存されます。サーバーへの送信、ログイン、他端末との同期はありません。ブラウザのデータを削除すると案件も消えるため、現段階では画面と基本機能を試す用途を想定しています。

保存に失敗した場合はエラーを表示し、入力を残します。別タブで案件が変更された場合は、上書きを防ぐため再読み込みが必要です。
