/**
 * 図書館保守システム — グローバルナビ共通
 */
(function (global) {
  var SECTION_LENDING = "lending";
  var SECTION_INQUIRY = "inquiry";
  var SECTION_MAINTENANCE = "maintenance";

  var GLOBAL_ITEMS = [
    { id: SECTION_LENDING, label: "貸出・返却", href: "index.html" },
    { id: SECTION_INQUIRY, label: "貸出履歴照会", href: "inquiry.html" },
    { id: SECTION_MAINTENANCE, label: "マスタ保守", href: "admin.html" },
  ];

  var MAINTENANCE_ITEMS = [
    { id: "admin", label: "マスタ保守", href: "admin.html" },
    { id: "books", label: "図書", href: "books.html" },
    { id: "categories", label: "カテゴリ", href: "categories.html" },
    { id: "students", label: "学生", href: "students.html" },
    { id: "staff", label: "担当者", href: "staff.html" },
    { id: "masters", label: "学部・学科", href: "masters.html" },
  ];

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderGlobalNav(hostEl, activeSection) {
    if (!hostEl) return;
    hostEl.className = "global-nav";
    hostEl.setAttribute("aria-label", "メインメニュー");
    hostEl.innerHTML = GLOBAL_ITEMS.map(function (item) {
      var current =
        item.id === activeSection ? ' aria-current="page"' : "";
      return (
        '<a href="' +
        escapeHtml(item.href) +
        '"' +
        current +
        ">" +
        escapeHtml(item.label) +
        "</a>"
      );
    }).join("");
  }

  function renderMaintenanceSubNav(hostEl, activePage) {
    if (!hostEl) return;
    hostEl.className = "sub-nav";
    hostEl.setAttribute("aria-label", "マスタ保守メニュー");
    hostEl.innerHTML = MAINTENANCE_ITEMS.map(function (item) {
      var current = item.id === activePage ? ' aria-current="page"' : "";
      return (
        '<a href="' +
        escapeHtml(item.href) +
        '"' +
        current +
        ">" +
        escapeHtml(item.label) +
        "</a>"
      );
    }).join("");
  }

  function renderBreadcrumb(hostEl, items) {
    if (!hostEl || !items || items.length === 0) return;
    hostEl.className = "breadcrumb";
    hostEl.setAttribute("aria-label", "パンくず");
    var html = "";
    items.forEach(function (item, index) {
      if (index > 0) {
        html += '<span class="breadcrumb__sep" aria-hidden="true">›</span>';
      }
      if (item.href && index < items.length - 1) {
        html +=
          '<a href="' +
          escapeHtml(item.href) +
          '">' +
          escapeHtml(item.label) +
          "</a>";
      } else {
        html +=
          '<span class="breadcrumb__current" aria-current="page">' +
          escapeHtml(item.label) +
          "</span>";
      }
    });
    hostEl.innerHTML = html;
  }

  function isInquiryMode() {
    return new URLSearchParams(global.location.search).get("mode") === "inquiry";
  }

  global.LibralyNav = {
    SECTION_LENDING: SECTION_LENDING,
    SECTION_INQUIRY: SECTION_INQUIRY,
    SECTION_MAINTENANCE: SECTION_MAINTENANCE,
    renderGlobalNav: renderGlobalNav,
    renderMaintenanceSubNav: renderMaintenanceSubNav,
    renderBreadcrumb: renderBreadcrumb,
    isInquiryMode: isInquiryMode,
  };
})(window);
