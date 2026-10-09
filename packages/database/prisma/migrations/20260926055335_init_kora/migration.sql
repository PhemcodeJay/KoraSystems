-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "kora";

-- CreateEnum
CREATE TYPE "kora"."UserRole" AS ENUM ('SME', 'SUPPLIER', 'CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "kora"."OnboardingStep" AS ENUM ('BUSINESS_INFO', 'PRODUCTS', 'PAYMENTS', 'COMPLETE');

-- CreateEnum
CREATE TYPE "kora"."OnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "kora"."SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "kora"."LoanStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'DISBURSEMENT_PENDING', 'DISBURSED', 'REPAYING', 'SETTLED', 'DEFAULTED', 'BLOCKED_NO_PARTNER');

-- CreateEnum
CREATE TYPE "kora"."RepaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'WAIVED');

-- CreateEnum
CREATE TYPE "kora"."OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "kora"."InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'DUE', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "kora"."SavingsTxnType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'INTEREST', 'FEE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "kora"."BnplStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'DEFAULTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "kora"."InstallmentStatus" AS ENUM ('SCHEDULED', 'PAID', 'OVERDUE', 'FAILED');

-- CreateEnum
CREATE TYPE "kora"."PaymentMethod" AS ENUM ('MPESA_STK', 'MPESA_B2C', 'WALLET', 'CASH', 'LOAN', 'BNPL', 'CARD');

-- CreateEnum
CREATE TYPE "kora"."PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "kora"."LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "kora"."InsightType" AS ENUM ('CREDIT', 'FORECAST', 'REVENUE', 'INVENTORY', 'CUSTOMER', 'GENERAL');

-- CreateEnum
CREATE TYPE "kora"."NotificationType" AS ENUM ('LOAN_UPDATE', 'BNPL_UPDATE', 'ORDER_UPDATE', 'PAYMENT', 'INSIGHT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "kora"."CreditRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateTable
CREATE TABLE "kora"."users" (
    "id" TEXT NOT NULL,
    "auth_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "full_name" TEXT NOT NULL,
    "role" "kora"."UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."smes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "registration_number" TEXT,
    "business_type" TEXT,
    "county" TEXT,
    "town" TEXT,
    "address" TEXT,
    "years_in_business" INTEGER,
    "onboarding_step" "kora"."OnboardingStep" NOT NULL DEFAULT 'BUSINESS_INFO',
    "onboarding_status" "kora"."OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "mpesa_till" TEXT,
    "mpesa_paybill" TEXT,
    "subscription_status" "kora"."SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "subscription_paid_at" TIMESTAMP(3),
    "subscription_amount" DECIMAL(14,2) NOT NULL DEFAULT 2500,
    "subscription_cycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."suppliers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "registration_no" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "county" TEXT,
    "town" TEXT,
    "address" TEXT,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "mpesa_paybill" TEXT,
    "mpesa_till" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."customers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "county" TEXT,
    "town" TEXT,
    "loyalty_points" INTEGER NOT NULL DEFAULT 0,
    "loyalty_tier" TEXT NOT NULL DEFAULT 'BRONZE',
    "total_spend" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "purchase_count" INTEGER NOT NULL DEFAULT 0,
    "credit_limit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit_used" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit_score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."products" (
    "id" TEXT NOT NULL,
    "sme_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "category" TEXT,
    "price" DECIMAL(14,2) NOT NULL,
    "cost_price" DECIMAL(14,2),
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 10,
    "reorder_level" INTEGER NOT NULL DEFAULT 10,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "client_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."sales" (
    "id" TEXT NOT NULL,
    "sme_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "cost_total" DECIMAL(14,2),
    "payment_method" "kora"."PaymentMethod" NOT NULL,
    "payment_status" "kora"."PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "platform_fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "mpesa_receipt" TEXT,
    "client_id" TEXT,
    "notes" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "transaction_id" TEXT,
    "sold_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."sale_items" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,
    "cost_price" DECIMAL(14,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."orders" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "sme_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "status" "kora"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "total_amount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "placed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "sme_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "order_id" TEXT,
    "status" "kora"."InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "amount_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "product_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."loans" (
    "id" TEXT NOT NULL,
    "loan_number" TEXT NOT NULL,
    "sme_id" TEXT NOT NULL,
    "principal" DECIMAL(14,2) NOT NULL,
    "interest_rate" DECIMAL(7,4) NOT NULL,
    "term_months" INTEGER NOT NULL,
    "total_payable" DECIMAL(14,2) NOT NULL,
    "amount_repaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "kora"."LoanStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "purpose" TEXT,
    "credit_score_at_application" INTEGER,
    "max_approved_amount" DECIMAL(14,2),
    "disbursed_at" TIMESTAMP(3),
    "disbursement_ref" TEXT,
    "blocked_reason" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "decision_reason" TEXT,
    "decided_at" TIMESTAMP(3),
    "decided_by_user_id" TEXT,
    "first_payment_date" TIMESTAMP(3),
    "maturity_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."repayments" (
    "id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "amount_due" DECIMAL(14,2) NOT NULL,
    "principal_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "interest_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "kora"."RepaymentStatus" NOT NULL DEFAULT 'PENDING',
    "due_date" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "mpesa_receipt" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repayments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."savings" (
    "id" TEXT NOT NULL,
    "sme_id" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_deposits" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_withdrawals" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "interest_earned" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "interest_rate" DECIMAL(7,4) NOT NULL DEFAULT 0.05,
    "is_frozen" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."savings_transactions" (
    "id" TEXT NOT NULL,
    "savings_id" TEXT NOT NULL,
    "type" "kora"."SavingsTxnType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balance_after" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,
    "narration" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "transaction_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "savings_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."bnpl" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "sme_id" TEXT NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "down_payment" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "financed_amount" DECIMAL(14,2) NOT NULL,
    "installment_count" INTEGER NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "status" "kora"."BnplStatus" NOT NULL DEFAULT 'PENDING',
    "approved_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bnpl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."bnpl_items" (
    "id" TEXT NOT NULL,
    "bnpl_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "bnpl_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."bnpl_installments" (
    "id" TEXT NOT NULL,
    "bnpl_id" TEXT NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "amount_due" DECIMAL(14,2) NOT NULL,
    "amount_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "kora"."InstallmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "due_date" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "mpesa_receipt" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bnpl_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."transactions" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "account_code" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "sme_id" TEXT,
    "customer_id" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "loan_id" TEXT,
    "repayment_id" TEXT,
    "bnpl_installment_id" TEXT,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."ledger_entries" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "direction" "kora"."LedgerDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "narration" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."credit_scores" (
    "id" TEXT NOT NULL,
    "sme_id" TEXT NOT NULL,
    "loan_id" TEXT,
    "score" INTEGER NOT NULL,
    "risk_level" "kora"."CreditRiskLevel" NOT NULL,
    "max_loan" DECIMAL(14,2) NOT NULL,
    "interest_rate" DECIMAL(7,4) NOT NULL,
    "explanation" TEXT NOT NULL,
    "recommendations" TEXT[],
    "factors" JSONB NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'deterministic-v1',
    "is_placeholder" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."insights" (
    "id" TEXT NOT NULL,
    "sme_id" TEXT NOT NULL,
    "type" "kora"."InsightType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kora"."notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sme_id" TEXT,
    "customer_id" TEXT,
    "type" "kora"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "kora"."users"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "kora"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "kora"."users"("phone");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "kora"."users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "smes_user_id_key" ON "kora"."smes"("user_id");

-- CreateIndex
CREATE INDEX "smes_onboarding_status_idx" ON "kora"."smes"("onboarding_status");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_user_id_key" ON "kora"."suppliers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_user_id_key" ON "kora"."customers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "kora"."customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "kora"."customers"("email");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "kora"."customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "kora"."products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "kora"."products"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "products_client_id_key" ON "kora"."products"("client_id");

-- CreateIndex
CREATE INDEX "products_sme_id_is_active_idx" ON "kora"."products"("sme_id", "is_active");

-- CreateIndex
CREATE INDEX "products_barcode_idx" ON "kora"."products"("barcode");

-- CreateIndex
CREATE INDEX "products_sku_idx" ON "kora"."products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "sales_client_id_key" ON "kora"."sales"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_transaction_id_key" ON "kora"."sales"("transaction_id");

-- CreateIndex
CREATE INDEX "sales_sme_id_sold_at_idx" ON "kora"."sales"("sme_id", "sold_at");

-- CreateIndex
CREATE INDEX "sales_sme_id_idx" ON "kora"."sales"("sme_id");

-- CreateIndex
CREATE INDEX "sales_customer_id_idx" ON "kora"."sales"("customer_id");

-- CreateIndex
CREATE INDEX "sale_items_sale_id_idx" ON "kora"."sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "sale_items_product_id_idx" ON "kora"."sale_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "kora"."orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_sme_id_status_idx" ON "kora"."orders"("sme_id", "status");

-- CreateIndex
CREATE INDEX "orders_supplier_id_status_idx" ON "kora"."orders"("supplier_id", "status");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "kora"."order_items"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "kora"."invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_sme_id_status_idx" ON "kora"."invoices"("sme_id", "status");

-- CreateIndex
CREATE INDEX "invoices_supplier_id_idx" ON "kora"."invoices"("supplier_id");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "kora"."invoice_items"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "loans_loan_number_key" ON "kora"."loans"("loan_number");

-- CreateIndex
CREATE INDEX "loans_sme_id_status_idx" ON "kora"."loans"("sme_id", "status");

-- CreateIndex
CREATE INDEX "loans_status_idx" ON "kora"."loans"("status");

-- CreateIndex
CREATE INDEX "repayments_loan_id_status_idx" ON "kora"."repayments"("loan_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "repayments_loan_id_installment_number_key" ON "kora"."repayments"("loan_id", "installment_number");

-- CreateIndex
CREATE UNIQUE INDEX "savings_sme_id_key" ON "kora"."savings"("sme_id");

-- CreateIndex
CREATE UNIQUE INDEX "savings_account_number_key" ON "kora"."savings"("account_number");

-- CreateIndex
CREATE UNIQUE INDEX "savings_transactions_transaction_id_key" ON "kora"."savings_transactions"("transaction_id");

-- CreateIndex
CREATE INDEX "savings_transactions_savings_id_created_at_idx" ON "kora"."savings_transactions"("savings_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bnpl_reference_key" ON "kora"."bnpl"("reference");

-- CreateIndex
CREATE INDEX "bnpl_customer_id_status_idx" ON "kora"."bnpl"("customer_id", "status");

-- CreateIndex
CREATE INDEX "bnpl_sme_id_idx" ON "kora"."bnpl"("sme_id");

-- CreateIndex
CREATE INDEX "bnpl_items_bnpl_id_idx" ON "kora"."bnpl_items"("bnpl_id");

-- CreateIndex
CREATE INDEX "bnpl_installments_bnpl_id_status_idx" ON "kora"."bnpl_installments"("bnpl_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bnpl_installments_bnpl_id_installment_number_key" ON "kora"."bnpl_installments"("bnpl_id", "installment_number");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reference_key" ON "kora"."transactions"("reference");

-- CreateIndex
CREATE INDEX "transactions_account_code_posted_at_idx" ON "kora"."transactions"("account_code", "posted_at");

-- CreateIndex
CREATE INDEX "transactions_sme_id_idx" ON "kora"."transactions"("sme_id");

-- CreateIndex
CREATE INDEX "transactions_type_posted_at_idx" ON "kora"."transactions"("type", "posted_at");

-- CreateIndex
CREATE INDEX "transactions_loan_id_idx" ON "kora"."transactions"("loan_id");

-- CreateIndex
CREATE INDEX "transactions_repayment_id_idx" ON "kora"."transactions"("repayment_id");

-- CreateIndex
CREATE INDEX "transactions_bnpl_installment_id_idx" ON "kora"."transactions"("bnpl_installment_id");

-- CreateIndex
CREATE INDEX "ledger_entries_transaction_id_idx" ON "kora"."ledger_entries"("transaction_id");

-- CreateIndex
CREATE INDEX "ledger_entries_account_code_idx" ON "kora"."ledger_entries"("account_code");

-- CreateIndex
CREATE INDEX "credit_scores_sme_id_created_at_idx" ON "kora"."credit_scores"("sme_id", "created_at");

-- CreateIndex
CREATE INDEX "insights_sme_id_type_created_at_idx" ON "kora"."insights"("sme_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "insights_is_read_idx" ON "kora"."insights"("is_read");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "kora"."notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_sme_id_idx" ON "kora"."notifications"("sme_id");

-- AddForeignKey
ALTER TABLE "kora"."smes" ADD CONSTRAINT "smes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kora"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."suppliers" ADD CONSTRAINT "suppliers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kora"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kora"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."products" ADD CONSTRAINT "products_sme_id_fkey" FOREIGN KEY ("sme_id") REFERENCES "kora"."smes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."products" ADD CONSTRAINT "products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "kora"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."sales" ADD CONSTRAINT "sales_sme_id_fkey" FOREIGN KEY ("sme_id") REFERENCES "kora"."smes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "kora"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."sales" ADD CONSTRAINT "sales_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "kora"."transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "kora"."sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "kora"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."orders" ADD CONSTRAINT "orders_sme_id_fkey" FOREIGN KEY ("sme_id") REFERENCES "kora"."smes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."orders" ADD CONSTRAINT "orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "kora"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "kora"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "kora"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."invoices" ADD CONSTRAINT "invoices_sme_id_fkey" FOREIGN KEY ("sme_id") REFERENCES "kora"."smes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."invoices" ADD CONSTRAINT "invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "kora"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "kora"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "kora"."invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."invoice_items" ADD CONSTRAINT "invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "kora"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."loans" ADD CONSTRAINT "loans_sme_id_fkey" FOREIGN KEY ("sme_id") REFERENCES "kora"."smes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."repayments" ADD CONSTRAINT "repayments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "kora"."loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."savings" ADD CONSTRAINT "savings_sme_id_fkey" FOREIGN KEY ("sme_id") REFERENCES "kora"."smes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."savings_transactions" ADD CONSTRAINT "savings_transactions_savings_id_fkey" FOREIGN KEY ("savings_id") REFERENCES "kora"."savings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."savings_transactions" ADD CONSTRAINT "savings_transactions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "kora"."transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."bnpl" ADD CONSTRAINT "bnpl_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "kora"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."bnpl" ADD CONSTRAINT "bnpl_sme_id_fkey" FOREIGN KEY ("sme_id") REFERENCES "kora"."smes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."bnpl_items" ADD CONSTRAINT "bnpl_items_bnpl_id_fkey" FOREIGN KEY ("bnpl_id") REFERENCES "kora"."bnpl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."bnpl_items" ADD CONSTRAINT "bnpl_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "kora"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."bnpl_installments" ADD CONSTRAINT "bnpl_installments_bnpl_id_fkey" FOREIGN KEY ("bnpl_id") REFERENCES "kora"."bnpl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."transactions" ADD CONSTRAINT "transactions_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "kora"."loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."transactions" ADD CONSTRAINT "transactions_repayment_id_fkey" FOREIGN KEY ("repayment_id") REFERENCES "kora"."repayments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."transactions" ADD CONSTRAINT "transactions_bnpl_installment_id_fkey" FOREIGN KEY ("bnpl_installment_id") REFERENCES "kora"."bnpl_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."transactions" ADD CONSTRAINT "transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "kora"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "kora"."transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."credit_scores" ADD CONSTRAINT "credit_scores_sme_id_fkey" FOREIGN KEY ("sme_id") REFERENCES "kora"."smes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."credit_scores" ADD CONSTRAINT "credit_scores_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "kora"."loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."insights" ADD CONSTRAINT "insights_sme_id_fkey" FOREIGN KEY ("sme_id") REFERENCES "kora"."smes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kora"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."notifications" ADD CONSTRAINT "notifications_sme_id_fkey" FOREIGN KEY ("sme_id") REFERENCES "kora"."smes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kora"."notifications" ADD CONSTRAINT "notifications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "kora"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
