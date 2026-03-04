const assert = require("node:assert/strict");

const { parseGatewayMessage } = require("../src/services/parser.service");
const { validateParsedMessage } = require("../src/services/validator.service");
const { shouldProxy } = require("../src/controllers/proxy.controller");

const tests = [
  {
    name: "parser supports postgraduate sender code",
    run() {
      const parsed = parseGatewayMessage('P42#_#GET#STUDENTS#"page=1;limit=20"');
      assert.equal(parsed.senderCode, "P42");
      assert.equal(parsed.method, "GET");
      assert.equal(parsed.mode, "single");
    },
  },
  {
    name: "validator accepts canonical PUT payload",
    run() {
      const parsed = parseGatewayMessage("T7#U15#PUT#LANG_JAVA#ADD:+5");
      const validation = validateParsedMessage(parsed);
      assert.equal(validation.ok, true);
      assert.deepEqual(validation.errors, []);
    },
  },
  {
    name: "validator rejects malformed sender code",
    run() {
      const parsed = parseGatewayMessage("X1#U15#PUT#LANG_JAVA#ADD:+5");
      const validation = validateParsedMessage(parsed);
      assert.equal(validation.ok, false);
      assert.equal(validation.errors.some((item) => item.includes("senderCode")), true);
    },
  },
  {
    name: "shouldProxy returns true for supported routes",
    run() {
      assert.equal(shouldProxy("/api/projects"), true);
      assert.equal(shouldProxy("/site/participants/students/profile"), true);
      assert.equal(shouldProxy("/assets/index-DWf0fQm2.js"), true);
      assert.equal(shouldProxy("/uploads/profile-photos/u1_file.jpg"), true);
      assert.equal(shouldProxy("/swagger-ui.html"), true);
    },
  },
  {
    name: "shouldProxy returns false for unsupported routes",
    run() {
      assert.equal(shouldProxy("/healthz"), false);
      assert.equal(shouldProxy("/internal/metrics"), false);
    },
  },
];

let failed = 0;
for (const testCase of tests) {
  try {
    testCase.run();
    console.log(`PASS: ${testCase.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL: ${testCase.name}`);
    console.error(error);
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log(`All gateway tests passed (${tests.length})`);
