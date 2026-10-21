-- Multi-role accounts, salted password hashes, and subscription auditing.
--
-- Three separable changes:
--   1. users.password_hash / must_change_password — salted scrypt hashes.
--   2. user_role_assignments — a user may hold several roles at once, so an SME
--      can also sell as a supplier and buy as a customer.
--   3. user_plans + subscription_events — tier now drives entitlements and app
--      access, and every change is auditable.

-- The Neobank models (accounts, cards, investments, insurance_policies,
-- user_plans and the PlanTier enum) were added to schema.prisma but never
-- migrated, so the database does not have them. They are created here rather
-- than in a separate migration because the entitlement work depends on
-- user_plans.tier existing, and splitting them would leave an intermediate
-- migration that cannot run.
CREATE TYPE "kora"."PlanTier" AS ENUM ('FREE', 'STANDARD', 'METAL');

CREATE TABLE "kora"."accounts" (
  "id"             TEXT NOT NULL,
  "user_id"        TEXT NOT NULL,
  "account_name"   TEXT NOT NULL,
  "account_type"   TEXT NOT NULL,
  "balance"        DECIMAL(14,2) NOT NULL DEFAULT 0,
  "account_number" TEXT NOT NULL,
  "currency"       TEXT NOT NULL DEFAULT 'KES',
  "is_active"      BOOLEAN NOT NULL DEFAULT true,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "accounts_account_number_key" ON "kora"."accounts"("account_number");
CREATE INDEX "accounts_user_id_idx" ON "kora"."accounts"("user_id");
ALTER TABLE "kora"."accounts"
  ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id")
  REFERENCES "kora"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "kora"."cards" (
  "id"               TEXT NOT NULL,
  "user_id"          TEXT NOT NULL,
  "account_id"       TEXT NOT NULL,
  "card_name"        TEXT NOT NULL,
  "card_type"        TEXT NOT NULL,
  "last_four_digits" TEXT NOT NULL,
  "expiry_month"     INTEGER NOT NULL,
  "expiry_year"      INTEGER NOT NULL,
  "is_active"        BOOLEAN NOT NULL DEFAULT true,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cards_user_id_idx" ON "kora"."cards"("user_id");
CREATE INDEX "cards_account_id_idx" ON "kora"."cards"("account_id");
ALTER TABLE "kora"."cards"
  ADD CONSTRAINT "cards_user_id_fkey" FOREIGN KEY ("user_id")
  REFERENCES "kora"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kora"."cards"
  ADD CONSTRAINT "cards_account_id_fkey" FOREIGN KEY ("account_id")
  REFERENCES "kora"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "kora"."investments" (
  "id"            TEXT NOT NULL,
  "user_id"       TEXT NOT NULL,
  "symbol"        TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "type"          TEXT NOT NULL,
  "quantity"      DECIMAL(18,8) NOT NULL,
  "average_price" DECIMAL(12,2) NOT NULL,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "investments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "investments_user_id_idx" ON "kora"."investments"("user_id");
CREATE INDEX "investments_symbol_idx" ON "kora"."investments"("symbol");
ALTER TABLE "kora"."investments"
  ADD CONSTRAINT "investments_user_id_fkey" FOREIGN KEY ("user_id")
  REFERENCES "kora"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "kora"."insurance_policies" (
  "id"          TEXT NOT NULL,
  "user_id"     TEXT NOT NULL,
  "policy_name" TEXT NOT NULL,
  "policy_type" TEXT NOT NULL,
  "provider"    TEXT NOT NULL,
  "premium"     DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status"      TEXT NOT NULL DEFAULT 'active',
  "expiry_date" TIMESTAMP(3) NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "insurance_policies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "insurance_policies_user_id_idx" ON "kora"."insurance_policies"("user_id");
ALTER TABLE "kora"."insurance_policies"
  ADD CONSTRAINT "insurance_policies_user_id_fkey" FOREIGN KEY ("user_id")
  REFERENCES "kora"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "kora"."user_plans" (
  "id"                  TEXT NOT NULL,
  "user_id"             TEXT NOT NULL,
  "tier"                "kora"."PlanTier" NOT NULL DEFAULT 'STANDARD',
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_plans_user_id_key" ON "kora"."user_plans"("user_id");
ALTER TABLE "kora"."user_plans"
  ADD CONSTRAINT "user_plans_user_id_fkey" FOREIGN KEY ("user_id")
  REFERENCES "kora"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 1. Password hashes. Nullable so Supabase-Auth-managed accounts keep working.
ALTER TABLE "kora"."users"
  ADD COLUMN "password_hash" TEXT,
  ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- 2. Secondary roles.
--
-- @@unique([userId, role]) enforces one row per role, which is what lets a
-- downgrade revoke a role by setting revokedAt and later re-grant it by
-- clearing that column, rather than delete-and-reinsert and lose the grant
-- history.
CREATE TABLE "kora"."user_role_assignments" (
  "id"          TEXT NOT NULL,
  "user_id"     TEXT NOT NULL,
  "role"        "kora"."UserRole" NOT NULL,
  "granted_via" "kora"."PlanTier",
  "reason"      TEXT,
  "granted_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at"  TIMESTAMP(3),
  "revoked_by"  TEXT,
  CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_role_assignments_user_id_role_key"
  ON "kora"."user_role_assignments"("user_id", "role");
CREATE INDEX "user_role_assignments_role_revoked_at_idx"
  ON "kora"."user_role_assignments"("role", "revoked_at");

ALTER TABLE "kora"."user_role_assignments"
  ADD CONSTRAINT "user_role_assignments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "kora"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Subscription state. Existing rows keep tier=STANDARD from the schema
--    default; status defaults to ACTIVE so nobody is locked out by the upgrade.
ALTER TABLE "kora"."user_plans"
  ADD COLUMN "status" "kora"."SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "cycle" TEXT NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "current_period_end" TIMESTAMP(3),
  ADD COLUMN "cancelled_at" TIMESTAMP(3),
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "kora"."subscription_events" (
  "id"          TEXT NOT NULL,
  "user_id"     TEXT NOT NULL,
  "admin_id"    TEXT,
  "from_tier"   "kora"."PlanTier",
  "to_tier"     "kora"."PlanTier",
  "from_status" "kora"."SubscriptionStatus",
  "to_status"   "kora"."SubscriptionStatus",
  "amount"      DECIMAL(14,2),
  "cycle"       TEXT,
  "reason"      TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "subscription_events_user_id_created_at_idx"
  ON "kora"."subscription_events"("user_id", "created_at");

ALTER TABLE "kora"."subscription_events"
  ADD CONSTRAINT "subscription_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "kora"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
