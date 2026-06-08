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

  async function getSession() {
    const { data, error } = await getClient().auth.getSession();
    if (error) {
      alert(authErrorMessage(error));
      return null;
    }
    return data.session || null;
  }

  async function requireAuth() {
    const session = await getSession();
    if (!session) {
      global.location.replace(HOME_PAGE);
      return null;
    }
    return session;
  }

  async function resolveStaffFromSession(session) {
    if (!session || !session.user || !session.user.email) {
      return null;
    }

    const { data, error } = await getClient()
      .from(STAFF_TABLE)
      .select("id, staff_number, name, email")
      .eq("email", session.user.email)
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
    return resolveStaffFromSession(session);
  }

  global.LibralyAuth = {
    getClient,
    getSession,
    requireAuth,
    renderUserBar,
    signOut,
    getCurrentStaff,
    validatePassword,
    authErrorMessage,
    PASSWORD_MIN_LENGTH,
    HOME_PAGE,
    STAFF_TABLE,
  };
})(window);
