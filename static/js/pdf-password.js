(function () {
  const tabButtons = document.querySelectorAll(".tool-tab");
  const encPanel = document.getElementById("encrypt-panel");
  const decPanel = document.getElementById("decrypt-panel");
  if (!encPanel || !decPanel) return;

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (btn.dataset.tab === "encrypt") {
        encPanel.classList.remove("hidden");
        decPanel.classList.add("hidden");
      } else {
        decPanel.classList.remove("hidden");
        encPanel.classList.add("hidden");
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

  function initPanel(prefix, endpoint, resultText) {
    const dropZone = document.getElementById(prefix + "-drop-zone");
    const fileInput = document.getElementById(prefix + "-file-input");
    const browseBtn = document.getElementById(prefix + "-browse-btn");

    const emptyView = document.getElementById(prefix + "-empty");
    const selectedView = document.getElementById(prefix + "-selected");
    const loadingView = document.getElementById(prefix + "-loading");
    const resultView = document.getElementById(prefix + "-result");
    const errorView = document.getElementById(prefix + "-error");

    const fileNameEl = document.getElementById(prefix + "-file-name");
    const fileSizeEl = document.getElementById(prefix + "-file-size");
    const passwordInput = document.getElementById(prefix + "-password");
    const actionBtn = document.getElementById(prefix + "-btn");
    const errorTextEl = document.getElementById(prefix + "-error-text");
    const downloadLink = document.getElementById(prefix + "-download-link");

    let currentFile = null;

    function showView(view) {
      [emptyView, selectedView, loadingView, resultView, errorView].forEach((v) =>
        v.classList.add("hidden")
      );
      view.classList.remove("hidden");
    }

    function reset() {
      currentFile = null;
      fileInput.value = "";
      passwordInput.value = "";
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
    dropZone.addEventListener("drop", (e) => onFileChosen(e.dataTransfer.files[0]));

    document.getElementById(prefix + "-reset-btn").addEventListener("click", reset);
    document.getElementById(prefix + "-reset-btn-2").addEventListener("click", reset);
    document.getElementById(prefix + "-reset-btn-3").addEventListener("click", reset);

    actionBtn.addEventListener("click", async () => {
      if (!currentFile) return;
      const password = passwordInput.value;
      if (!password) {
        errorTextEl.textContent = "비밀번호를 입력해주세요.";
        showView(errorView);
        return;
      }

      showView(loadingView);

      const formData = new FormData();
      formData.append("file", currentFile);
      formData.append("password", password);

      try {
        const res = await fetch(endpoint, { method: "POST", body: formData });
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
    });
  }

  initPanel("encrypt", "/api/pdf-password/encrypt");
  initPanel("decrypt", "/api/pdf-password/decrypt");
})();
