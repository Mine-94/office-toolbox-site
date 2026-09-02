const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const calls = [];
const values = new Map();
const localStorage = {
  getItem: (key) => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, value),
};
const context = {
  localStorage,
  window: {
    gtag: (...args) => calls.push(args),
  },
};

vm.runInNewContext(fs.readFileSync("static/js/otx-storage.js", "utf8"), context);
const OTX = context.window.OTX;

assert.strictEqual(OTX.bucketCount(1), "1");
assert.strictEqual(OTX.bucketCount(5), "2_5");
assert.strictEqual(OTX.bucketCount(20), "6_20");
assert.strictEqual(OTX.bucketCount(100), "21_100");
assert.strictEqual(OTX.bucketCount(101), "100_plus");

const payload = OTX.buildCompletionPayload("PDF Compress", {
  operation: "merge",
  result_type: "table found",
  item_count_bucket: "2_5",
  file_name: "private-contract.pdf",
  business_number: "1234567890",
  raw_text: "개인정보",
});
assert.deepStrictEqual(JSON.parse(JSON.stringify(payload)), {
  tool_name: "pdf_compress",
  operation: "merge",
  result_type: "table_found",
  item_count_bucket: "2_5",
});

assert.strictEqual(OTX.trackToolComplete("ocr", { variant: "kor+eng" }), true);
assert.strictEqual(calls.length, 1);
assert.strictEqual(calls[0][0], "event");
assert.strictEqual(calls[0][1], "tool_complete");
assert.deepStrictEqual(JSON.parse(JSON.stringify(calls[0][2])), {
  tool_name: "ocr",
  variant: "kor_eng",
});

delete context.window.gtag;
assert.strictEqual(OTX.trackToolComplete("ocr"), false);

console.log("privacy-safe analytics tests: passed");
