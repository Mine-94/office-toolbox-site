(function () {
  const calcBtn = document.getElementById("calc-btn");
  if (!calcBtn) return;

  const resultEl = document.getElementById("calc-result");

  function won(n) {
    return Math.round(n).toLocaleString("ko-KR") + "원";
  }

  function pct(n) {
    return (Math.round(n * 1000) / 10).toString().replace(/\.0$/, "") + "%";
  }

  const EMPLOYMENT_EMPLOYER_ADDON = {
    small: 0.0025, // 150인 미만
    priority: 0.0045, // 150인 이상 우선지원대상기업
    mid: 0.0065, // 150~1,000인 미만
    large: 0.0085, // 1,000인 이상 · 국가·지자체
  };

  calcBtn.addEventListener("click", () => {
    const monthlyManwon = parseFloat(document.getElementById("monthly-salary").value);
    const companySize = document.getElementById("company-size").value;
    let accidentRatePercent = parseFloat(document.getElementById("accident-rate").value);

    if (!monthlyManwon || monthlyManwon <= 0) {
      resultEl.innerHTML = '<p class="error-text">월 급여(과세대상)를 입력해주세요.</p>';
      resultEl.classList.remove("hidden");
      return;
    }
    if (isNaN(accidentRatePercent) || accidentRatePercent < 0) {
      accidentRatePercent = 1.47;
    }
    const accidentRate = accidentRatePercent / 100;

    const monthlyTaxable = monthlyManwon * 10000;

    // 국민연금: 기준소득월액 41만원~659만원(2026.7.~2027.6.), 근로자·사업주 각 4.75%
    const pensionBase = Math.min(Math.max(monthlyTaxable, 410000), 6590000);
    const pensionEach = pensionBase * 0.0475;

    // 건강보험: 근로자·사업주 각 3.595%
    const healthEach = monthlyTaxable * 0.03595;

    // 장기요양보험: 건강보험료의 13.14%, 근로자·사업주 각 절반 부담
    const careEach = healthEach * 0.1314;

    // 고용보험(실업급여): 근로자·사업주 각 0.9%
    const employmentEmployee = monthlyTaxable * 0.009;
    const addOn = EMPLOYMENT_EMPLOYER_ADDON[companySize] ?? EMPLOYMENT_EMPLOYER_ADDON.small;
    const employmentEmployer = monthlyTaxable * (0.009 + addOn);

    // 산재보험: 100% 사업주 부담, 업종별 상이(사용자 입력값, 기본 2026년 평균 1.47%)
    const accidentEmployer = monthlyTaxable * accidentRate;

    const employeeTotal = pensionEach + healthEach + careEach + employmentEmployee;
    const employerTotal = pensionEach + healthEach + careEach + employmentEmployer + accidentEmployer;
    const grandTotal = employeeTotal + employerTotal;

    const companySizeLabel = {
      small: "150인 미만",
      priority: "150인 이상 · 우선지원대상기업",
      mid: "150인~1,000인 미만",
      large: "1,000인 이상 · 국가·지자체",
    }[companySize] || "150인 미만";

    resultEl.innerHTML = `
      <div class="calc-summary">
        <div class="calc-summary-main">
          <small>4대보험료 합계 (근로자+사업주, 월)</small>
          <strong>${won(grandTotal)}</strong>
        </div>
        <div class="calc-summary-sub">
          <small>근로자 부담 ${won(employeeTotal)} · 사업주 부담 ${won(employerTotal)}</small>
        </div>
      </div>
      <table class="calc-table">
        <tr><th colspan="3">월 부담 내역</th></tr>
        <tr><th>항목</th><th>근로자</th><th>사업주</th></tr>
        <tr><td>국민연금 (각 4.75%)</td><td>${won(pensionEach)}</td><td>${won(pensionEach)}</td></tr>
        <tr><td>건강보험 (각 3.595%)</td><td>${won(healthEach)}</td><td>${won(healthEach)}</td></tr>
        <tr><td>장기요양보험 (건강보험료의 13.14%)</td><td>${won(careEach)}</td><td>${won(careEach)}</td></tr>
        <tr><td>고용보험</td><td>${won(employmentEmployee)} (0.9%)</td><td>${won(employmentEmployer)} (0.9%+${companySizeLabel})</td></tr>
        <tr><td>산재보험 (100% 사업주, 입력 요율 ${pct(accidentRate)})</td><td>-</td><td>${won(accidentEmployer)}</td></tr>
        <tr class="calc-table-total"><td>합계</td><td>${won(employeeTotal)}</td><td>${won(employerTotal)}</td></tr>
      </table>
    `;
    resultEl.classList.remove("hidden");
  });
})();
