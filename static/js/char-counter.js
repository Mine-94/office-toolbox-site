(function () {
  const input = document.getElementById("char-input");
  if (!input) return;

  const statWithSpace = document.getElementById("stat-with-space");
  const statWithoutSpace = document.getElementById("stat-without-space");
  const statBytes = document.getElementById("stat-bytes");
  const statWords = document.getElementById("stat-words");
  const statSentences = document.getElementById("stat-sentences");
  const statParagraphs = document.getElementById("stat-paragraphs");
  const statReadingTime = document.getElementById("stat-reading-time");
  const statManuscript = document.getElementById("stat-manuscript");
  const limitInput = document.getElementById("limit-input");
  const limitResult = document.getElementById("limit-result");
  const cleanBtn = document.getElementById("clean-btn");
  const copyBtn = document.getElementById("copy-btn");
  const clearBtn = document.getElementById("clear-btn");

  // 국내 일부 지원서/게시판에서 사용하는 영문 1바이트, 한글·비ASCII 2바이트 기준
  function byteLength(str) {
    let bytes = 0;
    for (const ch of str) {
      bytes += ch.codePointAt(0) > 127 ? 2 : 1;
    }
    return bytes;
  }

  function updateLimit(count) {
    const limit = parseInt(limitInput.value, 10);
    if (!limit || limit <= 0) {
      limitResult.textContent = "";
      return;
    }
    const remaining = limit - count;
    if (remaining >= 0) {
      limitResult.textContent = `${remaining.toLocaleString()}자 남음`;
      limitResult.style.color = "";
    } else {
      limitResult.textContent = `${Math.abs(remaining).toLocaleString()}자 초과`;
      limitResult.style.color = "#8a3324";
    }
  }

  function update() {
    const text = input.value;
    const withSpace = text.length;
    const withoutSpace = text.replace(/\s/g, "").length;
    const bytes = byteLength(text);
    const trimmed = text.trim();
    const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;
    const sentences =
      trimmed === ""
        ? 0
        : trimmed.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean).length;
    const paragraphs =
      trimmed === ""
        ? 0
        : text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).length;
    const readingMinutes = withoutSpace === 0 ? 0 : Math.max(1, Math.round(withoutSpace / 500));
    const manuscriptPages = withSpace === 0 ? 0 : Math.ceil(withSpace / 200);

    statWithSpace.textContent = withSpace.toLocaleString();
    statWithoutSpace.textContent = withoutSpace.toLocaleString();
    statBytes.textContent = bytes.toLocaleString();
    statWords.textContent = words.toLocaleString();
    statSentences.textContent = sentences.toLocaleString();
    statParagraphs.textContent = paragraphs.toLocaleString();
    statReadingTime.textContent = withoutSpace === 0 ? "0분" : `약 ${readingMinutes}분`;
    statManuscript.textContent = `${manuscriptPages}매`;

    updateLimit(withSpace);
  }

  input.addEventListener("input", update);
  limitInput.addEventListener("input", () => updateLimit(input.value.length));

  cleanBtn.addEventListener("click", () => {
    input.value = input.value
      .replace(/[ \t]+/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    update();
    input.focus();
  });

  copyBtn.addEventListener("click", async () => {
    if (!input.value) return;
    try {
      await navigator.clipboard.writeText(input.value);
      const original = copyBtn.textContent;
      copyBtn.textContent = "복사됨!";
      setTimeout(() => {
        copyBtn.textContent = original;
      }, 1500);
    } catch (err) {
      /* clipboard API unavailable — silently ignore */
    }
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    update();
    input.focus();
  });

  update();
})();
