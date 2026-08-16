(function () {
  const dropZone = document.getElementById("drop-zone");
  if (!dropZone) return;

  const fileInput = document.getElementById("file-input");
  const browseBtn = document.getElementById("browse-btn");

  const emptyView = document.getElementById("drop-zone-empty");
  const selectedView = document.getElementById("file-selected");
  const loadingView = document.getElementById("loading");
  const resultView = document.getElementById("result");
  const errorView = document.getElementById("error");

  const fileNameEl = document.getElementById("file-name");
  const fileSizeEl = document.getElementById("file-size");
  const compressBtn = document.getElementById("compress-btn");
  const errorTextEl = document.getElementById("error-text");

  const originalSizeEl = document.getElementById("original-size");
  const compressedSizeEl = document.getElementById("compressed-size");
  const ratioBadgeEl = document.getElementById("ratio-badge");
  const dimensionNoteEl = document.getElementById("dimension-note");
  const downloadLink = document.getElementById("download-link");

  let currentFile = null;
  let currentMode = "quality";
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  // --- 모드 탭 (화질 기준 / 목표 용량 / 크기 지정) ---
  const modeTabs = document.querySelectorAll(".tool-tab[data-mode]");
  const modePanels = {
    quality: document.getElementById("mode-quality-panel"),
    target_size: document.getElementById("mode-target_size-panel"),
    dimensions: document.getElementById("mode-dimensions-panel"),
  };
  modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      currentMode = tab.dataset.mode;
      modeTabs.forEach((t) => t.classList.toggle("active", t === tab));
      Object.entries(modePanels).forEach(([key, panel]) => {
        if (!panel) return;
        panel.classList.toggle("hidden", key !== currentMode);
      });
    });
  });

  // --- 목표 용량 탭 ---
  const targetKbInput = document.getElementById("target-kb-input");
  document.querySelectorAll('input[name="target-size-preset"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.value === "custom") {
        targetKbInput.classList.remove("hidden");
        targetKbInput.focus();
      } else {
        targetKbInput.classList.add("hidden");
      }
    });
  });

  function getTargetKb() {
    const checked = document.querySelector('input[name="target-size-preset"]:checked');
    if (!checked) return null;
    if (checked.value === "custom") {
      const v = parseFloat(targetKbInput.value);
      return v > 0 ? v : null;
    }
    return parseFloat(checked.value);
  }

  // --- 크기 지정 탭 ---
  const targetWInput = document.getElementById("target-w-input");
  const targetHInput = document.getElementById("target-h-input");
  const fitCoverCheck = document.getElementById("fit-cover-check");
  const customDimFields = document.getElementById("custom-dim-fields");
  const presetHint = document.getElementById("preset-hint");
  document.querySelectorAll('input[name="dim-preset"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.value === "custom") {
        customDimFields.classList.remove("hidden");
        presetHint.style.display = "none";
        targetWInput.value = "";
        targetHInput.value = "";
      } else {
        customDimFields.classList.add("hidden");
        presetHint.style.display = "block";
      }
    });
  });

  function humanSize(bytes) {
    if (bytes < 1024) return bytes + "B";
    const units = ["KB", "MB", "GB"];
    let size = bytes / 1024;
    let i = 0;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return size.toFixed(1) + units[i];
  }

  function showView(view) {
    [emptyView, selectedView, loadingView, resultView, errorView].forEach((v) =>
      v.classList.add("hidden")
    );
    view.classList.remove("hidden");
  }

  function reset() {
    currentFile = null;
    fileInput.value = "";
    showView(emptyView);
  }

  function onFileChosen(file) {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      errorTextEl.textContent = "JPG, PNG, WEBP 파일만 업로드할 수 있습니다.";
      showView(errorView);
      return;
    }
    currentFile = file;
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = humanSize(file.size);
    showView(selectedView);
  }

  browseBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => onFileChosen(e.target.files[0]));

  ["dragenter", "dragover"].forEach((evt) =>
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    })
  );
  dropZone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    onFileChosen(file);
  });

  document.getElementById("reset-btn").addEventListener("click", reset);
  document.getElementById("reset-btn-2").addEventListener("click", reset);
  document.getElementById("reset-btn-3").addEventListener("click", reset);

  compressBtn.addEventListener("click", async () => {
    if (!currentFile) return;

    const formData = new FormData();
    formData.append("file", currentFile);
    formData.append("mode", currentMode);

    if (currentMode === "target_size") {
      const targetKb = getTargetKb();
      if (!targetKb) {
        errorTextEl.textContent = "목표 용량을 입력해주세요.";
        showView(errorView);
        return;
      }
      formData.append("target_kb", targetKb);
    } else if (currentMode === "dimensions") {
      const presetEl = document.querySelector('input[name="dim-preset"]:checked');
      if (presetEl && presetEl.value !== "custom") {
        formData.append("preset", presetEl.value);
      } else {
        const w = parseInt(targetWInput.value, 10);
        const h = parseInt(targetHInput.value, 10);
        if (!w && !h) {
          errorTextEl.textContent = "가로 또는 세로 크기를 입력해주세요.";
          showView(errorView);
          return;
        }
        if (w) formData.append("target_w", w);
        if (h) formData.append("target_h", h);
        formData.append("fit", fitCoverCheck.checked ? "cover" : "contain");
      }
      const qEl = document.querySelector('input[name="quality"]:checked');
      formData.append("quality", qEl ? qEl.value : "medium");
    } else {
      const quality = document.querySelector('input[name="quality"]:checked').value;
      const resize = document.querySelector('input[name="resize"]:checked').value;
      formData.append("quality", quality);
      formData.append("resize", resize);
    }

    showView(loadingView);

    try {
      const res = await fetch("/api/image-compress/process", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        errorTextEl.textContent = data.error || "처리 중 오류가 발생했습니다.";
        showView(errorView);
        return;
      }

      originalSizeEl.textContent = data.original_size_human;
      compressedSizeEl.textContent = data.compressed_size_human;
      if (data.mode === "target_size") {
        ratioBadgeEl.textContent = data.target_reached
          ? "목표 용량 이하로 완성"
          : "최대한 줄였어요";
      } else {
        ratioBadgeEl.textContent = data.used_original
          ? "이미 최적화됨"
          : `${data.ratio}% 감소`;
      }
      dimensionNoteEl.textContent =
        data.original_dimensions === data.new_dimensions
          ? `크기: ${data.original_dimensions} (변경 없음)`
          : `크기: ${data.original_dimensions} → ${data.new_dimensions}`;
      downloadLink.href = data.download_url;
      showView(resultView);
    } catch (err) {
      errorTextEl.textContent = "네트워크 오류가 발생했습니다. 다시 시도해주세요.";
      showView(errorView);
    }
  });
})();
