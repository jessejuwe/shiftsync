-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "location_id" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_location_id_idx" ON "audit_logs"("location_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
