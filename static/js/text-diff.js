(function () {
  const compareBtn = document.getElementById("compare-btn");
  if (!compareBtn) return;

  const textA = document.getElementById("text-a");
  const textB = document.getElementById("text-b");
  const resultEl = document.getElementById("diff-result");

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Simple LCS-based line diff
  function diffLines(a, b) {
    const n = a.length;
    const m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const ops = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        ops.push({ type: "same", text: a[i] });
        i++; j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        ops.push({ type: "removed", text: a[i] });
        i++;
      } else {
        ops.push({ type: "added", text: b[j] });
        j++;
      }
    }
    while (i < n) { ops.push({ type: "removed", text: a[i] }); i++; }
    while (j < m) { ops.push({ type: "added", text: b[j] }); j++; }
    return ops;
  }

  compareBtn.addEventListener("click", () => {
    const a = textA.value.replace(/\r\n/g, "\n").split("\n");
    const b = textB.value.replace(/\r\n/g, "\n").split("\n");

    if (!textA.value.trim() && !textB.value.trim()) {
      resultEl.innerHTML = '<p class="error-text">비교할 텍스트를 입력해주세요.</p>';
      resultEl.classList.remove("hidden");
      return;
    }

    const ops = diffLines(a, b);
    let addedCount = 0, removedCount = 0;
    const html = ops
      .map((op) => {
        const cls =
          op.type === "added" ? "diff-line-added" : op.type === "removed" ? "diff-line-removed" : "diff-line-same";
        const prefix = op.type === "added" ? "+ " : op.type === "removed" ? "- " : "  ";
        if (op.type === "added") addedCount++;
        if (op.type === "removed") removedCount++;
        return `<div class="diff-line ${cls}">${prefix}${escapeHtml(op.text) || "&nbsp;"}</div>`;
      })
      .join("");

    resultEl.innerHTML =
      `<p class="diff-summary">추가된 줄 <strong>${addedCount}</strong>개 · 삭제된 줄 <strong>${removedCount}</strong>개</p>` +
      `<div class="diff-lines">${html}</div>`;
    resultEl.classList.remove("hidden");
  });
})();
