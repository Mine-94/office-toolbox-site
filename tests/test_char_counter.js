"use strict";

const assert = require("assert");
const {
  countCharacters,
  byteLength,
} = require("../static/js/char-counter.js");

assert.strictEqual(countCharacters("업무 도구함"), 6);
assert.strictEqual(countCharacters("😀"), 1);
assert.strictEqual(countCharacters("👨‍👩‍👧‍👦"), 1);
assert.strictEqual(countCharacters("e\u0301"), 1);
assert.strictEqual(countCharacters("😀 한글".replace(/\s/gu, "")), 3);

// 2바이트 기준은 사용자에게 별도 지표로 제공되는 기존 국내 시스템식 값이다.
assert.strictEqual(byteLength("ABC 123"), 7);
assert.strictEqual(byteLength("한글"), 4);
assert.strictEqual(byteLength("😀"), 2);

console.log("character counter Unicode tests: passed");
