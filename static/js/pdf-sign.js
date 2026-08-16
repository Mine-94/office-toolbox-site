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
  const applyBtn = document.getElementById("apply-btn");
  const errorTextEl = document.getElementById("error-text");
  const downloadLink = document.getElementById("download-link");

  const canvas = document.getElementById("sign-canvas");
  const ctx = canvas.getContext("2d");
  const clearSignBtn = document.getElementById("clear-sign-btn");
  const targetPageSelect = document.getElementById("target-page");
  const customPageInput = document.getElementById("custom-page-input");
  const positionSelect = document.getElementById("position");

  let currentFile = null;
  let hasSignature = false;
  let drawing = false;

  function initCanvas() {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#101010";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    hasSignature = false;
  }
  initCanvas();

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
    const clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function startDraw(e) {
    e.preventDefault();
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }
  function moveDraw(e) {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    hasSignature = true;
  }
  function endDraw(e) {
    drawing = false;
  }

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", moveDraw);
  window.addEventListener("mouseup", endDraw);
  canvas.addEventListener("touchstart", startDraw, { passive: false });
  canvas.addEventListener("touchmove", moveDraw, { passive: false });
  canvas.addEventListener("touchend", endDraw);

  clearSignBtn.addEventListener("click", initCanvas);

  targetPageSelect.addEventListener("change", () => {
    customPageInput.classList.toggle("hidden", targetPageSelect.value !== "custom");
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
    initCanvas();
    showView(emptyView);
  }

  function onFileChosen(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      errorTextEl.textContent = "PDF 파일만 업로드할 수 있습니다.";
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
    onFileChosen(e.dataTransfer.files[0]);
  });

  document.getElementById("reset-btn").addEventListener("click", reset);
  document.getElementById("reset-btn-2").addEventListener("click", reset);
  document.getElementById("reset-btn-3").addEventListener("click", reset);

  applyBtn.addEventListener("click", () => {
    if (!currentFile) return;
    if (!hasSignature) {
      errorTextEl.textContent = "서명을 그려주세요.";
      showView(errorView);
      return;
    }

    let targetPage = targetPageSelect.value;
    if (targetPage === "custom") {
      const n = parseInt(customPageInput.value, 10);
      if (!n || n < 1) {
        errorTextEl.textContent = "페이지 번호를 올바르게 입력해주세요.";
        showView(errorView);
        return;
      }
      targetPage = String(n);
    }
    const position = positionSelect.value;

    showView(loadingView);

    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append("file", currentFile);
      formData.append("signature", blob, "signature.png");
      formData.append("target_page", targetPage);
      formData.append("position", position);

      try {
        const res = await fetch("/api/pdf-sign/apply", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
          errorTextEl.textContent = data.error || "처리 중 오류가 발생했습니다.";
          showView(errorView);
          return;
        }
        downloadLink.href = data.download_url;
        showView(resultView);
      } catch (err) {
        errorTextEl.textContent = "네트워크 오류가 발생했습니다. 다시 시도해주세요.";
        showView(errorView);
      }
    }, "image/png");
  });
})();
