// Uses tsx, matching `@kora/disbursement`'s `gate:verify`. Bare Node type
// stripping cannot resolve this repo's extensionless imports, which are written
// for bundler resolution.
//
// `verifyBrand` lives in the brand package so the spec is asserted by something
// CI runs, rather than by a throwaway check that drifts out of date.
import { verifyBrand } from "../packages/brand/src/index";

const { ok, errors } = verifyBrand();

if (ok) {
  console.log("brand: OK — name, tagline, colours, scales and product names match the spec.");
  process.exit(0);
}

console.error("brand: FAILED");
for (const e of errors) console.error(`  - ${e}`);
process.exit(1);