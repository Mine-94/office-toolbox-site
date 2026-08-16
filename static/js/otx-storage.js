// 사무실 공구함 공용 저장소 헬퍼 — 회원가입 없이 localStorage로 "최근 사용"과 "즐겨찾기"를 기록한다.
// 모든 페이지(base.html)에서 로드되며, window.OTX 로 다른 스크립트에서 사용한다.
(function () {
  const RECENT_KEY = "otx_recent";
  const FAVORITES_KEY = "otx_favorites";
  const MAX_RECENT = 6;

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

  window.OTX = { getRecent, recordRecent, getFavorites, isFavorite, toggleFavorite };
})();
