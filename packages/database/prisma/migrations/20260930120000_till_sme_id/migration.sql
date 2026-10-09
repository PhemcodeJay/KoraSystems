-- Scope tills to their owning business.
--
-- Tills had no tenant key, so `/api/till` and `/api/tills` returned every till
-- on the platform to any signed-in SME. `opened_by` is a free-text name and
-- cannot scope a query, so a real foreign key is added.
--
-- The column is nullable so this applies cleanly to existing rows; tills that
-- cannot be attributed to a business stay visible to ADMIN only.

ALTER TABLE "kora"."tills" ADD COLUMN IF NOT EXISTS "sme_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tills_sme_id_fkey'
  ) THEN
    ALTER TABLE "kora"."tills"
      ADD CONSTRAINT "tills_sme_id_fkey"
      FOREIGN KEY ("sme_id") REFERENCES "kora"."smes"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "tills_sme_id_idx" ON "kora"."tills"("sme_id");
