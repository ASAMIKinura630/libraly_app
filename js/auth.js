/**
 * 図書館保守システム — 認証共通（Supabase Auth）
 * ログイン・新規登録は index.html。各業務・保守画面から利用する。
 */
(function (global) {
  const SUPABASE_URL = "https://bpfytlurmubgmzaisonp.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwZnl0bHVybXViZ216YWlzb25wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2OTA2MzUsImV4cCI6MjA5NTI2NjYzNX0.rIimKp_spSxCuuKCJlFoa8ux4BvFodHam0S3XGTFRa0";

  const PASSWORD_MIN_LENGTH = 6;
  const HOME_PAGE = "index.html";
  const STAFF_TABLE = "libraly_app_staff";

  let supabaseClient = null;

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function getClient() {
    if (!global.supabase) {
      throw new Error("Supabase SDK が読み込まれていません。");
    }
    if (!supabaseClient) {
      supabaseClient = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabaseClient;
  }

  function authErrorMessage(error) {
    if (!error) return "エラーが発生しました。";
    const msg = error.message || String(error);
    if (msg.includes("Invalid login credentials")) {
      return "メールアドレスまたはパスワードが正しくありません。";
    }
    if (msg.includes("User already registered")) {
      return "このメールアドレスは既に登録されています。";
    }
    if (msg.includes("Password should be at least")) {
      return "パスワードは6文字以上で入力してください。";
    }
    if (msg.includes("Unable to validate email address")) {
      return "メールアドレスの形式が正しくありません。";
    }
    return msg;
  }

  function validatePassword(password) {
    return password.length >= PASSWORD_MIN_LENGTH;
  }

  function validateStaffName(name) {
    return name.trim().length > 0;
  }

  function normalizeEmail(email) {
    return (email || "").trim().toLowerCase();
  }

  function generateStaffNumber() {
    const uuid =
      global.crypto && global.crypto.randomUUID
        ? global.crypto.randomUUID().replace(/-/g, "")
        : String(Date.now()) + Math.random().toString(16).slice(2);
    return "STF-" + uuid.slice(0, 8).toUpperCase();
  }

  function isUniqueViolation(error) {
    if (!error) return false;
    const code = error.code || "";
    const msg = error.message || "";
    return code === "23505" || msg.includes("duplicate key");
  }

  function staffErrorMessage(error) {
    if (!error) return "担当者マスタの登録に失敗しました。";
    const msg = error.message || String(error);
    const code = error.code || "";
    if (code === "42P01" || msg.includes("libraly_app_staff")) {
      return (
        "担当者マスタのテーブルが未作成です。Supabase の SQL Editor で " +
        "sql/20260602_add_staff_lending_processor.sql を実行してください。"
      );
    }
    if (code === "42501" || msg.includes("permission denied")) {
      return "担当者マスタへの登録権限がありません。Supabase の権限設定を確認してください。";
    }
    return "担当者マスタの登録に失敗しました。（" + msg + "）";
  }

  function getStaffNameFromSession(session) {
    if (!session || !session.user) return "";
    const meta = session.user.user_metadata || {};
    return (meta.name || meta.full_name || "").trim();
  }

  async function insertStaffRecord(email, name) {
    const normalizedEmail = normalizeEmail(email);
    const trimmedName = (name || "").trim();
    const maxAttempts = 8;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const staffNumber = generateStaffNumber();

      const { data, error } = await getClient()
        .from(STAFF_TABLE)
        .insert({
          staff_number: staffNumber,
          name: trimmedName,
          email: normalizedEmail,
        })
        .select("id, staff_number, name, email")
        .single();

      if (!error) {
        return { data, error: null };
      }

      if (isUniqueViolation(error) && attempt < maxAttempts - 1) {
        continue;
      }

      return { data: null, error };
    }

    return {
      data: null,
      error: { message: "担当者マスタの登録に失敗しました。" },
    };
  }

  async function ensureStaffForSession(session) {
    if (!session) {
      return null;
    }

    const existing = await resolveStaffFromSession(session);
    if (existing) {
      return existing;
    }

    const name = getStaffNameFromSession(session);
    if (!name || !session.user.email) {
      return null;
    }

    const staffResult = await insertStaffRecord(session.user.email, name);
    if (staffResult.error) {
      console.error(staffResult.error);
      return null;
    }

    return staffResult.data;
  }

  async function signUpWithStaff({ email, password, name }) {
    const trimmedEmail = normalizeEmail(email);
    const trimmedName = name.trim();

    const { data, error } = await getClient().auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: { name: trimmedName },
      },
    });

    if (error) {
      return { error };
    }

    const staffResult = await insertStaffRecord(trimmedEmail, trimmedName);
    if (staffResult.error) {
      console.error(staffResult.error);
      if (data.session) {
        return {
          data,
          error: null,
          staff: null,
          staffWarning: staffErrorMessage(staffResult.error),
        };
      }
      return {
        error: { message: staffErrorMessage(staffResult.error) },
      };
    }

    return { data, error: null, staff: staffResult.data };
  }

  async function getSession() {
    const { data, error } = await getClient().auth.getSession();
    if (error) {
      alert(authErrorMessage(error));
      return null;
    }
    return data.session || null;
  }

  function isStudentSession(session) {
    if (!session || !session.user) return false;
    const meta = session.user.user_metadata || {};
    return meta.role === "student";
  }

  async function requireAuth() {
    const session = await getSession();
    if (!session) {
      global.location.replace(HOME_PAGE);
      return null;
    }
    if (isStudentSession(session)) {
      global.location.replace("student-borrow.html");
      return null;
    }
    return session;
  }

  async function resolveStaffFromSession(session) {
    if (!session || !session.user || !session.user.email) {
      return null;
    }
    const meta = session.user.user_metadata || {};
    if (meta.role === "student") {
      return null;
    }

    const { data, error } = await getClient()
      .from(STAFF_TABLE)
      .select("id, staff_number, name, email")
      .eq("email", normalizeEmail(session.user.email))
      .maybeSingle();

    if (error) {
      console.error(error);
      return null;
    }

    return data || null;
  }

  async function renderUserBar(hostEl) {
    if (!hostEl) return;
    const { data } = await getClient().auth.getSession();
    if (!data.session) return;

    const staff = await resolveStaffFromSession(data.session);
    const displayName = staff
      ? staff.name
      : data.session.user.email || "";

    hostEl.className = "auth-bar";
    hostEl.setAttribute("aria-label", "ログイン情報");
    hostEl.innerHTML =
      '<span class="auth-bar__label">ログイン中:</span>' +
      '<span class="auth-bar__name">' +
      escapeHtml(displayName) +
      "</span>" +
      '<button type="button" class="auth-bar__logout">ログアウト</button>';

    hostEl.querySelector(".auth-bar__logout").addEventListener("click", function () {
      signOut();
    });
  }

  async function signOut() {
    const { error } = await getClient().auth.signOut();
    if (error) {
      alert(authErrorMessage(error));
      return;
    }
    global.location.replace(HOME_PAGE);
  }

  async function getCurrentStaff() {
    const session = await getSession();
    if (!session) {
      return null;
    }
    return ensureStaffForSession(session);
  }

  global.LibralyAuth = {
    getClient,
    getSession,
    requireAuth,
    isStudentSession,
    renderUserBar,
    signOut,
    getCurrentStaff,
    signUpWithStaff,
    insertStaffRecord,
    ensureStaffForSession,
    generateStaffNumber,
    staffErrorMessage,
    validatePassword,
    validateStaffName,
    authErrorMessage,
    PASSWORD_MIN_LENGTH,
    HOME_PAGE,
    STAFF_TABLE,
  };
})(window);
