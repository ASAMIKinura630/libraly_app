import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STUDENT_TABLE = "libraly_app_student";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeBirthDate(value: string) {
  const v = String(value || "").trim().replace(/\D/g, "");
  return /^\d{8}$/.test(v) ? v : "";
}

async function verifyLineIdToken(idToken: string, channelId: string) {
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: channelId,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("LINE verify failed:", res.status, text);
    return { error: "LINE ID トークンの検証に失敗しました。" };
  }

  const data = await res.json();
  if (!data.sub) {
    return { error: "LINE ユーザー ID を取得できませんでした。" };
  }

  return {
    line_user_id: String(data.sub),
    display_name: String(data.name || ""),
  };
}

async function signSession(
  secret: string,
  lineUserId: string,
  studentNumber: string,
) {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${lineUserId}:${studentNumber}:${exp}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const token = btoa(`${payload}:${sigHex}`);
  return token;
}

function studentPayload(row: Record<string, unknown>) {
  return {
    id: row.id,
    student_number: row.student_number,
    name: row.name,
    birth_date: row.birth_date,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const channelId = Deno.env.get("LINE_CHANNEL_ID") || "";
  const sessionSecret = Deno.env.get("LINE_SESSION_SECRET") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!channelId || !sessionSecret || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      {
        error:
          "サーバー設定が未完了です。Supabase のシークレット（LINE_CHANNEL_ID, LINE_SESSION_SECRET）を設定してください。",
      },
      500,
    );
  }

  let body: Record<string, string> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "リクエスト形式が不正です。" }, 400);
  }

  const action = String(body.action || "login");
  const idToken = String(body.id_token || "");
  if (!idToken) {
    return jsonResponse({ error: "id_token が必要です。" }, 400);
  }

  const verified = await verifyLineIdToken(idToken, channelId);
  if ("error" in verified) {
    return jsonResponse({ error: verified.error }, 401);
  }

  const lineUserId = verified.line_user_id;
  const lineDisplayName = verified.display_name;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  if (action === "login") {
    const { data, error } = await admin
      .from(STUDENT_TABLE)
      .select("id, student_number, name, birth_date, line_user_id")
      .eq("line_user_id", lineUserId)
      .maybeSingle();

    if (error) {
      console.error(error);
      return jsonResponse({ error: "学生マスタの照会に失敗しました。" }, 500);
    }

    if (!data) {
      return jsonResponse({
        needs_link: true,
        line_display_name: lineDisplayName,
      });
    }

    const session_token = await signSession(
      sessionSecret,
      lineUserId,
      String(data.student_number),
    );

    return jsonResponse({
      student: studentPayload(data),
      session_token,
      line_display_name: lineDisplayName,
    });
  }

  if (action === "link") {
    const studentNumber = String(body.student_number || "").trim();
    const birthDate = normalizeBirthDate(body.birth_date || "");

    if (!studentNumber || !birthDate) {
      return jsonResponse(
        { error: "学籍番号と生年月日（8桁）を入力してください。" },
        400,
      );
    }

    const { data: student, error: findError } = await admin
      .from(STUDENT_TABLE)
      .select("id, student_number, name, birth_date, line_user_id")
      .eq("student_number", studentNumber)
      .maybeSingle();

    if (findError) {
      console.error(findError);
      return jsonResponse({ error: "学生マスタの照会に失敗しました。" }, 500);
    }
    if (!student) {
      return jsonResponse(
        { error: "学籍番号が学生マスタに登録されていません。" },
        404,
      );
    }
    if (student.birth_date !== birthDate) {
      return jsonResponse({ error: "生年月日が一致しません。" }, 400);
    }
    if (student.line_user_id && student.line_user_id !== lineUserId) {
      return jsonResponse(
        {
          error:
            "この学籍番号は別の LINE アカウントと紐づいています。職員に連絡してください。",
        },
        409,
      );
    }

    const { data: taken, error: takenError } = await admin
      .from(STUDENT_TABLE)
      .select("id, student_number")
      .eq("line_user_id", lineUserId)
      .maybeSingle();

    if (takenError) {
      console.error(takenError);
      return jsonResponse({ error: "LINE 紐づけの確認に失敗しました。" }, 500);
    }
    if (taken && taken.student_number !== studentNumber) {
      return jsonResponse(
        {
          error:
            "この LINE アカウントは既に別の学籍番号と紐づいています。",
        },
        409,
      );
    }

    if (!student.line_user_id) {
      const { error: updateError } = await admin
        .from(STUDENT_TABLE)
        .update({ line_user_id: lineUserId })
        .eq("id", student.id)
        .is("line_user_id", null);

      if (updateError) {
        console.error(updateError);
        return jsonResponse({ error: "LINE 紐づけの保存に失敗しました。" }, 500);
      }
    }

    const session_token = await signSession(
      sessionSecret,
      lineUserId,
      studentNumber,
    );

    return jsonResponse({
      student: studentPayload({ ...student, line_user_id: lineUserId }),
      session_token,
      line_display_name: lineDisplayName,
    });
  }

  return jsonResponse({ error: "不明な action です。" }, 400);
});
