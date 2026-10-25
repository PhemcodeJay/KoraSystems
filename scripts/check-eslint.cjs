const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");
const pnpm = path.join(root, "node_modules/.pnpm");

const eslintApi = path.join(pnpm, "eslint@8.57.1_supports-color@7.2.0", "node_modules/eslint/lib/api.js");
const reactHooksPlugin = path.join(pnpm, "eslint-plugin-react-hooks@5_93c228f6ee011454816ca52f16a9ef6d", "node_modules/eslint-plugin-react-hooks");

const { Linter } = require(eslintApi);
const plugin = require(reactHooksPlugin);

console.log("Plugin keys:", Object.keys(plugin));
console.log("Rule keys:", Object.keys(plugin.rules || {}));

const linter = new Linter();
// The rule is named "exhaustive-deps" (with hyphen) in the plugin
const ruleName = "react-hooks/exhaustive-deps";
linter.defineRule(ruleName, plugin.rules["exhaustive-deps"]);

// Also load TS parser
const tsParser = require(path.join(pnpm, "@typescript-eslint+parser@8_65217048614e785735fa5275d1391bea", "node_modules/@typescript-eslint/parser/dist/index.js"));
linter.defineParser("@typescript-eslint/parser", tsParser);

const file = path.join(root, "apps/admin/src/lib/ui.ts");
const code = fs.readFileSync(file, "utf8");

const messages = linter.verify(code, {
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
  rules: { "react-hooks/exhaustive-deps": "warn" },
});
console.log("=== Result ===");
console.log(JSON.stringify(messages, null, 2));