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

  const allowedExt = ["jpg", "jpeg", "png", "webp", "heic", "heif", "bmp", "tiff"];

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
    showView(emptyView);
  }

  function onFileChosen(file) {
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop();
    if (!allowedExt.includes(ext)) {
      errorTextEl.textContent = "HEIC, JPG, PNG, WEBP, BMP, TIFF 파일만 사용할 수 있습니다.";
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
  dropZone.addEventListener("drop", (e) => onFileChosen(e.dataTransfer.files[0]));

  document.getElementById("reset-btn").addEventListener("click", reset);
  document.getElementById("reset-btn-2").addEventListener("click", reset);
  document.getElementById("reset-btn-3").addEventListener("click", reset);

  applyBtn.addEventListener("click", async () => {
    if (!currentFile) return;
    const target = document.querySelector('input[name="target-format"]:checked').value;
    showView(loadingView);

    const formData = new FormData();
    formData.append("file", currentFile);
    formData.append("target", target);

    try {
      const res = await fetch("/api/image-convert/convert", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        errorTextEl.textContent = data.error || "변환 중 오류가 발생했습니다.";
        showView(errorView);
        return;
      }
      downloadLink.href = data.download_url;
      showView(resultView);
      if (window.OTX) {
        window.OTX.trackToolComplete("image-convert", { variant: target });
      }
    } catch (err) {
      errorTextEl.textContent = "네트워크 오류가 발생했습니다. 다시 시도해주세요.";
      showView(errorView);
    }
  });
})();
