/* CoordCalc — consent gate and banner.
 *
 * Loaded before track.js on every page. Nothing here makes a network request:
 * the file only records the visitor's choice, exposes it as window.geoConsent,
 * and draws the banner. track.js reads window.geoConsent.granted() before it
 * loads any analytics provider, so no third-party request happens until the
 * visitor has accepted.
 *
 * Choice is stored in localStorage under "coordcalc-consent":
 *   "granted"   — analytics may load
 *   "essential" — analytics never loads
 *   (absent)    — unset, the banner is shown
 *
 * Inside an iframe, or on a page loaded with ?embed=1, the banner is never
 * shown and analytics never loads: the host page owns that consent decision.
 */
(function () {
  "use strict";

  var KEY = "coordcalc-consent";

  var inFrame = false;
  try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }
  var EMBED = inFrame || /(?:\?|&)embed=1?(?:&|$)/.test(location.search);

  /* the banner can be drawn from any directory depth (zh/ pages too), so resolve the
     privacy link against the directory this script itself was served from */
  var PRIVACY_URL = "privacy#cookies";
  try {
    if (document.currentScript && document.currentScript.src) {
      var root = document.currentScript.src.replace(/assets\/consent\.js.*$/, "");
      if (root) { PRIVACY_URL = root + "privacy#cookies"; }
    }
  } catch (e) { /* keep the relative fallback */ }

  function stored() {
    try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; }
  }
  function persist(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* private mode: choice lasts for the visit */ }
  }

  var listeners = [];
  function fire() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](window.geoConsent.status()); } catch (e) { /* a listener must not break the rest */ }
    }
  }

  var banner = null;

  /* the banner is drawn in the language of the page it sits on */
  var ZH = /^zh\b/i.test(document.documentElement.getAttribute("lang") || "");
  var TEXT = ZH ? {
      title: "要允许本站统计哪些计算器被使用吗？",
      body: "所有计算本来就都在你的浏览器里完成，输入的任何内容都不会被发送。如果你接受，" +
            "会加载一个注重隐私的统计脚本，让我们知道哪些工具值得改进——它不设广告 Cookie，" +
            "也不会跟随你去其他网站。",
      more: "了解详情",
      accept: "接受统计",
      essential: "仅必要 Cookie"
    } : {
      title: "May this site count which calculators get used?",
      body: "Every calculation already runs in your browser and nothing you type is ever sent anywhere. " +
            "If you accept, one privacy-friendly analytics script loads so we know which tools to improve. " +
            "It sets no advertising cookies and follows you to no other site.",
      more: "Details",
      accept: "Accept analytics",
      essential: "Essential only"
    };

  function buildBanner() {
    var el = document.createElement("div");
    el.className = "gc-consent";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", ZH ? "Cookie 与统计授权" : "Cookie and analytics consent");
    el.innerHTML =
      '<div class="gc-consent-in">' +
        '<p class="gc-consent-t">' +
          "<b>" + TEXT.title + "</b> " +
          TEXT.body + " " +
          '<a href="' + PRIVACY_URL + '">' + TEXT.more + "</a>." +
        "</p>" +
        '<div class="gc-consent-a">' +
          '<button type="button" class="gc-btn gc-btn-p" data-c="granted">' + TEXT.accept + "</button>" +
          '<button type="button" class="gc-btn" data-c="essential">' + TEXT.essential + "</button>" +
        "</div>" +
      "</div>";
    document.body.appendChild(el);

    el.addEventListener("click", function (ev) {
      var b = ev.target;
      while (b && b.nodeType === 1 && !b.getAttribute("data-c")) { b = b.parentNode; }
      var c = b && b.getAttribute ? b.getAttribute("data-c") : null;
      if (c) { window.geoConsent.choose(c); }
    });
    return el;
  }

  var STYLE =
    ".gc-consent{position:fixed;left:0;right:0;bottom:0;z-index:9999;padding:0 14px 14px;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',Roboto,'Helvetica Neue',Arial,sans-serif;}" +
    ".gc-consent-in{max-width:780px;margin:0 auto;background:#101828;color:#e6eaf2;border-radius:14px;" +
      "padding:16px 20px;box-shadow:0 10px 34px rgba(9,14,26,.34);display:flex;gap:18px;align-items:center;" +
      "flex-wrap:wrap;}" +
    ".gc-consent-t{margin:0;font-size:13px;line-height:1.62;color:#c7d0de;flex:1 1 380px;}" +
    ".gc-consent-t b{color:#fff;}" +
    ".gc-consent-t a{color:#8ab4ff;text-decoration:underline;}" +
    ".gc-consent-a{display:flex;gap:9px;flex:0 0 auto;flex-wrap:wrap;}" +
    ".gc-btn{font:inherit;font-size:13px;font-weight:600;padding:9px 15px;border-radius:9px;cursor:pointer;" +
      "background:transparent;color:#e6eaf2;border:1px solid #3d4a60;transition:.15s;white-space:nowrap;}" +
    ".gc-btn:hover{border-color:#8ab4ff;color:#8ab4ff;}" +
    ".gc-btn-p{background:#2563eb;border-color:#2563eb;color:#fff;}" +
    ".gc-btn-p:hover{background:#1d4ed8;border-color:#1d4ed8;color:#fff;}" +
    "@media(max-width:560px){.gc-consent{padding:0 8px 8px;}.gc-consent-a{width:100%;}" +
      ".gc-consent-a .gc-btn{flex:1 1 auto;}}";

  function injectStyle() {
    var s = document.createElement("style");
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function show() {
    if (banner) { banner.style.display = ""; return; }
    injectStyle();
    banner = buildBanner();
  }
  function hide() {
    if (banner) { banner.style.display = "none"; }
  }

  window.geoConsent = {
    /* true when the page runs in a frame or was loaded with ?embed=1 */
    embedded: EMBED,
    /* "granted" | "essential" | "unset" */
    status: function () {
      if (EMBED) { return "essential"; }
      var v = stored();
      return v === "granted" || v === "essential" ? v : "unset";
    },
    /* may a third-party analytics script load? */
    granted: function () {
      return !EMBED && stored() === "granted";
    },
    choose: function (value) {
      if (EMBED) { return; }   /* inside a frame the host page owns the consent decision */
      if (value !== "granted" && value !== "essential") { return; }
      persist(value);
      hide();
      fire();
    },
    /* re-open the banner, e.g. from a "cookie settings" link */
    open: function () {
      if (EMBED) { return; }
      show();
    },
    onChange: function (fn) {
      if (typeof fn === "function") { listeners.push(fn); }
    }
  };

  if (!EMBED && stored() === "") { show(); }
})();
