/*
  Warnings:

  - Added the required column `match_id` to the `dates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `proposed_by` to the `dates` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "dates" ADD COLUMN     "activity_type" TEXT,
ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "match_id" TEXT NOT NULL,
ADD COLUMN     "proposed_by" TEXT NOT NULL,
ADD COLUMN     "proposed_locations" JSONB,
ALTER COLUMN "status" SET DEFAULT 'proposed';

-- CreateIndex
CREATE INDEX "dates_match_id_status_idx" ON "dates"("match_id", "status");

-- CreateIndex
CREATE INDEX "dates_partner_id_status_idx" ON "dates"("partner_id", "status");

-- AddForeignKey
ALTER TABLE "dates" ADD CONSTRAINT "dates_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
