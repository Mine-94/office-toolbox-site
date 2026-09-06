"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function runCalculator(annualSalary) {
  let clickHandler = null;
  let completionCount = 0;
  const classNames = new Set(["hidden"]);
  const elements = {
    "calc-btn": {
      addEventListener(event, handler) {
        if (event === "click") clickHandler = handler;
      },
    },
    "calc-result": {
      innerHTML: "",
      classList: {
        add(value) { classNames.add(value); },
        remove(value) { classNames.delete(value); },
      },
    },
    "annual-salary": { value: annualSalary },
    dependents: { value: "1" },
    children: { value: "0" },
    nontaxable: { value: "20" },
  };

  const context = {
    console,
    document: { getElementById: (id) => elements[id] || null },
    window: {
      OTX: { trackToolComplete: () => { completionCount += 1; } },
    },
  };
  vm.runInNewContext(
    fs.readFileSync("static/js/salary-calculator.js", "utf8"),
    context
  );
  assert.ok(clickHandler, "계산 버튼 이벤트가 연결되어야 합니다.");
  clickHandler();
  return { html: elements["calc-result"].innerHTML, classNames, completionCount };
}

const valid = runCalculator("5000");
assert.match(valid.html, /예상 월 실수령액/);
assert.match(valid.html, /국민연금/);
assert.doesNotMatch(valid.html, /NaN|Infinity/);
assert.strictEqual(valid.classNames.has("hidden"), false);
assert.strictEqual(valid.completionCount, 1);

const invalid = runCalculator("");
assert.match(invalid.html, /연봉을 입력해주세요/);
assert.strictEqual(invalid.completionCount, 0);

console.log("salary calculator flow tests: passed");
