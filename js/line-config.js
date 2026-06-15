/**
 * LINE / LIFF 設定
 * docs/09_LINE連携手順.md に従い、LIFF ID を設定してください。
 */
(function (global) {
  global.LibralyLineConfig = {
    /** LIFF アプリの ID — LINE Developers の LIFF タブで確認 */
    LIFF_ID: "2010403811-I1HtymKS",

    /** 未設定のとき false。LIFF_ID を入れると有効化 */
    isConfigured: function () {
      return Boolean(String(this.LIFF_ID || "").trim());
    },
  };
})(window);
