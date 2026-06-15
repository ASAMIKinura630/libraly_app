/**
 * 図書 QR コードのペイロード形式（共通）
 * 例: LIBRALY_BOOK:550e8400-e29b-41d4-a716-446655440000
 */
(function (global) {
  const PREFIX = "LIBRALY_BOOK:";
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function formatBookQrPayload(bookId) {
    return PREFIX + String(bookId).trim();
  }

  function parseBookQrPayload(raw) {
    if (!raw) return null;
    const text = String(raw).trim();
    if (text.indexOf(PREFIX) === 0) {
      const id = text.slice(PREFIX.length).trim();
      return UUID_RE.test(id) ? id : null;
    }
    if (UUID_RE.test(text)) {
      return text;
    }
    return null;
  }

  global.LibralyBookQr = {
    PREFIX: PREFIX,
    formatBookQrPayload: formatBookQrPayload,
    parseBookQrPayload: parseBookQrPayload,
  };
})(window);
