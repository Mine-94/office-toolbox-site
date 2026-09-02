(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.QuoteStatement = api;
  if (root && root.document) {
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", api.init);
    } else {
      api.init();
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "otx-quote-statement-draft-v1";
  const MAX_ITEMS = 20;
  const MAX_LOGO_BYTES = 2 * 1024 * 1024;

  function parseNumber(value) {
    const normalized = String(value == null ? "" : value).replace(/,/g, "").trim();
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function won(value) {
    return `${Math.round(parseNumber(value)).toLocaleString("ko-KR")}원`;
  }

  function formatBusinessNumber(value) {
    const digits = String(value == null ? "" : value).replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }

  function calculateLine(item, priceMode) {
    const quantity = Math.max(0, parseNumber(item.quantity));
    const unitPrice = Math.max(0, parseNumber(item.unitPrice));
    const enteredTotal = Math.round(quantity * unitPrice);
    let supply = enteredTotal;
    let vat = 0;
    let total = enteredTotal;

    if (item.taxType !== "exempt") {
      if (priceMode === "inclusive") {
        supply = Math.round(enteredTotal / 1.1);
        vat = enteredTotal - supply;
      } else {
        vat = Math.round(supply * 0.1);
        total = supply + vat;
      }
    }

    return { supply, vat, total };
  }

  function calculateTotals(items, priceMode) {
    return items.reduce(
      function (totals, item) {
        const line = calculateLine(item, priceMode);
        totals.supply += line.supply;
        totals.vat += line.vat;
        totals.total += line.total;
        return totals;
      },
      { supply: 0, vat: 0, total: 0 }
    );
  }

  function todayIso() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }

  function addDaysIso(isoDate, days) {
    const date = new Date(`${isoDate}T12:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function displayDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "-";
    const parts = value.split("-");
    return `${parts[0]}. ${parts[1]}. ${parts[2]}.`;
  }

  function init() {
    const form = document.getElementById("quote-form");
    if (!form || form.dataset.initialized === "true") return;
    form.dataset.initialized = "true";

    const editorBody = document.getElementById("item-editor-body");
    const errorBox = document.getElementById("quote-form-error");
    const saveStatus = document.getElementById("save-status");
    const autoSave = document.getElementById("auto-save");
    let documentType = "quote";
    let rowSequence = 0;
    let logoObjectUrl = "";
    let saveTimer = null;

    const fieldIds = [
      "document-number", "document-date", "valid-until", "supplier-name",
      "supplier-representative", "supplier-business-number", "supplier-contact",
      "supplier-address", "client-name", "client-contact-person",
      "client-business-number", "client-contact", "price-mode", "payment-terms",
      "bank-account", "notes"
    ];

    function field(id) { return document.getElementById(id); }
    function text(id) { return (field(id).value || "").trim(); }

    function setText(id, value, fallback) {
      field(id).textContent = value || fallback || "-";
    }

    function makeDocumentNumber(type, date) {
      const compactDate = (date || todayIso()).replace(/-/g, "");
      return `${type === "statement" ? "S" : "Q"}-${compactDate}-001`;
    }

    function createInput(className, options) {
      const input = document.createElement(options.tag || "input");
      input.className = className;
      if (options.type) input.type = options.type;
      if (options.placeholder) input.placeholder = options.placeholder;
      if (options.min != null) input.min = options.min;
      if (options.step != null) input.step = options.step;
      if (options.maxLength) input.maxLength = options.maxLength;
      if (options.inputMode) input.inputMode = options.inputMode;
      return input;
    }

    function addItem(item) {
      if (editorBody.children.length >= MAX_ITEMS) {
        showError(`품목은 최대 ${MAX_ITEMS}개까지 추가할 수 있습니다.`);
        return;
      }

      const data = item || {};
      rowSequence += 1;
      const row = document.createElement("tr");
      row.dataset.rowId = String(rowSequence);

      const name = createInput("item-name", { maxLength: 60, placeholder: "품목명" });
      const spec = createInput("item-spec", { maxLength: 30, placeholder: "선택" });
      const quantity = createInput("item-quantity", { type: "number", min: "0", step: "0.01", inputMode: "decimal" });
      const unit = createInput("item-unit", { maxLength: 12, placeholder: "개" });
      const unitPrice = createInput("item-unit-price", { type: "number", min: "0", step: "1", inputMode: "numeric" });
      const taxType = document.createElement("select");
      taxType.className = "item-tax-type";
      taxType.innerHTML = '<option value="taxable">일반 10%</option><option value="exempt">면세</option>';
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-item-btn";
      remove.setAttribute("aria-label", "이 품목 삭제");
      remove.textContent = "×";

      name.value = data.name || "";
      spec.value = data.spec || "";
      quantity.value = data.quantity == null ? "1" : data.quantity;
      unit.value = data.unit || "개";
      unitPrice.value = data.unitPrice == null ? "" : data.unitPrice;
      taxType.value = data.taxType === "exempt" ? "exempt" : "taxable";

      [name, spec, quantity, unit, unitPrice, taxType, remove].forEach(function (control) {
        const cell = document.createElement("td");
        cell.appendChild(control);
        row.appendChild(cell);
      });

      remove.addEventListener("click", function () {
        if (editorBody.children.length === 1) {
          name.value = "";
          spec.value = "";
          quantity.value = "1";
          unit.value = "개";
          unitPrice.value = "";
          taxType.value = "taxable";
        } else {
          row.remove();
        }
        updateAll();
      });

      row.querySelectorAll("input, select").forEach(function (control) {
        control.addEventListener("input", updateAll);
        control.addEventListener("change", updateAll);
      });
      editorBody.appendChild(row);
      updateAll();
    }

    function getItems() {
      return Array.from(editorBody.querySelectorAll("tr")).map(function (row) {
        return {
          name: row.querySelector(".item-name").value.trim(),
          spec: row.querySelector(".item-spec").value.trim(),
          quantity: row.querySelector(".item-quantity").value,
          unit: row.querySelector(".item-unit").value.trim(),
          unitPrice: row.querySelector(".item-unit-price").value,
          taxType: row.querySelector(".item-tax-type").value
        };
      });
    }

    function renderParty(targetId, rows) {
      const list = field(targetId);
      list.replaceChildren();
      rows.forEach(function (pair) {
        const wrapper = document.createElement("div");
        const term = document.createElement("dt");
        const description = document.createElement("dd");
        term.textContent = pair[0];
        description.textContent = pair[1] || "-";
        wrapper.append(term, description);
        list.appendChild(wrapper);
      });
    }

    function updatePreview() {
      setText("preview-document-number", text("document-number"));
      setText("preview-document-date", displayDate(text("document-date")));
      setText("preview-valid-until", displayDate(text("valid-until")));
      setText("preview-client-greeting", text("client-name"), "공급받는 자");
      setText("preview-payment-terms", text("payment-terms"));
      setText("preview-bank-account", text("bank-account"));
      setText("preview-notes", text("notes"));

      renderParty("preview-supplier", [
        ["상호", text("supplier-name")],
        ["대표자", text("supplier-representative")],
        ["등록번호", text("supplier-business-number")],
        ["연락처", text("supplier-contact")],
        ["주소", text("supplier-address")]
      ]);
      renderParty("preview-client", [
        ["상호·이름", text("client-name")],
        ["담당자", text("client-contact-person")],
        ["등록번호", text("client-business-number")],
        ["연락처", text("client-contact")]
      ]);

      const items = getItems();
      const priceMode = field("price-mode").value;
      const previewItems = field("preview-items");
      previewItems.replaceChildren();

      items.forEach(function (item) {
        const line = calculateLine(item, priceMode);
        const row = document.createElement("tr");
        const values = [
          item.name || "-", item.spec || "-", parseNumber(item.quantity) || "-",
          item.unit || "-", won(line.supply), won(line.vat), won(line.total)
        ];
        values.forEach(function (value) {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.appendChild(cell);
        });
        previewItems.appendChild(row);
      });

      const totals = calculateTotals(items, priceMode);
      setText("preview-supply-total", won(totals.supply));
      setText("preview-vat-total", won(totals.vat));
      setText("preview-grand-total", won(totals.total));
    }

    function collectDraft() {
      const fields = {};
      fieldIds.forEach(function (id) { fields[id] = field(id).value; });
      return { version: 1, autoSave: true, documentType, fields, items: getItems() };
    }

    function saveDraft() {
      if (!autoSave.checked) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(collectDraft()));
        saveStatus.textContent = "저장됨";
      } catch (error) {
        saveStatus.textContent = "저장 실패";
      }
    }

    function scheduleSave() {
      if (!autoSave.checked) return;
      saveStatus.textContent = "저장 중…";
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(saveDraft, 300);
    }

    function updateAll() {
      errorBox.classList.add("hidden");
      updatePreview();
      scheduleSave();
    }

    function showError(message, target) {
      errorBox.textContent = message;
      errorBox.classList.remove("hidden");
      errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
      if (target && typeof target.focus === "function") target.focus();
    }

    function setDocumentType(type, keepNumber) {
      documentType = type === "statement" ? "statement" : "quote";
      document.querySelectorAll(".document-type-btn").forEach(function (button) {
        const active = button.dataset.documentType === documentType;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      const isStatement = documentType === "statement";
      setText("preview-document-title", isStatement ? "거래명세서" : "견적서");
      setText("preview-document-kicker", isStatement ? "TRANSACTION STATEMENT" : "QUOTATION");
      setText("preview-greeting-action", isStatement ? "거래 내역을 확인합니다." : "견적합니다.");
      field("valid-until-field").classList.toggle("hidden", isStatement);
      field("preview-valid-row").classList.toggle("hidden", isStatement);
      if (!keepNumber) field("document-number").value = makeDocumentNumber(documentType, text("document-date"));
      updateAll();
    }

    function restoreDraft() {
      try {
        const draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (!draft || draft.version !== 1 || draft.autoSave !== true) return false;
        Object.keys(draft.fields || {}).forEach(function (id) {
          if (fieldIds.includes(id) && field(id)) field(id).value = draft.fields[id];
        });
        editorBody.replaceChildren();
        (Array.isArray(draft.items) && draft.items.length ? draft.items : [{}]).slice(0, MAX_ITEMS).forEach(addItem);
        autoSave.checked = true;
        saveStatus.textContent = "임시저장 복원됨";
        setDocumentType(draft.documentType, true);
        return true;
      } catch (error) {
        localStorage.removeItem(STORAGE_KEY);
        return false;
      }
    }

    function validateForPrint() {
      if (!text("supplier-name")) {
        showError("공급자 상호·회사명을 입력해주세요.", field("supplier-name"));
        return false;
      }
      if (!text("client-name")) {
        showError("공급받는 자의 상호·이름을 입력해주세요.", field("client-name"));
        return false;
      }
      const validItem = getItems().some(function (item) {
        return item.name && parseNumber(item.quantity) > 0 && parseNumber(item.unitPrice) > 0;
      });
      if (!validItem) {
        showError("품목명·수량·단가를 입력한 품목이 한 개 이상 필요합니다.", editorBody.querySelector(".item-name"));
        return false;
      }
      return true;
    }

    document.querySelectorAll(".document-type-btn").forEach(function (button) {
      button.addEventListener("click", function () { setDocumentType(button.dataset.documentType); });
    });
    document.getElementById("add-item-btn").addEventListener("click", function () { addItem({}); });

    fieldIds.forEach(function (id) {
      const control = field(id);
      control.addEventListener("input", updateAll);
      control.addEventListener("change", function () {
        if (id === "document-date" && /^([QS])-\d{8}-001$/.test(text("document-number"))) {
          field("document-number").value = makeDocumentNumber(documentType, control.value);
        }
        updateAll();
      });
    });

    ["supplier-business-number", "client-business-number"].forEach(function (id) {
      field(id).addEventListener("input", function (event) {
        const formatted = formatBusinessNumber(event.target.value);
        if (event.target.value !== formatted) event.target.value = formatted;
      });
    });

    autoSave.addEventListener("change", function () {
      if (autoSave.checked) {
        saveDraft();
      } else {
        localStorage.removeItem(STORAGE_KEY);
        saveStatus.textContent = "저장 안 함";
      }
    });

    field("supplier-logo").addEventListener("change", function (event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > MAX_LOGO_BYTES) {
        event.target.value = "";
        showError("로고·직인은 PNG, JPG, WEBP 이미지 2MB 이하만 사용할 수 있습니다.", event.target);
        return;
      }
      if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
      logoObjectUrl = URL.createObjectURL(file);
      field("preview-logo").src = logoObjectUrl;
      field("preview-logo-wrap").classList.remove("hidden");
    });

    document.getElementById("print-btn").addEventListener("click", function () {
      if (!validateForPrint()) return;
      updatePreview();
      if (window.OTX) {
        window.OTX.trackToolComplete("quote-statement", {
          variant: documentType,
          item_count_bucket: window.OTX.bucketCount(
            getItems().filter(function (item) { return item.name; }).length
          )
        });
      }
      window.print();
    });

    document.getElementById("reset-btn").addEventListener("click", function () {
      if (!window.confirm("입력한 내용을 모두 지울까요?")) return;
      localStorage.removeItem(STORAGE_KEY);
      form.reset();
      editorBody.replaceChildren();
      if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
      logoObjectUrl = "";
      field("preview-logo").removeAttribute("src");
      field("preview-logo-wrap").classList.add("hidden");
      initializeBlank();
    });

    function initializeBlank() {
      const today = todayIso();
      field("document-date").value = today;
      field("valid-until").value = addDaysIso(today, 14);
      field("document-number").value = makeDocumentNumber("quote", today);
      autoSave.checked = false;
      saveStatus.textContent = "";
      addItem({ quantity: 1, unit: "개", taxType: "taxable" });
      addItem({ quantity: 1, unit: "개", taxType: "taxable" });
      setDocumentType("quote", true);
    }

    if (!restoreDraft()) initializeBlank();
  }

  return {
    parseNumber,
    won,
    formatBusinessNumber,
    calculateLine,
    calculateTotals,
    init
  };
});
