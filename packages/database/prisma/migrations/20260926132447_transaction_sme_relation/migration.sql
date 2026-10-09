-- AddForeignKey
ALTER TABLE "kora"."transactions" ADD CONSTRAINT "transactions_sme_id_fkey" FOREIGN KEY ("sme_id") REFERENCES "kora"."smes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
