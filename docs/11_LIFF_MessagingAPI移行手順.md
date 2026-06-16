# LIFF と Messaging API の正しい構成（2チャネル）

> **重要:** 2019/11/11 以降、**Messaging API チャネルには LIFF を追加できません**。  
> LIFF は **LINEログインチャネル** に置き、push は **Messaging API チャネル** で送ります。

返却リマインドを動かすために「LIFF を Messaging API に移す」必要は **ありません**。  
現在の LIFF（LINEログイン `2010403811`）のままで正しいです。

---

## チャネルの役割分担

| チャネル | ID | 役割 |
|----------|-----|------|
| **LINEログイン** | `2010403811` | LIFF・ログイン・ID トークン検証 |
| **Messaging API** | `2010403797` | 公式 LINE・push 送信 |

両方ともプロバイダー **図書館保守システム** 配下にあるため、**同じ LINE ユーザーの `userId` は同じ値** です（LINE 公式ドキュメントより）。  
LIFF で取得した `line_user_id` を、そのまま Messaging API の push に使えます。

---

## Supabase Secrets（正しい設定）

| Secret | 設定するチャネル | 値の例 |
|--------|------------------|--------|
| `LINE_CHANNEL_ID` | **LINEログイン** | `2010403811` |
| `LINE_SESSION_SECRET` | 任意の長いランダム文字列 | （既存のまま） |
| `LINE_CHANNEL_ACCESS_TOKEN` | **Messaging API** | Messaging API タブで発行したトークン |
| `LINE_LIFF_ID` | （任意） | `2010403811-I1HtymKS` — リマインド文の URL 用 |

`LINE_CHANNEL_ID` を Messaging API の ID に変えると、**ログインの ID トークン検証が失敗** します。変更しないでください。

---

## リマインドが届くための条件

1. 学生が **公式 LINE を友だち追加** している  
   - LIFF の **Bot link feature: On（Aggressive）** で未追加時に誘導
2. `libraly_app_student.line_user_id` が登録されている（LIFF で紐づけ済み）
3. Supabase に `LINE_CHANNEL_ACCESS_TOKEN`（Messaging API）が設定されている
4. 職員画面で **返却リマインドがオン**
5. 対象の貸出がリマインド条件に合っている

`line_user_id` のクリアや LIFF の作り直しは **通常不要** です。

---

## コンソールで確認すること

### LINEログインチャネル（`2010403811`）

- LIFF `2010403811-I1HtymKS` が有効
- Scope: **profile** + **openid**
- Endpoint URL が GitHub Pages と一致
- Bot link feature: **On（Aggressive）**

### Messaging API チャネル（`2010403797`）

- 公式 LINE アカウントとリンク済み
- **Channel access token** を発行し Supabase Secrets に登録
- （任意）Webhook はリマインドには不要

### チャネル連携（推奨）

LINEログインチャネルと Messaging API チャネルが **同じプロバイダー** にあることを確認してください。  
別プロバイダーだと `userId` が一致しません。

---

## テスト手順

1. 自分の LINE で公式アカウントを **友だち追加**
2. リッチメニュー「本を借りる」→ LIFF で紐づけ（済みならスキップ）
3. Supabase Secrets を上表どおりに設定
4. 職員画面でリマインド **オン**
5. `line-reminder` を手動実行（curl 等）
6. LINE に通知が届くか確認
7. テスト後はリマインド **オフ** 推奨

---

## よくある誤解

| 誤解 | 正しい理解 |
|------|------------|
| LIFF は Messaging API に置く | **2019年以降は不可**。LINEログインに置く |
| チャネルを1つにまとめる必要がある | **2チャネル構成が標準** |
| push のために LIFF を作り直す | **不要**。友だち追加とトークン設定が重要 |
| `LINE_CHANNEL_ID` は Messaging API の ID | **LINEログインの ID**（ID トークン検証用） |
