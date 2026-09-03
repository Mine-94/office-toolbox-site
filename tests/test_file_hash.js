const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const vm = require("vm");
const { TextEncoder } = require("util");

const context = {
  console,
  crypto: crypto.webcrypto,
  document: { getElementById: () => null },
  globalThis: {},
  Uint8Array,
  window: {},
};
context.globalThis = context;
vm.runInNewContext(fs.readFileSync("static/js/file-hash.js", "utf8"), context);

const tool = context.window.FileHashTool;
assert.ok(tool, "FileHashTool API should be exposed");
assert.strictEqual(tool.MAX_FILE_SIZE, 100 * 1024 * 1024);
assert.strictEqual(tool.normalizeExpected(" AA bb\nCC "), "aabbcc");
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(tool.validateExpected("a".repeat(64), "SHA-256"))),
  { valid: true, empty: false, value: "a".repeat(64) }
);
assert.strictEqual(tool.validateExpected("zz", "SHA-256").valid, false);
assert.strictEqual(tool.validateExpected("a".repeat(63), "SHA-256").valid, false);
assert.strictEqual(tool.validateFile({ size: 100 * 1024 * 1024 }), "");
assert.match(tool.validateFile({ size: 100 * 1024 * 1024 + 1 }), /100MB/);
assert.strictEqual(tool.formatBytes(0), "0 B");
assert.strictEqual(tool.formatBytes(1536), "1.5 KB");

(async () => {
  const bytes = new TextEncoder().encode("abc");
  assert.strictEqual(
    await tool.digestBytes(bytes, "SHA-256", crypto.webcrypto.subtle),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
  assert.strictEqual(
    await tool.digestBytes(bytes, "SHA-384", crypto.webcrypto.subtle),
    "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed" +
      "8086072ba1e7cc2358baeca134c825a7"
  );
  assert.strictEqual(
    await tool.digestBytes(bytes, "SHA-512", crypto.webcrypto.subtle),
    "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a" +
      "2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f"
  );
  await assert.rejects(() => tool.digestBytes(bytes, "MD5", crypto.webcrypto.subtle));
  console.log("file hash tests: passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
