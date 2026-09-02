const assert = require("assert");
const quote = require("../static/js/quote-statement.js");

assert.deepStrictEqual(
  quote.calculateLine({ quantity: 2, unitPrice: 10000, taxType: "taxable" }, "exclusive"),
  { supply: 20000, vat: 2000, total: 22000 }
);

assert.deepStrictEqual(
  quote.calculateLine({ quantity: 1, unitPrice: 11000, taxType: "taxable" }, "inclusive"),
  { supply: 10000, vat: 1000, total: 11000 }
);

assert.deepStrictEqual(
  quote.calculateLine({ quantity: 3, unitPrice: 7000, taxType: "exempt" }, "exclusive"),
  { supply: 21000, vat: 0, total: 21000 }
);

assert.deepStrictEqual(
  quote.calculateTotals(
    [
      { quantity: 2, unitPrice: 10000, taxType: "taxable" },
      { quantity: 1, unitPrice: 5000, taxType: "exempt" }
    ],
    "exclusive"
  ),
  { supply: 25000, vat: 2000, total: 27000 }
);

assert.strictEqual(quote.formatBusinessNumber("1234567890"), "123-45-67890");
assert.strictEqual(quote.formatBusinessNumber("123-4abc"), "123-4");
assert.strictEqual(quote.parseNumber("12,345"), 12345);
assert.strictEqual(quote.won(12345), "12,345원");

console.log("quote-statement calculation tests: passed");
