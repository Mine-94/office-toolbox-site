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
  const ocrTextEl = document.getElementById("ocr-text");
  const copyBtn = document.getElementById("copy-btn");
  const downloadTxtBtn = document.getElementById("download-txt-btn");

  const allowedExt = ["pdf", "jpg", "jpeg", "png", "bmp", "tiff", "webp"];

  let currentFile = null;

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
    ocrTextEl.value = "";
    showView(emptyView);
  }

  function onFileChosen(file) {
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop();
    if (!allowedExt.includes(ext)) {
      errorTextEl.textContent = "PDF 또는 이미지 파일만 업로드할 수 있습니다.";
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

  applyBtn.addEventListener("click", async () => {
    if (!currentFile) return;
    const lang = document.querySelector('input[name="lang"]:checked').value;

    showView(loadingView);

    const formData = new FormData();
    formData.append("file", currentFile);
    formData.append("lang", lang);

    try {
      const res = await fetch("/api/ocr/extract", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        errorTextEl.textContent = data.error || "텍스트 인식 중 오류가 발생했습니다.";
        showView(errorView);
        return;
      }
      ocrTextEl.value = data.text || "(인식된 텍스트가 없습니다)";
      showView(resultView);
    } catch (err) {
      errorTextEl.textContent = "네트워크 오류가 발생했습니다. 다시 시도해주세요.";
      showView(errorView);
    }
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(ocrTextEl.value);
      copyBtn.textContent = "복사됨!";
      setTimeout(() => (copyBtn.textContent = "복사하기"), 1500);
    } catch (err) {
      ocrTextEl.select();
      document.execCommand("copy");
    }
  });

  downloadTxtBtn.addEventListener("click", () => {
    const blob = new Blob([ocrTextEl.value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "extracted_text.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
})();
