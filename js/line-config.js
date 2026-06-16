/**
 * LINE / LIFF 設定
 * docs/09_LINE連携手順.md（本プロジェクト）
 * docs/10_Supabase×公式LINE連携バイブル.md（汎用）
 * docs/11_LIFF_MessagingAPI移行手順.md（LIFF + push の2チャネル構成）
 */
(function (global) {
  global.LibralyLineConfig = {
    /** LIFF アプリの ID — LINE Developers の LIFF タブで確認 */
    LIFF_ID: "2010403811-I1HtymKS",

    /**
     * LIFF の Endpoint URL（LINE Developers と完全一致させる）
     * liff.login の redirectUri にも使用（クエリ付き URL は不可）
     */
    ENDPOINT_URL: "https://asamikinura630.github.io/libraly_app/student-borrow.html",

    /** 未設定のとき false。LIFF_ID を入れると有効化 */
    isConfigured: function () {
      return Boolean(String(this.LIFF_ID || "").trim());
    },
  };
})(window);
