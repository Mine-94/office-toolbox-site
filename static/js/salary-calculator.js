(function () {
  const calcBtn = document.getElementById("calc-btn");
  if (!calcBtn) return;

  const resultEl = document.getElementById("calc-result");

  function won(n) {
    return Math.round(n).toLocaleString("ko-KR") + "원";
  }

  function incomeDeduction(gross) {
    if (gross <= 5000000) return gross * 0.7;
    if (gross <= 15000000) return 3500000 + (gross - 5000000) * 0.4;
    if (gross <= 45000000) return 7500000 + (gross - 15000000) * 0.15;
    if (gross <= 100000000) return 12000000 + (gross - 45000000) * 0.05;
    return 14750000 + (gross - 100000000) * 0.02;
  }

  function calcTax(taxBase) {
    const brackets = [
      [14000000, 0.06, 0],
      [50000000, 0.15, 1260000],
      [88000000, 0.24, 5760000],
      [150000000, 0.35, 15440000],
      [300000000, 0.38, 19940000],
      [500000000, 0.4, 25940000],
      [1000000000, 0.42, 35940000],
      [Infinity, 0.45, 65940000],
    ];
    for (const [limit, rate, deduction] of brackets) {
      if (taxBase <= limit) return Math.max(0, taxBase * rate - deduction);
    }
    return 0;
  }

  function earnedIncomeTaxCredit(calculatedTax, grossTaxable) {
    let credit = calculatedTax <= 1300000 ? calculatedTax * 0.55 : 715000 + (calculatedTax - 1300000) * 0.3;
    let limit;
    if (grossTaxable <= 33000000) {
      limit = 740000;
    } else if (grossTaxable <= 70000000) {
      limit = Math.max(740000 - (grossTaxable - 33000000) * 0.008, 660000);
    } else if (grossTaxable <= 120000000) {
      limit = Math.max(660000 - (grossTaxable - 70000000) * 0.005, 500000);
    } else {
      limit = Math.max(500000 - (grossTaxable - 120000000) * 0.005, 200000);
    }
    return Math.min(credit, limit);
  }

  function childTaxCredit(children) {
    if (children <= 0) return 0;
    if (children === 1) return 150000;
    if (children === 2) return 350000;
    return 350000 + (children - 2) * 300000;
  }

  calcBtn.addEventListener("click", () => {
    const annualSalaryManwon = parseFloat(document.getElementById("annual-salary").value);
    const dependents = Math.max(1, parseInt(document.getElementById("dependents").value, 10) || 1);
    const children = Math.max(0, parseInt(document.getElementById("children").value, 10) || 0);
    const nontaxableManwon = Math.max(0, parseFloat(document.getElementById("nontaxable").value) || 0);

    if (!annualSalaryManwon || annualSalaryManwon <= 0) {
      resultEl.innerHTML = '<p class="error-text">연봉을 입력해주세요.</p>';
      resultEl.classList.remove("hidden");
      return;
    }

    const annualGross = annualSalaryManwon * 10000;
    const monthlyNontaxable = nontaxableManwon * 10000;
    const annualNontaxable = monthlyNontaxable * 12;
    const annualTaxable = Math.max(0, annualGross - annualNontaxable);
    const monthlyTaxable = annualTaxable / 12;

    // 4대보험 (근로자 부담분, 2026년 7월 이후 기준)
    // 국민연금 기준소득월액: 410,000원 ~ 6,590,000원, 근로자 부담률 4.75%
    const pensionBase = Math.min(Math.max(monthlyTaxable, 410000), 6590000);
    const pension = pensionBase * 0.0475;
    const health = monthlyTaxable * 0.03595;
    const longTermCare = health * 0.1314;
    const employment = monthlyTaxable * 0.009;
    const monthlyInsurance = pension + health + longTermCare + employment;
    const annualInsurance = monthlyInsurance * 12;

    // 소득세는 실제 월별 근로소득 간이세액표와 차이가 날 수 있는 근사 계산
    const deduction = incomeDeduction(annualTaxable);
    const earnedIncomeAmount = Math.max(0, annualTaxable - deduction);
    const personalDeduction = dependents * 1500000;
    const taxBase = Math.max(0, earnedIncomeAmount - personalDeduction - annualInsurance);
    const calculatedTax = calcTax(taxBase);
    const eitc = earnedIncomeTaxCredit(calculatedTax, annualTaxable);
    const cTaxCredit = Math.min(childTaxCredit(children), Math.max(0, calculatedTax - eitc));
    const decidedTax = Math.max(0, calculatedTax - eitc - cTaxCredit);
    const localTax = decidedTax * 0.1;
    const annualTax = decidedTax + localTax;
    const monthlyTax = annualTax / 12;

    const monthlyGross = annualGross / 12;
    const monthlyNet = monthlyGross - monthlyInsurance - monthlyTax;
    const annualNet = monthlyNet * 12;

    resultEl.innerHTML = `
      <div class="calc-summary">
        <div class="calc-summary-main">
          <small>예상 월 실수령액</small>
          <strong>${won(monthlyNet)}</strong>
        </div>
        <div class="calc-summary-sub">
          <small>예상 연 실수령액</small>
          <span>${won(annualNet)}</span>
        </div>
      </div>
      <table class="calc-table">
        <tr><th colspan="2">월 공제 내역</th></tr>
        <tr><td>국민연금</td><td>${won(pension)}</td></tr>
        <tr><td>건강보험</td><td>${won(health)}</td></tr>
        <tr><td>장기요양보험</td><td>${won(longTermCare)}</td></tr>
        <tr><td>고용보험</td><td>${won(employment)}</td></tr>
        <tr><td>소득세 + 지방소득세</td><td>${won(monthlyTax)}</td></tr>
        <tr class="calc-table-total"><td>공제액 합계</td><td>${won(monthlyInsurance + monthlyTax)}</td></tr>
      </table>
    `;
    resultEl.classList.remove("hidden");
    if (window.OTX) window.OTX.trackToolComplete("salary-calculator");
  });
})();
