(function () {
  const fileInput = document.getElementById("excel-enrich-input");
  const filenameEl = document.getElementById("excel-enrich-filename");
  const actionBtn = document.getElementById("excel-enrich-btn");
  const loading = document.getElementById("excel-enrich-loading");
  const message = document.getElementById("excel-enrich-message");

  if (!fileInput || !actionBtn) return;

  let selectedFile = null;

  function showMessage(text, type) {
    message.textContent = text;
    message.classList.remove("hidden", "excel-message-success", "excel-message-error");
    message.classList.add(type === "error" ? "excel-message-error" : "excel-message-success");
  }

  function hideMessage() {
    message.classList.add("hidden");
    message.textContent = "";
  }

  function filenameFromDisposition(disposition) {
    if (!disposition) return null;
    const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8) {
      try { return decodeURIComponent(utf8[1]); } catch (_) { return utf8[1]; }
    }
    const regular = disposition.match(/filename="?([^";]+)"?/i);
    return regular ? regular[1] : null;
  }

  fileInput.addEventListener("change", () => {
    hideMessage();
    selectedFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

    if (!selectedFile) {
      filenameEl.textContent = "선택된 파일 없음";
      actionBtn.disabled = true;
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".xlsx")) {
      selectedFile = null;
      fileInput.value = "";
      filenameEl.textContent = "선택된 파일 없음";
      actionBtn.disabled = true;
      showMessage("Excel 원본 유지 점검은 XLSX 파일만 지원합니다.", "error");
      return;
    }

    filenameEl.textContent = selectedFile.name;
    actionBtn.disabled = false;
  });

  actionBtn.addEventListener("click", async () => {
    if (!selectedFile) return;

    hideMessage();
    actionBtn.disabled = true;
    loading.classList.remove("hidden");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/business/excel-enrich", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Excel 거래처 점검에 실패했습니다.");
      }

      const checked = response.headers.get("X-OTX-Checked-Count") || "";
      const attention = response.headers.get("X-OTX-Attention-Count") || "";
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFromDisposition(response.headers.get("Content-Disposition")) || "업무도구함_거래처점검.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      let text = "점검이 완료됐습니다. 원본 Excel에 조회 결과 열을 추가한 파일을 저장했습니다.";
      if (checked) text = `${checked}개 거래처 점검 완료. ` + text;
      if (attention && Number(attention) > 0) text += ` 확인이 필요한 거래처는 ${attention}개입니다.`;
      showMessage(text, "success");
    } catch (error) {
      showMessage(error.message || "Excel 처리 중 오류가 발생했습니다.", "error");
    } finally {
      loading.classList.add("hidden");
      actionBtn.disabled = !selectedFile;
    }
  });
})();
