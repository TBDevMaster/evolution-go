(function () {
  var BADGE_ID = "evolution-go-version-badge";

  function formatVersion(payload) {
    var version = typeof payload.version === "string" && payload.version.trim()
      ? payload.version.trim()
      : "dev";
    var commit = typeof payload.commit === "string" && payload.commit.trim()
      ? payload.commit.trim()
      : "unknown";

    if (commit !== "unknown" && commit.length > 10) {
      commit = commit.slice(0, 10);
    }

    return "v" + version.replace(/^v/i, "") + " - " + commit;
  }

  function createBadge() {
    var existing = document.getElementById(BADGE_ID);
    if (existing) {
      return existing;
    }

    var badge = document.createElement("div");
    badge.id = BADGE_ID;
    badge.textContent = "versao...";
    badge.style.position = "fixed";
    badge.style.top = "1rem";
    badge.style.right = "6.5rem";
    badge.style.zIndex = "2147483647";
    badge.style.display = "inline-flex";
    badge.style.alignItems = "center";
    badge.style.gap = "0.35rem";
    badge.style.minHeight = "2.25rem";
    badge.style.maxWidth = "calc(100vw - 8rem)";
    badge.style.padding = "0 0.75rem";
    badge.style.border = "1px solid rgba(16, 185, 129, 0.45)";
    badge.style.borderRadius = "999px";
    badge.style.background = "linear-gradient(135deg, rgba(6, 78, 59, 0.96), rgba(14, 116, 144, 0.94))";
    badge.style.boxShadow = "0 14px 34px rgba(2, 6, 23, 0.26)";
    badge.style.backdropFilter = "blur(10px)";
    badge.style.color = "#d1fae5";
    badge.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    badge.style.fontSize = "0.72rem";
    badge.style.fontWeight = "800";
    badge.style.letterSpacing = "0.04em";
    badge.style.lineHeight = "1";
    badge.style.whiteSpace = "nowrap";
    badge.style.pointerEvents = "none";
    badge.style.transition = "opacity 180ms ease, transform 180ms ease";
    badge.setAttribute("aria-label", "Versao atual da Evolution Go");
    badge.title = "Versao atual da Evolution Go";

    document.body.appendChild(badge);
    return badge;
  }

  function setFallbackBadge(message) {
    var badge = createBadge();
    badge.textContent = message || "versao indisponivel";
    badge.style.borderColor = "rgba(245, 158, 11, 0.55)";
    badge.style.background = "linear-gradient(135deg, rgba(120, 53, 15, 0.96), rgba(146, 64, 14, 0.94))";
    badge.style.color = "#fef3c7";
  }

  function loadVersion() {
    fetch("/server/version", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("version endpoint unavailable");
        }
        return response.json();
      })
      .then(function (payload) {
        var badge = createBadge();
        badge.textContent = formatVersion(payload || {});
        badge.title = "Evolution Go " + badge.textContent;
      })
      .catch(function () {
        setFallbackBadge("versao indisponivel");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadVersion);
  } else {
    loadVersion();
  }
})();
