# 公式 LINE 連携手順（学生セルフ貸出）

> **汎用マニュアル（新規プロジェクト用）:** [`10_Supabase×公式LINE連携バイブル.md`](./10_Supabase×公式LINE連携バイブル.md)

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
sql/20260618_line_reminder_settings.sql
sql/20260619_line_reminder_log.sql
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
| Scope | **profile** と **openid** の両方にチェック（openid が無いと ID トークンが取れません） |
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

## 5. LINE 返却リマインド（Phase 2）

未返却の貸出について、LINE で返却を促す push 通知を送ります。**テスト環境では職員画面でオフ（デフォルト）** のまま運用してください。

### 5.1 送信タイミング（すべて JST 20:00）

| 種別 | 条件 |
|------|------|
| 返却3日前 | 返却予定日の 3 日前 |
| 返却前日 | 返却予定日の **前日**（当日朝ではなく前夜に通知） |
| 延滞 | 返却予定日を過ぎても未返却（毎日 20:00） |

### 5.2 職員画面でのオン/オフ

1. 職員で `index.html` にログイン
2. 「LINE 返却リマインド」カードのチェックボックスで有効/無効を切り替え
3. **デフォルトはオフ**。有料プラン移行の目処が立ってからオンにする

### 5.3 Secrets の追加登録

| 名前 | 値 |
|------|-----|
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging API チャネルの Channel access token（長期） |
| `REMINDER_CRON_SECRET` | 手動テスト用の任意文字列（任意） |

`LINE_CHANNEL_ID` / `LINE_SESSION_SECRET`（`line-auth` 用）に加えて登録します。

Channel access token は [LINE Developers Console](https://developers.line.biz/console/) → Messaging API チャネル → **Messaging API** タブで発行します。

### 5.4 Edge Function のデプロイ

```bash
supabase functions deploy line-reminder --no-verify-jwt --project-ref bpfytlurmubgmzaisonp
```

`supabase/config.toml` で `verify_jwt = false` を定義しています。

**定期実行（毎日 JST 20:00）** は Supabase Dashboard → **Edge Functions** → `line-reminder` → **Schedules** で cron を設定します。

```
0 11 * * *
```

（UTC 11:00 = JST 20:00）

### 5.5 手動テスト（curl）

```bash
curl -X POST "https://bpfytlurmubgmzaisonp.supabase.co/functions/v1/line-reminder" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d "{}"
```

オフのときは `skipped: true` が返ります。オンかつ対象貸出があるとき `sent_users` / `sent_items` が返ります。

---

## 6. 学生の利用フロー

### 初回

1. 公式 LINE を友だち追加
2. リッチメニュー「本を借りる」
3. 「学籍番号と LINE を紐づけ」画面
4. 学籍番号・生年月日（YYYYMMDD）を入力
5. 紐づけ成功 → QR スキャン貸出画面

### 2回目以降（機種変更後も同じ）

1. 公式 LINE → 「本を借りる」
2. 自動ログイン → すぐ QR スキャン画面

### LINE アカウントを変えた場合

再度 **学籍番号＋生年月日** で紐づけ（職員が `line_user_id` をクリアする運用も可）。

---

## 7. トラブルシューティング

| 症状 | 確認すること |
|------|----------------|
| **「不明なエラー」**（LINE のダイアログ） | ① リッチメニューは **`https://liff.line.me/<LIFF_ID>`** にする（GitHub Pages URL を直接指定しない） ② LINE Developers の **Endpoint URL** が `https://asamikinura630.github.io/libraly_app/student-borrow.html` と **完全一致** ③ `js/line-config.js` の `ENDPOINT_URL` も同じ URL |
| LIFF が真っ白 | `line-config.js` の LIFF_ID、Endpoint URL が本番 URL と一致しているか |
| 「サーバー設定が未完了」 | Edge Function の Secrets（`LINE_CHANNEL_ID` 等） |
| **「ID トークンを取得できませんでした」** | LIFF の Scope に **openid** があるか。設定後は一度 LINE を閉じて「本を借りる」から開き直す |
| 「ID トークンの検証に失敗」 | Channel ID が LIFF のチャネルと一致しているか |
| 「line_user_id 列がない」 | `20260617_add_line_user_id.sql` を実行したか |
| カメラが起動しない | LINE アプリ内でカメラ権限、HTTPS であること |
| ブラウザ直開き | LINE ログインは **LIFF（LINE アプリ内）** 推奨。直開きは学籍番号ログインを利用 |
| リマインドが送られない | 職員画面でオンか、`LINE_CHANNEL_ACCESS_TOKEN`、cron、`20260619` SQL 実行済みか |
| リマインドが意図せず送られた | 職員画面でオフにする。テスト環境はデフォルトオフを維持 |

---

## 8. セキュリティメモ

- LINE User ID は **LINE アカウント** に紐づく（機種変更しても同じアカウントなら不変）
- ID トークンは **Edge Function のみ** で検証
- 学籍番号＋パスワード方式は LINE 不調時の **予備経路**

---

## 9. 関連ファイル

| ファイル | 役割 |
|----------|------|
| `js/line-config.js` | LIFF ID 設定 |
| `js/line-liff.js` | LIFF 初期化・API 呼び出し |
| `js/app-settings.js` | 返却リマインド送信オン/オフ |
| `supabase/functions/line-auth/index.ts` | ID トークン検証・紐づけ |
| `supabase/functions/line-reminder/index.ts` | 返却リマインド push |
| `sql/20260617_add_line_user_id.sql` | `line_user_id` 列 |
| `sql/20260618_line_reminder_settings.sql` | 送信スイッチ用テーブル |
| `sql/20260619_line_reminder_log.sql` | 送信ログ |
| `student-borrow.html` | 学生貸出 UI（LINE 対応） |
| `index.html` | 職員画面（リマインド設定） |

---

## 改訂履歴

| 版 | 日付 | 内容 |
|----|------|------|
| 1.0 | 2026-06-12 | Phase 1（LIFF ログイン・紐づけ・貸出画面）初版 |
| 1.1 | 2026-06-12 | Phase 2（返却リマインド・職員画面オン/オフ）を追記 |
