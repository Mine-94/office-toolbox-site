(function () {
  const calcBtn = document.getElementById("calc-btn");
  if (!calcBtn) return;

  const resultEl = document.getElementById("calc-result");

  function won(n) {
    return Math.round(n).toLocaleString("ko-KR") + "원";
  }

  function pct(n) {
    return (Math.round(n * 100) / 100).toString() + "%";
  }

  const LEGAL_CAP_RATE = 5.0; // 한국은행 기준금리 3.00%(2026.8.27~) + 대통령령 이율 2%p

  calcBtn.addEventListener("click", () => {
    const jeonseManwon = parseFloat(document.getElementById("jeonse-deposit").value);
    const newDepositManwon = parseFloat(document.getElementById("new-deposit").value);
    let rentRatePercent = parseFloat(document.getElementById("rent-rate").value);
    const proposedRentManwon = parseFloat(document.getElementById("proposed-rent").value);

    if (!jeonseManwon || jeonseManwon <= 0) {
      resultEl.innerHTML = '<p class="error-text">기존 전세보증금을 입력해주세요.</p>';
      resultEl.classList.remove("hidden");
      return;
    }
    if (isNaN(newDepositManwon) || newDepositManwon < 0) {
      resultEl.innerHTML = '<p class="error-text">변경 후 보증금을 입력해주세요. (월세만 낸다면 0)</p>';
      resultEl.classList.remove("hidden");
      return;
    }
    if (newDepositManwon >= jeonseManwon) {
      resultEl.innerHTML = '<p class="error-text">변경 후 보증금은 기존 전세보증금보다 작아야 해요.</p>';
      resultEl.classList.remove("hidden");
      return;
    }
    if (isNaN(rentRatePercent) || rentRatePercent <= 0) {
      rentRatePercent = LEGAL_CAP_RATE;
    }

    const depositDiffManwon = jeonseManwon - newDepositManwon;
    const depositDiff = depositDiffManwon * 10000;

    const fairRent = (depositDiff * (rentRatePercent / 100)) / 12;
    const legalCapRent = (depositDiff * (LEGAL_CAP_RATE / 100)) / 12;

    let proposedBlockHtml = "";
    if (!isNaN(proposedRentManwon) && proposedRentManwon > 0) {
      const proposedRent = proposedRentManwon * 10000;
      const impliedRate = ((proposedRent * 12) / depositDiff) * 100;
      const overCap = impliedRate > LEGAL_CAP_RATE + 0.001;
      proposedBlockHtml = `
        <tr><td>집주인 제안 월세 환산 전환율</td><td colspan="1">${pct(impliedRate)}</td></tr>
        <tr><td>법정 상한 초과 여부</td><td class="${overCap ? "error-text" : ""}">${overCap ? "상한 초과 (조정 요청 가능)" : "상한 이내"}</td></tr>
      `;
    }

    resultEl.innerHTML = `
      <div class="calc-summary">
        <div class="calc-summary-main">
          <small>입력 전환율(${pct(rentRatePercent)}) 기준 적정 월세</small>
          <strong>${won(fairRent)}</strong>
        </div>
        <div class="calc-summary-sub">
          <small>보증금 차액 ${won(depositDiff)} · 법정 상한(${pct(LEGAL_CAP_RATE)}) 기준 월세 ${won(legalCapRent)}</small>
        </div>
      </div>
      <table class="calc-table">
        <tr><th colspan="2">계산 내역</th></tr>
        <tr><td>기존 전세보증금</td><td>${won(jeonseManwon * 10000)}</td></tr>
        <tr><td>변경 후 보증금</td><td>${won(newDepositManwon * 10000)}</td></tr>
        <tr><td>보증금 차액</td><td>${won(depositDiff)}</td></tr>
        <tr><td>입력 전환율 적용 월세</td><td>${won(fairRent)} (${pct(rentRatePercent)})</td></tr>
        <tr class="calc-table-total"><td>법정 상한 전환율 적용 월세</td><td>${won(legalCapRent)} (${pct(LEGAL_CAP_RATE)})</td></tr>
        ${proposedBlockHtml}
      </table>
    `;
    resultEl.classList.remove("hidden");
  });
})();
