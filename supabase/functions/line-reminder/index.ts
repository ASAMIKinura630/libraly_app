import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-reminder-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SETTINGS_TABLE = "libraly_app_settings";
const SETTINGS_ROW_ID = "default";
const LOG_TABLE = "libraly_app_line_reminder_log";
const HISTORY_TABLE = "libraly_app_lending_history";
const LIFF_URL = "https://liff.line.me/2010403811-I1HtymKS";

type ReminderType = "three_days_before" | "day_before" | "overdue";

interface LoanRow {
  id: string;
  due_date: string;
  student_number: string;
  libraly_app_student: { line_user_id: string; name: string } | null;
  libraly_app: { title: string } | null;
}

interface PendingItem {
  historyId: string;
  type: ReminderType;
  dueDate: string;
  title: string;
  overdueDays: number;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getTodayJst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(
    new Date(),
  );
}

function parseJstDate(dateStr: string): Date {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function addDaysJst(dateStr: string, days: number): string {
  const dt = parseJstDate(dateStr);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function diffDaysJst(fromDue: string, toToday: string): number {
  const due = parseJstDate(fromDue).getTime();
  const today = parseJstDate(toToday).getTime();
  return Math.floor((today - due) / (24 * 60 * 60 * 1000));
}

function formatDisplayDate(dateStr: string): string {
  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return dateStr;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

function classifyReminder(dueDate: string, todayJst: string): ReminderType | null {
  const threeDaysLater = addDaysJst(todayJst, 3);
  const tomorrow = addDaysJst(todayJst, 1);
  if (dueDate === threeDaysLater) return "three_days_before";
  if (dueDate === tomorrow) return "day_before";
  if (dueDate < todayJst) return "overdue";
  return null;
}

function isAuthorized(req: Request, serviceRoleKey: string): boolean {
  const cronSecret = Deno.env.get("REMINDER_CRON_SECRET") || "";
  const headerSecret = req.headers.get("x-reminder-secret") || "";
  if (cronSecret && headerSecret === cronSecret) return true;
  const auth = req.headers.get("authorization") || "";
  return Boolean(serviceRoleKey && auth === `Bearer ${serviceRoleKey}`);
}

async function pushLineMessage(
  accessToken: string,
  to: string,
  text: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text }],
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error("LINE push failed:", res.status, errorText);
    return { ok: false, status: res.status, error: errorText };
  }
  return { ok: true };
}

function buildMessage(
  items: PendingItem[],
  todayJst: string,
): string {
  const threeDays = items.filter((i) => i.type === "three_days_before");
  const dayBefore = items.filter((i) => i.type === "day_before");
  const overdue = items.filter((i) => i.type === "overdue");

  const lines: string[] = ["【図書館】返却のお知らせ", ""];

  if (threeDays.length) {
    lines.push("■ あと3日で返却");
    for (const item of threeDays) {
      lines.push(
        `・『${item.title}』（${formatDisplayDate(item.dueDate)} まで）`,
      );
    }
    lines.push("");
  }

  if (dayBefore.length) {
    lines.push("■ 明日が返却日");
    for (const item of dayBefore) {
      lines.push(
        `・『${item.title}』（${formatDisplayDate(item.dueDate)}）`,
      );
    }
    lines.push("今夜、バッグに入れておきましょう。");
    lines.push("");
  }

  if (overdue.length) {
    lines.push("■ 延滞しています");
    for (const item of overdue) {
      lines.push(
        `・『${item.title}』（${item.overdueDays}日延滞・返却予定 ${formatDisplayDate(item.dueDate)}）`,
      );
    }
    lines.push("");
  }

  lines.push(`貸出状況の確認: ${LIFF_URL}`);
  return lines.join("\n").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const lineAccessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "";

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "サーバー設定が未完了です。" }, 500);
  }

  if (!isAuthorized(req, serviceRoleKey)) {
    return jsonResponse({ error: "認可されていないリクエストです。" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const todayJst = getTodayJst();

  const { data: settings, error: settingsError } = await admin
    .from(SETTINGS_TABLE)
    .select("line_reminder_enabled")
    .eq("id", SETTINGS_ROW_ID)
    .maybeSingle();

  if (settingsError) {
    console.error(settingsError);
    return jsonResponse({ error: "設定の読み込みに失敗しました。" }, 500);
  }

  if (!settings?.line_reminder_enabled) {
    return jsonResponse({
      ok: true,
      skipped: true,
      reason: "line_reminder_enabled is false",
      message: "職員画面で LINE 返却リマインドがオフのため送信しません。",
      today_jst: todayJst,
    });
  }

  if (!lineAccessToken) {
    return jsonResponse(
      {
        error:
          "LINE_CHANNEL_ACCESS_TOKEN が未設定です。Supabase Secrets を登録してください。",
      },
      500,
    );
  }

  const { data: loans, error: loansError } = await admin
    .from(HISTORY_TABLE)
    .select(
      "id, due_date, student_number, libraly_app_student!libraly_app_lending_history_student_number_fkey ( line_user_id, name ), libraly_app!libraly_app_lending_history_book_id_fkey ( title )",
    )
    .eq("is_returned", false);

  if (loansError) {
    console.error(loansError);
    return jsonResponse({ error: "貸出履歴の取得に失敗しました。" }, 500);
  }

  const { data: sentLogs, error: logError } = await admin
    .from(LOG_TABLE)
    .select("lending_history_id, reminder_type")
    .eq("sent_on", todayJst);

  if (logError) {
    console.error(logError);
    return jsonResponse({ error: "送信ログの取得に失敗しました。" }, 500);
  }

  const sentKeySet = new Set(
    (sentLogs || []).map((row) => `${row.lending_history_id}:${row.reminder_type}`),
  );

  const byLineUser = new Map<string, PendingItem[]>();

  for (const raw of (loans || []) as LoanRow[]) {
    const student = raw.libraly_app_student;
    const book = raw.libraly_app;
    const lineUserId = student?.line_user_id;
    if (!lineUserId || !raw.due_date) continue;

    const type = classifyReminder(raw.due_date, todayJst);
    if (!type) continue;

    const logKey = `${raw.id}:${type}`;
    if (sentKeySet.has(logKey)) continue;

    const title = book?.title || "（タイトル不明）";
    const item: PendingItem = {
      historyId: raw.id,
      type,
      dueDate: raw.due_date,
      title,
      overdueDays: type === "overdue" ? diffDaysJst(raw.due_date, todayJst) : 0,
    };

    const list = byLineUser.get(lineUserId) || [];
    list.push(item);
    byLineUser.set(lineUserId, list);
  }

  let sentUsers = 0;
  let sentItems = 0;
  let failedUsers = 0;
  const errors: { line_user_id: string; error: string }[] = [];

  for (const [lineUserId, items] of byLineUser.entries()) {
    const text = buildMessage(items, todayJst);
    const pushResult = await pushLineMessage(lineAccessToken, lineUserId, text);
    if (!pushResult.ok) {
      failedUsers += 1;
      errors.push({
        line_user_id: lineUserId,
        error: pushResult.error || `HTTP ${pushResult.status}`,
      });
      continue;
    }

    const logRows = items.map((item) => ({
      lending_history_id: item.historyId,
      reminder_type: item.type,
      sent_on: todayJst,
    }));

    const { error: insertError } = await admin.from(LOG_TABLE).insert(logRows);
    if (insertError) {
      console.error("log insert failed:", insertError);
    }

    sentUsers += 1;
    sentItems += items.length;
  }

  return jsonResponse({
    ok: true,
    skipped: false,
    today_jst: todayJst,
    sent_users: sentUsers,
    sent_items: sentItems,
    failed_users: failedUsers,
    errors: errors.slice(0, 20),
    message: `LINE 返却リマインドを処理しました（送信 ${sentUsers} 件 / 対象 ${sentItems} 冊）。`,
  });
});
