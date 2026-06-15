# 公式 LINE 連携手順（学生セルフ貸出）

図書館保守システムの学生向け貸出を、**公式 LINE の LIFF** から開き、LINE アカウントでログインするための設定手順です。

**Phase 1 のゴール**

1. 公式 LINE のリッチメニューから「本を借りる」をタップ
2. LIFF で `student-borrow.html` が開く
3. 初回のみ学籍番号＋生年月日で学生マスタと紐づけ
4. 2回目以降は LINE だけで貸出画面へ（機種変更後も同じ LINE なら OK）

学籍番号＋パスワードログインは **予備** として残しています。

---

## 0. 事前準備

| 項目 | 内容 |
|------|------|
| 公式 LINE アカウント | 開設済みであること |
| LINE Developers | [https://developers.line.biz/](https://developers.line.biz/) にログイン |
| Supabase プロジェクト | `bpfytlurmubgmzaisonp`（本番と同じ） |
| 本番 URL | `https://asamikinura630.github.io/libraly_app/student-borrow.html` |
| Supabase CLI | Edge Function デプロイ用（後述） |

**DB マイグレーション（先に実行）**

Supabase SQL Editor で次を実行してください。

```
sql/20260617_add_line_user_id.sql
```

（学生セルフ貸出をまだ入れていない場合は `20260616_student_self_service.sql` も先に実行）

---

## 1. LINE Login チャネル（Messaging API と同じプロバイダー）

多くの場合、**既存の Messaging API チャネル** に LIFF を追加します。

1. [LINE Developers Console](https://developers.line.biz/console/) を開く
2. 対象の **プロバイダー** → **Messaging API チャネル** を選択
3. **Basic settings** タブで次をメモする
   - **Channel ID**（数字）→ 後で `LINE_CHANNEL_ID` に設定
   - **Channel secret** → `LINE_SESSION_SECRET` の元にも使えます（任意の長いランダム文字列でも可）

### LINE Login 設定（チャネルに Login が無い場合）

1. 同じプロバイダーで **LINE Login** チャネルを新規作成してもよい
2. **LIFF** は Messaging API チャネル側に追加するのが一般的
3. **Channel ID** は LIFF 作成時に使う ID と一致させる（Messaging API チャネルの Channel ID）

---

## 2. LIFF アプリの作成

1. 対象チャネル → **LIFF** タブ → **追加**
2. 次のように入力

| 項目 | 設定値 |
|------|--------|
| LIFF app name | `図書館セルフ貸出`（任意） |
| Size | **Full**（推奨） |
| Endpoint URL | `https://asamikinura630.github.io/libraly_app/student-borrow.html` |
| Scope | **profile** にチェック（`openid` は通常自動） |
| Bot link feature | **On（Aggressive）** 推奨 — 友だち未追加時に誘導 |

3. 作成後、**LIFF ID**（例: `1234567890-AbCdEfGh`）をコピー

### アプリ側の設定

`js/line-config.js` を開き、LIFF ID を貼り付けます。

```javascript
LIFF_ID: "1234567890-AbCdEfGh",  // ← ここに貼り付け
```

保存後、GitHub に push すると GitHub Pages に反映されます。

---

## 3. 公式 LINE リッチメニュー

1. [LINE Official Account Manager](https://manager.line.biz/) を開く
2. 対象アカウント → **リッチメニュー** → 作成
3. 例: ボタン「本を借りる」
4. アクション: **リンク**
   - URL: LIFF URL（Developers の LIFF 一覧に表示）

   形式例:

   ```
   https://liff.line.me/1234567890-AbCdEfGh
   ```

5. リッチメニューを **公開・デフォルトに設定**

---

## 4. Supabase Edge Function のデプロイ

ID トークンの検証はブラウザでは行わず、**Edge Function `line-auth`** で行います。

### 4.1 シークレットの登録

Supabase Dashboard → **Project Settings** → **Edge Functions** → **Secrets**

| 名前 | 値 |
|------|-----|
| `LINE_CHANNEL_ID` | Messaging API チャネルの Channel ID |
| `LINE_SESSION_SECRET` | Channel secret または 32文字以上のランダム文字列 |

`SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` は Supabase が自動注入します。

### 4.2 CLI でデプロイ（初回のみ）

プロジェクトルート（`libraly_app`）で:

```bash
# Supabase CLI 未導入の場合: https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref bpfytlurmubgmzaisonp
supabase functions deploy line-auth --no-verify-jwt
```

`--no-verify-jwt` は GitHub Pages から anon キーで呼ぶため付けています（関数内で ID トークンを検証）。

### 4.3 動作確認（curl）

LIFF から取得した ID トークンで（開発時）:

```bash
curl -X POST "https://bpfytlurmubgmzaisonp.supabase.co/functions/v1/line-auth" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"action":"login","id_token":"<LINE_ID_TOKEN>"}'
```

未紐づけの LINE なら `{"needs_link":true,...}` が返ります。

---

## 5. 学生の利用フロー

### 初回

1. 公式 LINE を友だち追加
2. リッチメニュー「本を借りる」
3. 「LINE アカウントと学籍番号の紐づけ」画面
4. 学籍番号・生年月日（YYYYMMDD）を入力
5. 紐づけ成功 → QR スキャン貸出画面

### 2回目以降（機種変更後も同じ）

1. 公式 LINE → 「本を借りる」
2. 自動ログイン → すぐ QR スキャン画面

### LINE アカウントを変えた場合

再度 **学籍番号＋生年月日** で紐づけ（職員が `line_user_id` をクリアする運用も可）。

---

## 6. トラブルシューティング

| 症状 | 確認すること |
|------|----------------|
| LIFF が真っ白 | `line-config.js` の LIFF_ID、Endpoint URL が本番 URL と一致しているか |
| 「サーバー設定が未完了」 | Edge Function の Secrets（`LINE_CHANNEL_ID` 等） |
| 「ID トークンの検証に失敗」 | Channel ID が LIFF のチャネルと一致しているか |
| 「line_user_id 列がない」 | `20260617_add_line_user_id.sql` を実行したか |
| カメラが起動しない | LINE アプリ内でカメラ権限、HTTPS であること |
| ブラウザ直開き | LINE ログインは **LIFF（LINE アプリ内）** 推奨。直開きは学籍番号ログインを利用 |

---

## 7. セキュリティメモ

- LINE User ID は **LINE アカウント** に紐づく（機種変更しても同じアカウントなら不変）
- ID トークンは **Edge Function のみ** で検証
- 学籍番号＋パスワード方式は LINE 不調時の **予備経路**

---

## 8. 関連ファイル

| ファイル | 役割 |
|----------|------|
| `js/line-config.js` | LIFF ID 設定 |
| `js/line-liff.js` | LIFF 初期化・API 呼び出し |
| `supabase/functions/line-auth/index.ts` | ID トークン検証・紐づけ |
| `sql/20260617_add_line_user_id.sql` | `line_user_id` 列 |
| `student-borrow.html` | 学生貸出 UI（LINE 対応） |

---

## 改訂履歴

| 版 | 日付 | 内容 |
|----|------|------|
| 1.0 | 2026-06-12 | Phase 1（LIFF ログイン・紐づけ・貸出画面）初版 |
