-- Neobank crypto wallets.
--
-- The table already existed in the database but was created out of band rather
-- than through a migration, and `schema.prisma` had no model for it at all. So
-- the Neobank routes (deposits, withdrawals, investments, insurance premiums)
-- referenced `prisma.cryptoWallet` and could not typecheck, and the table's
-- shape had drifted from the schema's own conventions.
--
-- This migration is written to be safe in both directions:
--   - On a fresh database it creates the table in its final shape.
--   - On the existing database it upgrades the older table in place:
--     camelCase `userId`, `balance` held as TEXT, no foreign key, no
--     timestamps.
--
-- `balance` becomes DECIMAL(18,8) to match `accounts.balance` and
-- `investments.quantity`. It was TEXT because it predates the rest of the
-- Neobank models, but a monetary balance stored as free text permits no
-- server-side decimal arithmetic and no validation at the column. The cast
-- preserves whatever value is already there.

CREATE TABLE IF NOT EXISTS "kora"."crypto_wallets" (
  "id"         TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "symbol"     TEXT NOT NULL,
  "balance"    DECIMAL(18,8) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crypto_wallets_pkey" PRIMARY KEY ("id")
);

-- ── Upgrade the legacy table, if this is an existing database ──────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'kora' AND table_name = 'crypto_wallets'
      AND column_name = 'userId'
  ) THEN
    ALTER TABLE "kora"."crypto_wallets" RENAME COLUMN "userId" TO "user_id";
    -- The old unique index was named after the old column name, so it no
    -- longer matches what the schema expects. Dropped and recreated below.
    DROP INDEX IF EXISTS "kora"."crypto_wallets_userId_symbol_key";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'kora' AND table_name = 'crypto_wallets'
      AND column_name = 'balance' AND data_type = 'text'
  ) THEN
    ALTER TABLE "kora"."crypto_wallets"
      ALTER COLUMN "balance" TYPE DECIMAL(18,8) USING "balance"::decimal(18,8);
    ALTER TABLE "kora"."crypto_wallets" ALTER COLUMN "balance" SET DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'kora' AND table_name = 'crypto_wallets'
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE "kora"."crypto_wallets"
      ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'kora' AND table_name = 'crypto_wallets'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE "kora"."crypto_wallets"
      ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;

  -- Without this, deleting a user would silently orphan their crypto balances
  -- and those rows would keep summing into the platform-wide wallet total.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'kora.crypto_wallets'::regclass AND contype = 'f'
  ) THEN
    ALTER TABLE "kora"."crypto_wallets"
      ADD CONSTRAINT "crypto_wallets_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "kora"."users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- One row per (user, asset). The Neobank routes top up and debit a balance by
-- upserting on this compound key, so two concurrent deposits of the same asset
-- cannot both read the old balance and write back a value that loses one.
CREATE UNIQUE INDEX IF NOT EXISTS "crypto_wallets_user_id_symbol_key"
  ON "kora"."crypto_wallets"("user_id", "symbol");
CREATE INDEX IF NOT EXISTS "crypto_wallets_user_id_idx"
  ON "kora"."crypto_wallets"("user_id");
