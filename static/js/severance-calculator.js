(function () {
  const calcBtn = document.getElementById("calc-btn");
  if (!calcBtn) return;

  const resultEl = document.getElementById("calc-result");

  function won(n) {
    return Math.round(n).toLocaleString("ko-KR") + "원";
  }

  function daysBetween(a, b) {
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
  }

  calcBtn.addEventListener("click", () => {
    const joinStr = document.getElementById("join-date").value;
    const leaveStr = document.getElementById("leave-date").value;
    const pay3m = parseFloat(document.getElementById("recent-3m-pay").value);
    const bonus = Math.max(0, parseFloat(document.getElementById("annual-bonus").value) || 0);
    const leavePay = Math.max(0, parseFloat(document.getElementById("annual-leave-pay").value) || 0);

    if (!joinStr || !leaveStr) {
      resultEl.innerHTML = '<p class="error-text">입사일과 퇴사일을 입력해주세요.</p>';
      resultEl.classList.remove("hidden");
      return;
    }
    const joinDate = new Date(joinStr);
    const leaveDate = new Date(leaveStr);
    if (leaveDate <= joinDate) {
      resultEl.innerHTML = '<p class="error-text">퇴사일은 입사일보다 나중이어야 해요.</p>';
      resultEl.classList.remove("hidden");
      return;
    }
    if (!pay3m || pay3m <= 0) {
      resultEl.innerHTML = '<p class="error-text">최근 3개월 총 급여를 입력해주세요.</p>';
      resultEl.classList.remove("hidden");
      return;
    }

    const tenureDays = daysBetween(joinDate, leaveDate);

    const threeMonthsAgo = new Date(leaveDate);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const periodDays = daysBetween(threeMonthsAgo, leaveDate);

    const totalWageForAvg =
      pay3m * 10000 + (bonus * 10000 * 3) / 12 + (leavePay * 10000 * 3) / 12;
    const avgDailyWage = totalWageForAvg / periodDays;
    const severance = avgDailyWage * 30 * (tenureDays / 365);

    const years = Math.floor(tenureDays / 365);
    const months = Math.floor((tenureDays % 365) / 30);
    const days = tenureDays % 365 % 30;

    let warning = "";
    if (tenureDays < 365) {
      warning =
        '<p class="error-text" style="margin-bottom:16px;">⚠️ 재직기간이 1년 미만이면 근로기준법상 법정 퇴직금 지급 의무가 없어요. 아래 금액은 참고용 시뮬레이션이에요.</p>';
    }

    resultEl.innerHTML = `
      ${warning}
      <div class="calc-summary">
        <div class="calc-summary-main">
          <small>예상 퇴직금</small>
          <strong>${won(severance)}</strong>
        </div>
        <div class="calc-summary-sub">
          <small>재직기간</small>
          <span>${years}년 ${months}개월 ${days}일 (${tenureDays.toLocaleString("ko-KR")}일)</span>
        </div>
      </div>
      <table class="calc-table">
        <tr><th colspan="2">계산 내역</th></tr>
        <tr><td>1일 평균임금</td><td>${won(avgDailyWage)}</td></tr>
        <tr><td>평균임금 산정기간</td><td>${periodDays}일</td></tr>
        <tr><td>재직일수</td><td>${tenureDays.toLocaleString("ko-KR")}일</td></tr>
        <tr class="calc-table-total"><td>예상 퇴직금</td><td>${won(severance)}</td></tr>
      </table>
    `;
    resultEl.classList.remove("hidden");
  });
})();
