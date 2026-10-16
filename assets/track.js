/* CoordCalc — lightweight, privacy-respecting analytics loader and tool-use tracker.
 *
 * Nothing is loaded and nothing is sent until two conditions are both met:
 *   1. a provider is configured below (`provider` set to "plausible", "umami" or
 *      "goatcounter" and the matching id filled in), and
 *   2. the visitor has accepted analytics in the consent banner (assets/consent.js).
 * With provider set to "none" the file is inert apart from buffering events in memory.
 * Inside an iframe or on an ?embed=1 page the consent gate stays shut for good.
 *
 * The script never touches the calculation logic on any page: it only listens for user
 * interaction with the calculator card and reports that the tool was used.
 */
(function () {
  "use strict";

  var CFG = {
    /* "none" | "plausible" | "umami" | "goatcounter" */
    provider: "none",
    /* Plausible: your data-domain (e.g. "coordcalc.com")
       Umami: your website id (a UUID)
       GoatCounter: your site code (e.g. "coordcalc") */
    id: "",
    /* Optional: full script URL, for a self-hosted Plausible or Umami instance.
       Leave empty to use the provider's hosted script. */
    scriptUrl: "",
    /* Report the first interaction with a calculator on each page view. */
    trackToolUse: true,
    /* Report clicks on links that leave the site. */
    trackOutbound: true,
    /* Log events to the console instead of relying on the network. */
    debug: false
  };

  var SLUG = (location.pathname.split("/").pop() || "index.html").replace(/\.html?$/, "");
  var buffer = [];
  var toolReported = false;
  var lastToolAt = 0;
  var providerLoaded = false;

  /* consent gate: assets/consent.js runs first and defines window.geoConsent.
     If it is absent for any reason, treat consent as not given. */
  function consentGranted() {
    return !!(window.geoConsent && typeof window.geoConsent.granted === "function" && window.geoConsent.granted());
  }

  function loadProvider() {
    if (providerLoaded || CFG.provider === "none" || !consentGranted()) { return; }
    providerLoaded = true;
    load(CFG.provider, CFG.id, CFG.scriptUrl);
  }

  function load(provider, id, url) {
    var s = document.createElement("script");
    s.defer = true;
    if (provider === "plausible") {
      s.src = url || "https://plausible.io/js/script.js";
      s.setAttribute("data-domain", id);
    } else if (provider === "umami") {
      s.src = url || "https://cloud.umami.is/script.js";
      s.setAttribute("data-website-id", id);
    } else if (provider === "goatcounter") {
      s.src = url || "https://gc.zgo.at/count.js";
      s.setAttribute("data-goatcounter", "https://" + id + ".goatcounter.com/count");
    } else {
      return;
    }
    s.async = true;
    document.head.appendChild(s);
  }

  function send(name, props) {
    var ev = { event: name, page: SLUG, time: new Date().toISOString(), props: props || {} };
    buffer.push(ev);
    if (buffer.length > 50) buffer.shift();
    if (CFG.debug && window.console) console.log("[geotrack]", ev);

    try {
      if (!consentGranted()) { return; }   /* events stay in the local buffer until consent */
      if (CFG.provider === "plausible" && typeof window.plausible === "function") {
        window.plausible(name, { props: props || {} });
      } else if (CFG.provider === "umami" && window.umami && typeof window.umami.track === "function") {
        window.umami.track(name, props || {});
      } else if (CFG.provider === "goatcounter" && window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({
          path: SLUG + "#" + name,
          title: name + " (" + SLUG + ")",
          event: true
        });
      }
    } catch (e) {
      /* analytics must never break the page */
    }
  }

  /* Does the target sit inside a card that contains a real calculator control? */
  function insideCalculator(node) {
    var hops = 0;
    while (node && node.nodeType === 1 && hops < 6) {
      if (node.classList && node.classList.contains("card")) {
        return !!node.querySelector("input, select, textarea, button");
      }
      node = node.parentNode;
      hops++;
    }
    return false;
  }

  function reportTool(detail) {
    var now = Date.now();
    if (toolReported && now - lastToolAt < 1500) return;
    toolReported = true;
    lastToolAt = now;
    send("tool_used", { tool: SLUG, via: detail });
  }

  function onInteract(ev) {
    if (!CFG.trackToolUse) return;
    var t = ev.target;
    if (!t || t.nodeType !== 1) return;
    if (!insideCalculator(t)) return;
    reportTool(t.tagName.toLowerCase() + (t.type ? ":" + t.type : ""));
  }

  function onOutbound(ev) {
    if (!CFG.trackOutbound) return;
    var a = ev.target;
    while (a && a.nodeType === 1 && a.tagName !== "A") a = a.parentNode;
    if (!a || a.tagName !== "A" || !a.href) return;
    if (a.hostname === location.hostname) return;
    send("outbound_click", { url: a.href, text: (a.textContent || "").trim().slice(0, 60) });
  }

  function init() {
    loadProvider();

    /* the visitor can accept later; pick it up without a reload */
    if (window.geoConsent && typeof window.geoConsent.onChange === "function") {
      window.geoConsent.onChange(loadProvider);
    }

    document.addEventListener("click", onInteract, true);
    document.addEventListener("input", onInteract, true);
    document.addEventListener("change", onInteract, true);
    document.addEventListener("submit", onInteract, true);
    document.addEventListener("click", onOutbound, false);
  }

  window.geoTrack = {
    config: CFG,
    send: send,
    events: buffer
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
