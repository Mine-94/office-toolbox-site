(function () {
  const input = document.getElementById("business-number");
  const button = document.getElementById("business-status-btn");
  const loading = document.getElementById("business-status-loading");
  const errorBox = document.getElementById("business-status-error");
  const resultBox = document.getElementById("business-status-result");

  if (!input || !button) return;

  function formatNumber(value) {
    const digits = (value || "").replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }

  function onlyDigits(value) {
    return (value || "").replace(/\D/g, "");
  }

  function formatDate(value) {
    if (!value || value.length !== 8) return value || "해당 없음";
    return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function statusClass(data) {
    if (!data.registered) return "business-status-neutral";
    if (data.statusCode === "01" || data.statusName.includes("계속")) return "business-status-ok";
    if (data.statusCode === "02" || data.statusName.includes("휴업")) return "business-status-warn";
    if (data.statusCode === "03" || data.statusName.includes("폐업")) return "business-status-danger";
    return "business-status-neutral";
  }

  function resetMessages() {
    errorBox.classList.add("hidden");
    resultBox.classList.add("hidden");
    errorBox.innerHTML = "";
    resultBox.innerHTML = "";
  }

  input.addEventListener("input", () => {
    input.value = formatNumber(input.value);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") button.click();
  });

  button.addEventListener("click", async () => {
    const businessNumber = onlyDigits(input.value);
    resetMessages();

    if (businessNumber.length !== 10) {
      errorBox.innerHTML = '<p class="error-text">사업자등록번호 10자리를 입력해주세요.</p>';
      errorBox.classList.remove("hidden");
      input.focus();
      return;
    }

    loading.classList.remove("hidden");
    button.disabled = true;

    try {
      const response = await fetch("/api/business/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessNumber }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "조회 중 오류가 발생했습니다.");

      const data = payload.data;
      const registeredText = data.registered ? data.statusName : "미등록 또는 확인 불가";
      const checkedAt = data.checkedAt ? new Date(data.checkedAt).toLocaleString("ko-KR") : "-";

      resultBox.innerHTML = `
        <div class="business-status-summary ${statusClass(data)}">
          <small>조회 결과</small>
          <strong>${escapeHtml(registeredText)}</strong>
          <span>${escapeHtml(data.businessNumber)}</span>
        </div>
        <table class="calc-table">
          <tbody>
            <tr><td>사업자 상태</td><td>${escapeHtml(data.statusName)}</td></tr>
            <tr><td>과세유형</td><td>${escapeHtml(data.taxType)}</td></tr>
            <tr><td>폐업일자</td><td>${escapeHtml(formatDate(data.closureDate))}</td></tr>
            <tr><td>과세유형 전환일</td><td>${escapeHtml(formatDate(data.taxTypeChangeDate))}</td></tr>
            <tr><td>세금계산서 적용일</td><td>${escapeHtml(formatDate(data.invoiceApplyDate))}</td></tr>
            <tr><td>조회 시각</td><td>${escapeHtml(checkedAt)}</td></tr>
          </tbody>
        </table>
        <p class="hint business-status-note">이 결과는 사업자등록 상태 확인용입니다. 거래 안전성이나 신용도를 보증하지 않습니다.</p>
      `;
      resultBox.classList.remove("hidden");
    } catch (error) {
      errorBox.innerHTML = `<p class="error-text">${escapeHtml(error.message)}</p>`;
      errorBox.classList.remove("hidden");
    } finally {
      loading.classList.add("hidden");
      button.disabled = false;
    }
  });
})();
