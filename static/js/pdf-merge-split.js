(function () {
  const tabButtons = document.querySelectorAll(".tool-tab");
  const mergePanel = document.getElementById("merge-panel");
  const splitPanel = document.getElementById("split-panel");
  if (!mergePanel || !splitPanel) return;

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (btn.dataset.tab === "merge") {
        mergePanel.classList.remove("hidden");
        splitPanel.classList.add("hidden");
      } else {
        splitPanel.classList.remove("hidden");
        mergePanel.classList.add("hidden");
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

  // -------------------------------------------------------------------
  // 병합 (Merge)
  // -------------------------------------------------------------------
  (function initMerge() {
    const dropZone = document.getElementById("merge-drop-zone");
    const fileInput = document.getElementById("merge-file-input");
    const browseBtn = document.getElementById("merge-browse-btn");
    const addBtn = document.getElementById("merge-add-btn");

    const emptyView = document.getElementById("merge-empty");
    const selectedView = document.getElementById("merge-selected");
    const loadingView = document.getElementById("merge-loading");
    const resultView = document.getElementById("merge-result");
    const errorView = document.getElementById("merge-error");

    const fileListEl = document.getElementById("merge-file-list");
    const mergeBtn = document.getElementById("merge-btn");
    const errorTextEl = document.getElementById("merge-error-text");
    const downloadLink = document.getElementById("merge-download-link");

    let files = [];

    function showView(view) {
      [emptyView, selectedView, loadingView, resultView, errorView].forEach((v) =>
        v.classList.add("hidden")
      );
      view.classList.remove("hidden");
    }

    function renderFileList() {
      fileListEl.innerHTML = "";
      files.forEach((file, idx) => {
        const li = document.createElement("li");
        li.className = "file-list-item";
        const label = document.createElement("span");
        label.textContent = `${idx + 1}. ${file.name} (${humanSize(file.size)})`;
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "file-list-remove";
        removeBtn.textContent = "✕";
        removeBtn.addEventListener("click", () => {
          files.splice(idx, 1);
          if (files.length === 0) {
            reset();
          } else {
            renderFileList();
          }
        });
        li.appendChild(label);
        li.appendChild(removeBtn);
        fileListEl.appendChild(li);
      });
    }

    function reset() {
      files = [];
      fileInput.value = "";
      showView(emptyView);
    }

    function addFiles(fileArr) {
      const pdfFiles = Array.from(fileArr).filter((f) =>
        f.name.toLowerCase().endsWith(".pdf")
      );
      if (pdfFiles.length === 0) {
        errorTextEl.textContent = "PDF 파일만 업로드할 수 있습니다.";
        showView(errorView);
        return;
      }
      files = files.concat(pdfFiles);
      renderFileList();
      showView(selectedView);
    }

    browseBtn.addEventListener("click", () => fileInput.click());
    addBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      addFiles(e.target.files);
      fileInput.value = "";
    });

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
      addFiles(e.dataTransfer.files);
    });

    document.getElementById("merge-reset-btn").addEventListener("click", reset);
    document.getElementById("merge-reset-btn-2").addEventListener("click", reset);
    document.getElementById("merge-reset-btn-3").addEventListener("click", reset);

    mergeBtn.addEventListener("click", async () => {
      if (files.length < 2) {
        errorTextEl.textContent = "합칠 PDF 파일을 2개 이상 선택해주세요.";
        showView(errorView);
        return;
      }

      showView(loadingView);

      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));

      try {
        const res = await fetch("/api/pdf-merge-split/merge", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (!res.ok) {
          errorTextEl.textContent = data.error || "병합 중 오류가 발생했습니다.";
          showView(errorView);
          return;
        }

        downloadLink.href = data.download_url;
        showView(resultView);
        if (window.OTX) {
          window.OTX.trackToolComplete("pdf-merge-split", {
            operation: "merge",
            item_count_bucket: window.OTX.bucketCount(files.length),
          });
        }
      } catch (err) {
        errorTextEl.textContent = "네트워크 오류가 발생했습니다. 다시 시도해주세요.";
        showView(errorView);
      }
    });
  })();

  // -------------------------------------------------------------------
  // 분할 (Split)
  // -------------------------------------------------------------------
  (function initSplit() {
    const dropZone = document.getElementById("split-drop-zone");
    const fileInput = document.getElementById("split-file-input");
    const browseBtn = document.getElementById("split-browse-btn");

    const emptyView = document.getElementById("split-empty");
    const selectedView = document.getElementById("split-selected");
    const loadingView = document.getElementById("split-loading");
    const resultView = document.getElementById("split-result");
    const errorView = document.getElementById("split-error");

    const fileNameEl = document.getElementById("split-file-name");
    const fileSizeEl = document.getElementById("split-file-size");
    const rangeInput = document.getElementById("split-range-input");
    const splitBtn = document.getElementById("split-btn");
    const errorTextEl = document.getElementById("split-error-text");
    const downloadLink = document.getElementById("split-download-link");

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
      rangeInput.value = "";
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

    document.getElementById("split-reset-btn").addEventListener("click", reset);
    document.getElementById("split-reset-btn-2").addEventListener("click", reset);
    document.getElementById("split-reset-btn-3").addEventListener("click", reset);

    document.querySelectorAll('input[name="split-mode"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        const mode = document.querySelector('input[name="split-mode"]:checked').value;
        if (mode === "range") {
          rangeInput.classList.remove("hidden");
        } else {
          rangeInput.classList.add("hidden");
        }
      });
    });

    splitBtn.addEventListener("click", async () => {
      if (!currentFile) return;
      const mode = document.querySelector('input[name="split-mode"]:checked').value;

      if (mode === "range" && !rangeInput.value.trim()) {
        errorTextEl.textContent = "페이지 범위를 입력해주세요. 예: 1-3, 5, 7-9";
        showView(errorView);
        return;
      }

      showView(loadingView);

      const formData = new FormData();
      formData.append("file", currentFile);
      formData.append("mode", mode);
      formData.append("range", rangeInput.value.trim());

      try {
        const res = await fetch("/api/pdf-merge-split/split", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (!res.ok) {
          errorTextEl.textContent = data.error || "분할 중 오류가 발생했습니다.";
          showView(errorView);
          return;
        }

        downloadLink.href = data.download_url;
        showView(resultView);
        if (window.OTX) {
          window.OTX.trackToolComplete("pdf-merge-split", {
            operation: "split",
            variant: mode,
          });
        }
      } catch (err) {
        errorTextEl.textContent = "네트워크 오류가 발생했습니다. 다시 시도해주세요.";
        showView(errorView);
      }
    });
  })();
})();
