import test from "node:test";
import assert from "node:assert/strict";

import { parseC2bPayload } from "../src/lib/mpesa-c2b-payload.ts";

test("C2B parser accepts valid shortcode, receipt, amount, and bill reference", () => {
  assert.deepEqual(
    parseC2bPayload({
      TransID: "QKH123ABCD",
      TransAmount: "100.50",
      BusinessShortCode: 123456,
      BillRefNumber: "SALE-100",
    }),
    {
      transactionId: "QKH123ABCD",
      shortcode: "123456",
      amount: 100.5,
      billReference: "SALE-100",
    },
  );
});

test("C2B parser rejects invalid receipt, shortcode, amount, and oversized reference", () => {
  const valid = {
    TransID: "QKH123ABCD",
    TransAmount: "100",
    BusinessShortCode: "123456",
    BillRefNumber: "SALE-100",
  };
  for (const invalid of [
    { ...valid, TransID: "" },
    { ...valid, BusinessShortCode: "ABC" },
    { ...valid, TransAmount: "0" },
    { ...valid, TransAmount: "NaN" },
    { ...valid, BillRefNumber: "X".repeat(129) },
    null,
  ]) {
    assert.equal(parseC2bPayload(invalid), null);
  }
});
