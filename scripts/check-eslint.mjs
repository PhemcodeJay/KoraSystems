import { Linter } from "eslint";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const linter = new Linter();

// Read the file
const file = path.resolve(process.cwd(), "apps/admin/src/lib/ui.ts");
const code = readFileSync(file, "utf8");

// Use the react-hooks plugin from node_modules
const reactHooksPath = path.resolve(process.cwd(), "node_modules/eslint-plugin-react-hooks");
const reactHooks = await import(reactHooksPath);
linter.defineRule("react-hooks/exhaustive-deps", reactHooks.rules.exhaustive_deps);

const messages = linter.verify(code, {
  parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
  rules: { "react-hooks/exhaustive-deps": "warn" },
});

console.log(JSON.stringify(messages, null, 2));
