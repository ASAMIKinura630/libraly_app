/**
 * 公式 LINE / LIFF — 学生セルフ貸出認証
 * ID トークン検証は Supabase Edge Function（line-auth）で実施。
 */
(function (global) {
  const SESSION_KEY = "libraly_line_session";
  const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

  let liffReady = false;
  let cachedProfile = null;

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
    if (!isConfigured()) return false;
    if (!global.liff) {
      console.warn("LIFF SDK が読み込まれていません。");
      return false;
    }
    const cfg = getConfig();
    try {
      await global.liff.init({ liffId: cfg.LIFF_ID.trim() });
      liffReady = true;
      if (global.liff.isLoggedIn()) {
        cachedProfile = await global.liff.getProfile();
      }
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  async function ensureLoggedIn() {
    if (!liffReady || !global.liff) return false;
    if (global.liff.isLoggedIn()) return true;
    global.liff.login({ redirectUri: window.location.href.split("#")[0] });
    return false;
  }

  async function getIdToken() {
    if (!liffReady || !global.liff || !global.liff.isLoggedIn()) return null;
    return global.liff.getIDToken();
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
    const idToken = await getIdToken();
    if (!idToken) {
      return { error: { message: "LINE の ID トークンを取得できませんでした。" } };
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
    const idToken = await getIdToken();
    if (!idToken) {
      return { error: { message: "LINE の ID トークンを取得できませんでした。" } };
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
