/**
 * 公式 LINE / LIFF — 学生セルフ貸出認証
 * ID トークン検証は Supabase Edge Function（line-auth）で実施。
 */
(function (global) {
  const SESSION_KEY = "libraly_line_session";
  const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

  let liffReady = false;
  let cachedProfile = null;
  let lastInitError = null;

  function getConfig() {
    return global.LibralyLineConfig || { LIFF_ID: "", isConfigured: function () { return false; } };
  }

  function getFunctionsUrl() {
    const base =
      global.LibralyAuth && global.LibralyAuth.SUPABASE_URL
        ? global.LibralyAuth.SUPABASE_URL
        : "https://bpfytlurmubgmzaisonp.supabase.co";
    return base.replace(/\/$/, "") + "/functions/v1/line-auth";
  }

  function getAnonKey() {
    return global.LibralyAuth && global.LibralyAuth.SUPABASE_ANON_KEY
      ? global.LibralyAuth.SUPABASE_ANON_KEY
      : "";
  }

  function isConfigured() {
    const cfg = getConfig();
    return cfg.isConfigured && cfg.isConfigured();
  }

  function getRedirectUri() {
    const cfg = getConfig();
    const configured = String(cfg.ENDPOINT_URL || "").trim();
    if (configured) return configured;
    return window.location.origin + window.location.pathname;
  }

  function formatLiffError(err) {
    if (!err) return "LIFF の初期化に失敗しました。";
    const code = err.code ? String(err.code) : "";
    const message = err.message ? String(err.message) : "";
    if (code === "INIT_FAILED" || /endpoint/i.test(message)) {
      return (
        "LIFF の Endpoint URL が一致していない可能性があります。\n" +
        "LINE Developers の Endpoint を次と完全一致させてください:\n" +
        getRedirectUri()
      );
    }
    if (message && message !== "Unknown error") {
      return "LIFF エラー: " + message + (code ? " (" + code + ")" : "");
    }
    return (
      "LIFF の初期化に失敗しました（不明なエラー）。\n" +
      "リッチメニューは https://liff.line.me/" +
      getConfig().LIFF_ID +
      " の形式で設定してください。"
    );
  }

  function isInLineClient() {
    return liffReady && global.liff && global.liff.isInClient();
  }

  function saveSession(payload) {
    const record = {
      session_token: payload.session_token,
      student: payload.student,
      line_display_name: payload.line_display_name || "",
      expires_at: Date.now() + SESSION_MS,
    };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(record));
    } catch (e) {
      console.warn(e);
    }
    return record;
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {
      console.warn(e);
    }
    cachedProfile = null;
  }

  function readSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const record = JSON.parse(raw);
      if (!record || !record.student || !record.session_token) return null;
      if (record.expires_at && Date.now() > record.expires_at) {
        clearSession();
        return null;
      }
      return record;
    } catch (e) {
      console.warn(e);
      return null;
    }
  }

  async function initLiff() {
    lastInitError = null;
    if (!isConfigured()) return false;
    if (!global.liff) {
      lastInitError = { message: "LIFF SDK が読み込まれていません。" };
      console.warn(lastInitError.message);
      return false;
    }
    const cfg = getConfig();
    try {
      await global.liff.init({
        liffId: cfg.LIFF_ID.trim(),
        withLoginOnExternalBrowser: true,
      });
      liffReady = true;
      if (global.liff.isLoggedIn()) {
        cachedProfile = await global.liff.getProfile();
      }
      return true;
    } catch (err) {
      lastInitError = err;
      console.error(err);
      return false;
    }
  }

  async function ensureLoggedIn() {
    if (!liffReady || !global.liff) return false;
    if (global.liff.isLoggedIn()) return true;
    try {
      sessionStorage.removeItem("libraly_line_scope_retry");
      global.liff.login({ redirectUri: getRedirectUri() });
    } catch (err) {
      lastInitError = err;
      console.error(err);
      return false;
    }
    return false;
  }

  function idTokenErrorMessage() {
    const loggedIn =
      liffReady && global.liff && global.liff.isLoggedIn();
    if (loggedIn) {
      return (
        "LINE の ID トークンを取得できませんでした。\n" +
        "LINE Developers → LIFF → 対象アプリの Scope で「openid」にチェックを入れ、保存後にもう一度「本を借りる」を開いてください。"
      );
    }
    return "LINE にログインできませんでした。もう一度「本を借りる」から開いてください。";
  }

  async function ensureIdToken() {
    if (!liffReady || !global.liff || !global.liff.isLoggedIn()) {
      return null;
    }

    const token = global.liff.getIDToken();
    if (token) {
      try {
        sessionStorage.removeItem("libraly_line_scope_retry");
      } catch (e) {
        console.warn(e);
      }
      return token;
    }

    // ログイン済みなのに ID トークンが無い = openid 未付与の古いセッションのことが多い
    const retryKey = "libraly_line_scope_retry";
    let retried = false;
    try {
      retried = sessionStorage.getItem(retryKey) === "1";
    } catch (e) {
      console.warn(e);
    }

    if (!retried) {
      try {
        sessionStorage.setItem(retryKey, "1");
        global.liff.logout();
        global.liff.login({ redirectUri: getRedirectUri() });
      } catch (err) {
        lastInitError = err;
        console.error(err);
        try {
          sessionStorage.removeItem(retryKey);
        } catch (e) {
          console.warn(e);
        }
      }
      return null;
    }

    return null;
  }

  async function getIdToken() {
    return ensureIdToken();
  }

  async function callLineAuth(body) {
    const res = await fetch(getFunctionsUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getAnonKey(),
        apikey: getAnonKey(),
      },
      body: JSON.stringify(body),
    });

    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      const message =
        (data && data.error) ||
        "LINE 認証サーバーとの通信に失敗しました。（HTTP " + res.status + "）";
      return { error: { message: message } };
    }

    return { data: data, error: null };
  }

  async function loginWithLine() {
    const idToken = await ensureIdToken();
    if (!idToken) {
      return { error: { message: idTokenErrorMessage() }, pending_redirect: true };
    }

    const result = await callLineAuth({
      action: "login",
      id_token: idToken,
    });

    if (result.error) return result;
    if (result.data && result.data.needs_link) {
      return { needs_link: true, line_display_name: result.data.line_display_name || "" };
    }
    if (result.data && result.data.student && result.data.session_token) {
      saveSession(result.data);
      return { student: result.data.student, error: null };
    }
    return { error: { message: "LINE ログインに失敗しました。" } };
  }

  async function linkStudent({ student_number, birth_date }) {
    const idToken = await ensureIdToken();
    if (!idToken) {
      return { error: { message: idTokenErrorMessage() }, pending_redirect: true };
    }

    const result = await callLineAuth({
      action: "link",
      id_token: idToken,
      student_number: String(student_number || "").trim(),
      birth_date: String(birth_date || "").trim(),
    });

    if (result.error) return result;
    if (result.data && result.data.student && result.data.session_token) {
      saveSession(result.data);
      return { student: result.data.student, error: null };
    }
    return { error: { message: "LINE との紐づけに失敗しました。" } };
  }

  function getCurrentStudent() {
    const record = readSession();
    return record ? record.student : null;
  }

  function hasActiveSession() {
    return Boolean(readSession());
  }

  function signOut() {
    clearSession();
    if (liffReady && global.liff && global.liff.isLoggedIn()) {
      try {
        global.liff.logout();
      } catch (e) {
        console.warn(e);
      }
    }
  }

  function getDisplayName() {
    const record = readSession();
    if (record && record.line_display_name) return record.line_display_name;
    if (cachedProfile && cachedProfile.displayName) return cachedProfile.displayName;
    return "";
  }

  global.LibralyLineLiff = {
    isConfigured: isConfigured,
    isInLineClient: isInLineClient,
    initLiff: initLiff,
    getLastInitError: function () {
      return lastInitError;
    },
    formatLiffError: formatLiffError,
    getRedirectUri: getRedirectUri,
    ensureLoggedIn: ensureLoggedIn,
    loginWithLine: loginWithLine,
    linkStudent: linkStudent,
    getCurrentStudent: getCurrentStudent,
    hasActiveSession: hasActiveSession,
    signOut: signOut,
    getDisplayName: getDisplayName,
    clearSession: clearSession,
  };
})(window);
