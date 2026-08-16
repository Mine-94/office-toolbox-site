(function () {
  const emptyMsg = document.getElementById("tool-search-empty");

  // --- 검색 필터 (항상 최신 DOM을 다시 조회해서 즐겨찾기/최근 섹션도 함께 필터링) ---
  const searchInput = document.getElementById("tool-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim().toLowerCase();
      const cards = document.querySelectorAll(".tool-card");
      const categories = document.querySelectorAll(".tool-category");

      cards.forEach((card) => {
        const text = card.dataset.search || "";
        const match = !q || text.includes(q);
        card.classList.toggle("hidden", !match);
      });

      let anyVisible = false;
      categories.forEach((cat) => {
        const hasCards = cat.querySelectorAll(".tool-card").length > 0;
        if (!hasCards) return; // 즐겨찾기/최근 섹션이 비어있으면 검색 결과 판단에서 제외
        const visible = cat.querySelectorAll(".tool-card:not(.hidden)").length > 0;
        cat.classList.toggle("hidden", !visible);
        if (visible) anyVisible = true;
      });

      if (emptyMsg) emptyMsg.classList.toggle("hidden", anyVisible || !q);
    });
  }

  // --- 즐겨찾기 별 토글 (이벤트 위임: 복제된 카드에도 동일하게 동작) ---
  document.addEventListener("click", (e) => {
    const star = e.target.closest(".favorite-star");
    if (!star || !window.OTX) return;
    e.preventDefault();
    e.stopPropagation();
    const slug = star.dataset.slug;
    const nowFavorite = window.OTX.toggleFavorite(slug);
    document.querySelectorAll(`.favorite-star[data-slug="${slug}"]`).forEach((el) => {
      el.classList.toggle("active", nowFavorite);
      el.setAttribute("aria-label", nowFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가");
    });
    renderFavorites();
  });

  function markFavoriteStars() {
    if (!window.OTX) return;
    const favorites = window.OTX.getFavorites();
    document.querySelectorAll(".favorite-star").forEach((el) => {
      const isFav = favorites.includes(el.dataset.slug);
      el.classList.toggle("active", isFav);
      el.setAttribute("aria-label", isFav ? "즐겨찾기 해제" : "즐겨찾기 추가");
    });
  }

  function renderIntoGrid(gridId, sectionId, slugs) {
    const grid = document.getElementById(gridId);
    const section = document.getElementById(sectionId);
    if (!grid || !section) return;
    grid.innerHTML = "";
    let count = 0;
    slugs.forEach((slug) => {
      const source = document.querySelector(`.tool-card[data-slug="${slug}"]`);
      if (!source) return;
      grid.appendChild(source.cloneNode(true));
      count += 1;
    });
    section.classList.toggle("hidden", count === 0);
  }

  function renderFavorites() {
    if (!window.OTX) return;
    renderIntoGrid("favorites-grid", "favorites-section", window.OTX.getFavorites());
  }

  function renderRecent() {
    if (!window.OTX) return;
    renderIntoGrid("recent-grid", "recent-section", window.OTX.getRecent());
  }

  markFavoriteStars();
  renderFavorites();
  renderRecent();
})();
