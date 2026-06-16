# LINE 返却リマインド — 本番で使い始めるときだけやること

返却リマインドの実装・動作確認（push 送信テスト）は完了しています。  
**今すぐ追加作業は不要** です。実際に **毎日の自動送信を始めたいタイミング** で、次の2つだけ行ってください。

---

## チェックリスト

```
□ 1. 職員画面で「LINE 返却リマインド」をオンにする
□ 2. Supabase で line-reminder の cron（毎日 JST 20:00）を設定する
```

---

## 1. 職員画面でオンにする

1. 職員で [`index.html`](https://asamikinura630.github.io/libraly_app/index.html) にログイン
2. 「**LINE 返却リマインド**」カードのチェックボックスを **オン**
3. 確認ダイアログが出たら内容を読んで承認

**デフォルトはオフ** です。テスト環境ではオフのまま運用し、有料プラン移行の目処が立ってからオンにしてください。

---

## 2. 定期実行（cron）を設定する

1. [Supabase Dashboard](https://supabase.com/dashboard/project/bpfytlurmubgmzaisonp/functions) を開く
2. **Edge Functions** → **`line-reminder`** → **Schedules**
3. 新規スケジュールを追加し、次を設定する

| 項目 | 値 |
|------|-----|
| Cron 式 | `0 11 * * *` |
| 意味 | UTC 11:00 = **JST 20:00**（毎日） |

`REMINDER_CRON_SECRET` を Supabase Secrets に登録している場合、スケジュール実行時に `x-reminder-secret` ヘッダーへ同じ値を渡す設定にします（Dashboard の Schedules UI に従う）。

---

## 送信タイミング（参考）

すべて **JST 20:00** に送信されます。

| 種別 | 条件 |
|------|------|
| 返却3日前 | 返却予定日の 3 日前 |
| 返却前日 | 返却予定日の **前日**（当日朝ではなく前夜） |
| 延滞 | 返却予定日を過ぎても未返却（毎日） |

---

## オフのままにしておくと

- cron が動いても、職員画面で **オフ** なら `line-reminder` は送信をスキップします
- 意図しない LINE 送信（Messaging API の課金）を防げます

本番開始前は **オフのまま** で問題ありません。

---

## 関連ドキュメント

- 連携全体: [`09_LINE連携手順.md`](./09_LINE連携手順.md)（§5 返却リマインド）
- 手動テスト（curl）: [`09_LINE連携手順.md`](./09_LINE連携手順.md) §5.5
- 2チャネル構成: [`11_LIFF_MessagingAPI移行手順.md`](./11_LIFF_MessagingAPI移行手順.md)
