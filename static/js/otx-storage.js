// 업무 도구함 공용 헬퍼 — 회원가입 없이 브라우저 저장소를 사용하고,
// 개인 입력값을 제외한 도구 완료 신호만 GA4에 보낸다.
// 모든 페이지(base.html)에서 로드되며, window.OTX 로 다른 스크립트에서 사용한다.
(function () {
  const RECENT_KEY = "otx_recent";
  const FAVORITES_KEY = "otx_favorites";
  const MAX_RECENT = 6;
  const SAFE_EVENT_KEYS = new Set([
    "operation",
    "variant",
    "result_type",
    "item_count_bucket",
    "table_found",
  ]);

  function safeGet(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* localStorage unavailable (private mode 등) — 조용히 무시 */
    }
  }

  function getRecent() {
    return safeGet(RECENT_KEY);
  }

  function recordRecent(slug) {
    if (!slug) return;
    let list = getRecent().filter((s) => s !== slug);
    list.unshift(slug);
    list = list.slice(0, MAX_RECENT);
    safeSet(RECENT_KEY, list);
  }

  function getFavorites() {
    return safeGet(FAVORITES_KEY);
  }

  function isFavorite(slug) {
    return getFavorites().includes(slug);
  }

  function toggleFavorite(slug) {
    let list = getFavorites();
    const idx = list.indexOf(slug);
    if (idx === -1) {
      list.unshift(slug);
    } else {
      list.splice(idx, 1);
    }
    safeSet(FAVORITES_KEY, list);
    return list.includes(slug);
  }

  function safeEventToken(value) {
    const token = String(value == null ? "" : value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
    return token || "unknown";
  }

  function bucketCount(value) {
    const count = Math.max(0, Number(value) || 0);
    if (count <= 1) return "1";
    if (count <= 5) return "2_5";
    if (count <= 20) return "6_20";
    if (count <= 100) return "21_100";
    return "100_plus";
  }

  function buildCompletionPayload(slug, details) {
    const payload = { tool_name: safeEventToken(slug) };
    Object.entries(details || {}).forEach(([key, value]) => {
      if (!SAFE_EVENT_KEYS.has(key)) return;
      if (typeof value === "boolean") {
        payload[key] = value ? "true" : "false";
      } else {
        payload[key] = safeEventToken(value);
      }
    });
    return payload;
  }

  function trackToolComplete(slug, details) {
    if (!slug || typeof window.gtag !== "function") return false;
    window.gtag("event", "tool_complete", buildCompletionPayload(slug, details));
    return true;
  }

  function trackShare(slug, method) {
    if (!slug || typeof window.gtag !== "function") return false;
    window.gtag("event", "share", {
      method: safeEventToken(method),
      content_type: "tool",
      item_id: safeEventToken(slug),
    });
    return true;
  }

  function canonicalUrl() {
    const canonical = document.querySelector('link[rel="canonical"]');
    return canonical && canonical.href
      ? canonical.href
      : window.location.origin + window.location.pathname;
  }

  async function copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }

  function bindShareButton() {
    const button = document.querySelector("[data-share-tool]");
    if (!button) return;

    const status = document.querySelector("[data-share-status]");
    const slug = button.dataset.shareTool;
    button.addEventListener("click", async function () {
      const url = canonicalUrl();
      const title = document.title;
      try {
        if (navigator.share) {
          await navigator.share({
            title,
            text: "설치와 회원가입 없이 바로 쓰는 업무 도구",
            url,
          });
          if (status) status.textContent = "공유 창을 열었어요.";
          trackShare(slug, "native");
          return;
        }

        await copyText(url);
        if (status) status.textContent = "도구 주소를 복사했어요.";
        trackShare(slug, "clipboard");
      } catch (err) {
        if (err && err.name === "AbortError") return;
        if (status) status.textContent = "공유하지 못했습니다. 주소창의 링크를 복사해주세요.";
      }
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bindShareButton);
    } else {
      bindShareButton();
    }
  }

  window.OTX = {
    getRecent,
    recordRecent,
    getFavorites,
    isFavorite,
    toggleFavorite,
    safeEventToken,
    bucketCount,
    buildCompletionPayload,
    trackToolComplete,
    trackShare,
  };
})();
