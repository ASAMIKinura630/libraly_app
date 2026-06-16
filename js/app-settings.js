/**
 * 図書館アプリ運用設定（職員画面）
 */
(function (global) {
  const SETTINGS_TABLE = "libraly_app_settings";
  const SETTINGS_ROW_ID = "default";

  function getClient() {
    return global.LibralyAuth && global.LibralyAuth.getClient
      ? global.LibralyAuth.getClient()
      : null;
  }

  async function getSettings() {
    const client = getClient();
    if (!client) {
      return { data: null, error: { message: "Supabase クライアントを初期化できません。" } };
    }

    const { data, error } = await client
      .from(SETTINGS_TABLE)
      .select("id, line_reminder_enabled, updated_at, updated_by_staff_id")
      .eq("id", SETTINGS_ROW_ID)
      .maybeSingle();

    if (error) {
      return { data: null, error: error };
    }

    if (!data) {
      return {
        data: {
          id: SETTINGS_ROW_ID,
          line_reminder_enabled: false,
          updated_at: null,
          updated_by_staff_id: null,
        },
        error: null,
      };
    }

    return { data: data, error: null };
  }

  async function setLineReminderEnabled(enabled, staffId) {
    const client = getClient();
    if (!client) {
      return { data: null, error: { message: "Supabase クライアントを初期化できません。" } };
    }

    const payload = {
      line_reminder_enabled: Boolean(enabled),
      updated_at: new Date().toISOString(),
    };
    if (staffId) {
      payload.updated_by_staff_id = staffId;
    }

    const { data, error } = await client
      .from(SETTINGS_TABLE)
      .update(payload)
      .eq("id", SETTINGS_ROW_ID)
      .select("id, line_reminder_enabled, updated_at, updated_by_staff_id")
      .maybeSingle();

    return { data: data, error: error };
  }

  global.LibralyAppSettings = {
    SETTINGS_TABLE: SETTINGS_TABLE,
    getSettings: getSettings,
    setLineReminderEnabled: setLineReminderEnabled,
  };
})(window);
