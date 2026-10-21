/* Privacy-first GA4 integration for Obaid Web Lab.
   Google Analytics is not loaded until a visitor opts in. Search text and editor contents
   are never sent. Keep event parameters to the explicit allowlist below. */
(function () {
  "use strict";

  const MEASUREMENT_ID = "G-430L3RWFVF";
  const CONSENT_KEY = "owl.analytics-consent.v1";
  const $ = (selector) => document.querySelector(selector);
  let choice = readChoice();
  let enabled = false;
  let tagStarted = false;
  let routeKey = "";
  let scrollMarks = {};

  function readChoice() {
    try {
      const value = localStorage.getItem(CONSENT_KEY);
      return value === "granted" || value === "denied" ? value : null;
    } catch (_) {
      return null;
    }
  }

  function saveChoice(value) {
    choice = value;
    try { localStorage.setItem(CONSENT_KEY, value); } catch (_) {}
  }

  function pageRoute() {
    if (/\/privacy\.html$/i.test(location.pathname)) return "/privacy";
    const raw = (location.hash || "#/home").replace(/^#\/?/, "");
    const parts = raw.split("/").filter(Boolean);
    const section = parts[0] || "home";
    if (section === "class" || section === "blog") {
      const id = String(parts[1] || "").slice(0, 100);
      return "/" + section + "/" + (/^[A-Za-z0-9_-]+$/.test(id) ? id : "unknown");
    }
    return ["home", "classes", "blogs"].includes(section) ? "/" + section : "/home";
  }

  function pageView(force) {
    if (!enabled || typeof window.gtag !== "function") return;
    const route = pageRoute();
    if (!force && route === routeKey) return;
    routeKey = route;
    scrollMarks = {};
    window.gtag("event", "page_view", {
      page_title: "Obaid Web Lab",
      page_location: location.origin + location.pathname + "#" + route,
      page_path: route
    });
  }

  const allowedParams = new Set([
    "resource_type", "resource_id", "file_type", "download_type",
    "action", "results_count", "filter_type", "filter_active", "sort_mode", "percent"
  ]);

  function safeParams(params) {
    const safe = {};
    Object.keys(params || {}).forEach((key) => {
      if (!allowedParams.has(key)) return;
      const value = params[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        safe[key] = Math.max(0, Math.min(1000000, Math.round(value)));
      } else if (typeof value === "boolean") {
        safe[key] = value;
      } else if (typeof value === "string") {
        const cleaned = value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 100);
        if (cleaned) safe[key] = cleaned;
      }
    });
    return safe;
  }

  function track(eventName, params) {
    if (!enabled || typeof window.gtag !== "function") return;
    const name = String(eventName || "");
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(name)) return;
    window.gtag("event", name, safeParams(params));
  }

  function grantConsent() {
    saveChoice("granted");
    if (!window.dataLayer) window.dataLayer = [];
    if (typeof window.gtag !== "function") {
      window.gtag = function () { window.dataLayer.push(arguments); };
    }
    if (!tagStarted) {
      window.gtag("consent", "default", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        functionality_storage: "granted",
        security_storage: "granted"
      });
      window.gtag("js", new Date());
      window.gtag("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied"
      });
      window.gtag("config", MEASUREMENT_ID, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      });
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(MEASUREMENT_ID);
      script.onload = function () { tagStarted = true; };
      script.onerror = function () {
        tagStarted = false;
        enabled = false;
      };
      tagStarted = true;
      document.head.appendChild(script);
    } else {
      window.gtag("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied"
      });
    }
    enabled = true;
    routeKey = "";
    pageView(true);
  }

  function clearAnalyticsCookies() {
    document.cookie.split(";").forEach((entry) => {
      const name = entry.split("=")[0].trim();
      if (!/^_(ga|gid|gat)(_|$)/i.test(name)) return;
      document.cookie = name + "=; Max-Age=0; Path=/; SameSite=Lax";
      document.cookie = name + "=; Max-Age=0; Path=" + (location.pathname.split("/").slice(0, 2).join("/") || "/") + "; SameSite=Lax";
    });
  }

  function declineConsent() {
    saveChoice("denied");
    enabled = false;
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied"
      });
    }
    clearAnalyticsCookies();
  }

  function showBanner() {
    const banner = $("#analytics-consent");
    if (banner) {
      banner.hidden = false;
      const accept = $("#analytics-accept");
      if (accept) accept.focus();
    }
  }

  function hideBanner() {
    const banner = $("#analytics-consent");
    if (banner) banner.hidden = true;
  }

  function fileExtension(raw) {
    const clean = String(raw || "").split("#")[0].split("?")[0];
    const leaf = clean.split("/").pop() || "";
    const dot = leaf.lastIndexOf(".");
    return dot > -1 ? leaf.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) : "none";
  }

  function recordDownload(link) {
    const rawHref = link.getAttribute("href") || "";
    const ext = fileExtension(link.getAttribute("download") || rawHref);
    const isZip = /\.zip(?:[?#]|$)/i.test(rawHref) || /\.zip$/i.test(link.getAttribute("download") || "");
    const isLocalEdit = /^blob:/i.test(link.href);
    track("resource_download", {
      download_type: isLocalEdit ? "edited_file" : (isZip ? "zip" : "file"),
      file_type: isZip ? "zip" : (/^[a-z0-9]{1,10}$/.test(ext) ? ext : "other")
    });
  }

  document.addEventListener("click", function (event) {
    const target = event.target && event.target.closest ? event.target.closest("button, a") : null;
    if (!target) return;

    if (target.id === "analytics-accept") {
      grantConsent();
      hideBanner();
      return;
    }
    if (target.id === "analytics-reject") {
      declineConsent();
      hideBanner();
      return;
    }
    if (target.id === "analytics-settings-open") {
      event.preventDefault();
      showBanner();
      return;
    }

    const ide = target.closest("#owl-ide");
    const ideAction = ide && target.closest("[data-ide-action]");
    if (ideAction) {
      const action = ideAction.dataset.ideAction;
      const mapped = {
        "preview": "preview_run",
        "refresh-preview": "preview_refresh",
        "save": "draft_save",
        "download-file": "edited_file_download",
        "revert": "draft_reset",
        "toggle-explorer": "explorer_toggle",
        "toggle-find": "find_open",
        "wrap": "line_wrap_toggle",
        "help": "editor_help_open"
      };
      if (mapped[action]) track("workspace_action", { action: mapped[action] });
    }

    const ideFile = ide && target.closest("[data-ide-file]");
    if (ideFile) track("workspace_file_select", { file_type: fileExtension(ideFile.dataset.ideFile) });

    const resourceFile = !ide && target.closest("#detail-main [data-file]");
    if (resourceFile) track("resource_file_select", { resource_type: "class", file_type: fileExtension(resourceFile.dataset.file) });

    const download = target.closest("a[download]");
    if (download) recordDownload(download);

    if (target.id === "theme-toggle") {
      track("theme_toggle");
    }
  });

  window.addEventListener("hashchange", function () {
    routeKey = "";
    scrollMarks = {};
    pageView(false);
  });

  window.addEventListener("scroll", function () {
    if (!enabled) return;
    const root = document.documentElement;
    const maxScroll = root.scrollHeight - window.innerHeight;
    if (maxScroll < 160) return;
    const percent = Math.round((window.scrollY / maxScroll) * 100);
    [50, 90].forEach((threshold) => {
      if (percent >= threshold && !scrollMarks[threshold]) {
        scrollMarks[threshold] = true;
        track("scroll_depth", { percent: threshold });
      }
    });
  }, { passive: true });

  window.OWLAnalytics = {
    track: track,
    pageView: pageView,
    getConsent: function () { return choice; },
    openSettings: showBanner
  };

  function init() {
    if (choice === "granted") grantConsent();
    else if (choice === null) showBanner();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();