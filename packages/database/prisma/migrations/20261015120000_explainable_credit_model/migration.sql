ALTER TABLE "kora"."credit_scores"
  ALTER COLUMN "model" SET DEFAULT 'explainable-credit-v1',
  ALTER COLUMN "is_placeholder" SET DEFAULT false;
