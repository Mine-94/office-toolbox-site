(function () {
  const textarea = document.getElementById("bulk-business-numbers");
  const countEl = document.getElementById("bulk-count");
  const clearBtn = document.getElementById("bulk-clear-btn");
  const fileInput = document.getElementById("bulk-file-input");
  const fileMessage = document.getElementById("bulk-file-message");
  const lookupBtn = document.getElementById("bulk-status-btn");
  const loading = document.getElementById("bulk-loading");
  const errorBox = document.getElementById("bulk-error");
  const resultSection = document.getElementById("bulk-result-section");
  const resultBody = document.getElementById("bulk-result-body");
  const filter = document.getElementById("bulk-filter");
  const csvBtn = document.getElementById("bulk-csv-btn");
  const xlsxBtn = document.getElementById("bulk-xlsx-btn");

  if (!textarea || !lookupBtn) return;

  let resultRows = [];

  function normalize(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function formatNumber(value) {
    const n = normalize(value);
    if (n.length !== 10) return n;
    return `${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5)}`;
  }

  function parseInput() {
    const matches = textarea.value.match(/(?<!\d)\d{3}-?\d{2}-?\d{5}(?!\d)/g) || [];
    const seen = new Set();
    const numbers = [];
    matches.forEach((value) => {
      const n = normalize(value);
      if (n.length === 10 && !seen.has(n)) {
        seen.add(n);
        numbers.push(n);
      }
    });
    return numbers;
  }

  function updateCount() {
    const count = parseInput().length;
    countEl.textContent = `${count} / 100개`;
    countEl.classList.toggle("bulk-count-over", count > 100);
  }

  function setError(message) {
    errorBox.innerHTML = `<p class="error-text">${escapeHtml(message)}</p>`;
    errorBox.classList.remove("hidden");
  }

  function clearError() {
    errorBox.classList.add("hidden");
    errorBox.innerHTML = "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function displayDate(value) {
    if (!value) return "-";
    const text = String(value).replace(/\D/g, "");
    if (text.length === 8) return `${text.slice(0, 4)}.${text.slice(4, 6)}.${text.slice(6, 8)}`;
    return value;
  }

  function statusBucket(row) {
    if (!row.registered) return "unknown";
    const status = row.statusName || "";
    if (status.includes("폐업")) return "closed";
    if (status.includes("휴업")) return "suspended";
    if (status.includes("계속")) return "active";
    return "unknown";
  }

  function renderSummary() {
    const counts = { total: resultRows.length, active: 0, suspended: 0, closed: 0, unknown: 0 };
    resultRows.forEach((row) => { counts[statusBucket(row)] += 1; });
    Object.entries(counts).forEach(([key, value]) => {
      const el = document.getElementById(`summary-${key}`);
      if (el) el.textContent = value;
    });
  }

  function renderRows() {
    const selected = filter.value;
    const rows = selected === "all"
      ? resultRows
      : resultRows.filter((row) => statusBucket(row) === selected);

    resultBody.innerHTML = rows.map((row) => {
      const bucket = statusBucket(row);
      return `
        <tr>
          <td class="bulk-number-cell">${escapeHtml(row.businessNumber)}</td>
          <td><span class="bulk-status-badge bulk-status-${bucket}">${escapeHtml(row.statusName)}</span></td>
          <td>${escapeHtml(row.taxType)}</td>
          <td>${escapeHtml(displayDate(row.closureDate))}</td>
        </tr>`;
    }).join("");

    if (!rows.length) {
      resultBody.innerHTML = '<tr><td colspan="4" class="bulk-empty-row">해당 상태의 결과가 없습니다.</td></tr>';
    }
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadCsv() {
    if (!resultRows.length) return;
    const headers = ["사업자등록번호", "등록여부", "사업자 상태", "과세유형", "폐업일자", "과세유형 전환일", "세금계산서 적용일", "조회시각"];
    const rows = resultRows.map((row) => [
      row.businessNumber,
      row.registered ? "등록" : "미등록/확인불가",
      row.statusName,
      row.taxType,
      row.closureDate || "",
      row.taxTypeChangeDate || "",
      row.invoiceApplyDate || "",
      row.checkedAt || "",
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `business-status-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadXlsx() {
    if (!resultRows.length) return;
    xlsxBtn.disabled = true;
    try {
      const response = await fetch("/api/business/bulk-export-xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: resultRows }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Excel 파일을 만들 수 없습니다.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match ? match[1] : "business-status.xlsx";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setError(error.message);
    } finally {
      xlsxBtn.disabled = false;
    }
  }

  textarea.addEventListener("input", updateCount);
  clearBtn.addEventListener("click", () => {
    textarea.value = "";
    updateCount();
    textarea.focus();
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    clearError();
    fileMessage.textContent = "파일에서 사업자등록번호를 찾고 있어요.";
    fileMessage.classList.remove("hidden");

    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch("/api/business/bulk-parse", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "파일을 읽을 수 없습니다.");
      textarea.value = data.businessNumbers.join("\n");
      updateCount();
      fileMessage.textContent = `${data.count}개의 사업자등록번호를 불러왔습니다.${data.truncated ? " 처음 100개만 가져왔습니다." : ""}`;
    } catch (error) {
      fileMessage.classList.add("hidden");
      setError(error.message);
    } finally {
      fileInput.value = "";
    }
  });

  lookupBtn.addEventListener("click", async () => {
    clearError();
    const numbers = parseInput();
    if (!numbers.length) {
      setError("조회할 사업자등록번호를 입력해주세요.");
      return;
    }
    if (numbers.length > 100) {
      setError("한 번에 최대 100개까지 조회할 수 있습니다.");
      return;
    }

    lookupBtn.disabled = true;
    loading.classList.remove("hidden");
    resultSection.classList.add("hidden");

    try {
      const response = await fetch("/api/business/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessNumbers: numbers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "조회에 실패했습니다.");
      resultRows = data.data || [];
      renderSummary();
      renderRows();
      resultSection.classList.remove("hidden");
      resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setError(error.message);
    } finally {
      loading.classList.add("hidden");
      lookupBtn.disabled = false;
    }
  });

  filter.addEventListener("change", renderRows);
  csvBtn.addEventListener("click", downloadCsv);
  xlsxBtn.addEventListener("click", downloadXlsx);
  updateCount();
})();
