(function () {
  "use strict";

  const MAX_FILE_SIZE = 100 * 1024 * 1024;
  const HEX_LENGTHS = Object.freeze({
    "SHA-256": 64,
    "SHA-384": 96,
    "SHA-512": 128,
  });

  function bytesToHex(buffer) {
    return Array.from(new Uint8Array(buffer), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
  }

  function normalizeExpected(value) {
    return String(value || "").replace(/\s+/g, "").toLowerCase();
  }

  function validateExpected(value, algorithm) {
    const normalized = normalizeExpected(value);
    if (!normalized) return { valid: true, empty: true, value: "" };
    if (!Object.prototype.hasOwnProperty.call(HEX_LENGTHS, algorithm)) {
      return { valid: false, empty: false, message: "지원하지 않는 해시 알고리즘입니다." };
    }
    if (!/^[0-9a-f]+$/.test(normalized)) {
      return {
        valid: false,
        empty: false,
        message: "공식 해시는 0-9와 a-f로 이루어진 16진수만 입력하세요.",
      };
    }
    const expectedLength = HEX_LENGTHS[algorithm];
    if (normalized.length !== expectedLength) {
      return {
        valid: false,
        empty: false,
        message: `${algorithm} 해시는 ${expectedLength}자리여야 합니다. 현재 ${normalized.length}자리입니다.`,
      };
    }
    return { valid: true, empty: false, value: normalized };
  }

  function validateFile(file) {
    if (!file) return "확인할 파일을 선택하세요.";
    if (file.size > MAX_FILE_SIZE) return "최대 100MB 파일까지 계산할 수 있습니다.";
    return "";
  }

  async function digestBytes(data, algorithm, cryptoApi) {
    if (!Object.prototype.hasOwnProperty.call(HEX_LENGTHS, algorithm)) {
      throw new Error("지원하지 않는 해시 알고리즘입니다.");
    }
    const api = cryptoApi || (globalThis.crypto && globalThis.crypto.subtle);
    if (!api) throw new Error("이 브라우저는 안전한 SHA 계산을 지원하지 않습니다.");
    const result = await api.digest(algorithm, data);
    return bytesToHex(result);
  }

  function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  function readFile(file, onProgress) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("파일을 읽지 못했습니다. 파일을 다시 선택하세요."));
      reader.onabort = () => reject(new Error("파일 읽기가 취소되었습니다."));
      reader.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  if (typeof window !== "undefined") {
    window.FileHashTool = {
      MAX_FILE_SIZE,
      HEX_LENGTHS,
      bytesToHex,
      normalizeExpected,
      validateExpected,
      validateFile,
      digestBytes,
      formatBytes,
    };
  }

  if (typeof document === "undefined") return;
  const fileInput = document.getElementById("hash-file-input");
  if (!fileInput) return;

  const dropZone = document.getElementById("hash-drop-zone");
  const browseButton = document.getElementById("hash-browse-btn");
  const emptyState = document.getElementById("hash-empty-state");
  const workspace = document.getElementById("hash-workspace");
  const fileName = document.getElementById("hash-file-name");
  const fileSize = document.getElementById("hash-file-size");
  const algorithm = document.getElementById("hash-algorithm");
  const progress = document.getElementById("hash-progress");
  const output = document.getElementById("hash-output");
  const expected = document.getElementById("hash-expected");
  const calculateButton = document.getElementById("hash-calculate-btn");
  const copyButton = document.getElementById("hash-copy-btn");
  const resetButton = document.getElementById("hash-reset-btn");
  const status = document.getElementById("hash-status");
  let selectedFile = null;
  let calculationId = 0;

  function setStatus(message, type) {
    status.textContent = message || "";
    status.classList.remove("success", "error");
    if (type) status.classList.add(type);
  }

  function clearResult() {
    calculationId += 1;
    output.value = "";
    copyButton.disabled = true;
    progress.value = 0;
    progress.classList.add("hidden");
    setStatus("");
  }

  function selectFile(file) {
    const error = validateFile(file);
    if (error) {
      setStatus(error, "error");
      return;
    }
    selectedFile = file;
    fileName.textContent = file.name || "이름 없는 파일";
    fileSize.textContent = formatBytes(file.size);
    emptyState.classList.add("hidden");
    workspace.classList.remove("hidden");
    clearResult();
    algorithm.focus();
  }

  function compareResult() {
    if (!output.value) return;
    const comparison = validateExpected(expected.value, algorithm.value);
    if (!comparison.valid) {
      setStatus(comparison.message, "error");
      return;
    }
    if (comparison.empty) {
      setStatus("해시 계산이 완료되었습니다. 공식 값을 붙여넣으면 일치 여부를 확인할 수 있습니다.", "success");
      return;
    }
    if (output.value === comparison.value) {
      setStatus("일치합니다. 선택한 파일의 해시가 입력한 공식 값과 같습니다.", "success");
    } else {
      setStatus("일치하지 않습니다. 파일 버전과 공식 출처를 확인하고 파일 사용을 중단하세요.", "error");
    }
  }

  function setBusy(busy) {
    calculateButton.disabled = busy;
    browseButton.disabled = busy;
    resetButton.disabled = busy;
    algorithm.disabled = busy;
    expected.disabled = busy;
    progress.classList.toggle("hidden", !busy);
  }

  browseButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => selectFile(fileInput.files[0]));

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("dragover");
    });
  });
  dropZone.addEventListener("drop", (event) => selectFile(event.dataTransfer.files[0]));

  algorithm.addEventListener("change", () => {
    clearResult();
    setStatus("알고리즘이 바뀌었습니다. 다시 계산하세요.");
  });
  expected.addEventListener("input", compareResult);

  calculateButton.addEventListener("click", async () => {
    const fileError = validateFile(selectedFile);
    if (fileError) {
      setStatus(fileError, "error");
      return;
    }
    const comparison = validateExpected(expected.value, algorithm.value);
    if (!comparison.valid) {
      setStatus(comparison.message, "error");
      expected.focus();
      return;
    }

    const activeCalculation = ++calculationId;
    output.value = "";
    copyButton.disabled = true;
    progress.value = 0;
    setBusy(true);
    setStatus("파일을 읽고 있습니다…");
    try {
      const data = await readFile(selectedFile, (value) => {
        progress.value = value;
      });
      if (activeCalculation !== calculationId) return;
      setStatus("SHA 해시를 계산하고 있습니다…");
      output.value = await digestBytes(data, algorithm.value);
      copyButton.disabled = false;
      compareResult();
      if (window.OTX) {
        window.OTX.trackToolComplete("file-hash", {
          operation: comparison.empty ? "hash" : "compare",
          variant: algorithm.value,
        });
      }
    } catch (error) {
      setStatus(error && error.message ? error.message : "해시를 계산하지 못했습니다.", "error");
    } finally {
      if (activeCalculation === calculationId) setBusy(false);
    }
  });

  copyButton.addEventListener("click", async () => {
    if (!output.value) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(output.value);
      } else {
        output.focus();
        output.select();
        if (!document.execCommand("copy")) throw new Error("copy failed");
      }
      setStatus("해시를 클립보드에 복사했습니다.", "success");
    } catch (error) {
      setStatus("자동 복사를 사용할 수 없습니다. 결과를 길게 눌러 직접 복사하세요.", "error");
    }
  });

  resetButton.addEventListener("click", () => {
    selectedFile = null;
    fileInput.value = "";
    expected.value = "";
    algorithm.value = "SHA-256";
    clearResult();
    workspace.classList.add("hidden");
    emptyState.classList.remove("hidden");
    browseButton.focus();
  });
})();
