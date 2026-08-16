(function () {
  const input = document.getElementById("tool-search-input");
  if (!input) return;

  const cards = Array.from(document.querySelectorAll(".tool-card"));
  const categories = Array.from(document.querySelectorAll(".tool-category"));
  const emptyMsg = document.getElementById("tool-search-empty");

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();

    cards.forEach((card) => {
      const text = card.dataset.search || "";
      const match = !q || text.includes(q);
      card.classList.toggle("hidden", !match);
    });

    let anyVisible = false;
    categories.forEach((cat) => {
      const visible = cat.querySelectorAll(".tool-card:not(.hidden)").length > 0;
      cat.classList.toggle("hidden", !visible);
      if (visible) anyVisible = true;
    });

    if (emptyMsg) emptyMsg.classList.toggle("hidden", anyVisible || !q);
  });
})();
