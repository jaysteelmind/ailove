/*
  Warnings:

  - You are about to drop the column `extracted_traits` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `messages` table. All the data in the column will be lost.
  - Added the required column `match_id` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `receiver_id` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sender_id` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_user_id_fkey";

-- DropIndex
DROP INDEX "messages_user_id_created_at_idx";

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "extracted_traits",
DROP COLUMN "role",
DROP COLUMN "user_id",
ADD COLUMN     "content_type" TEXT NOT NULL DEFAULT 'text',
ADD COLUMN     "match_id" TEXT NOT NULL,
ADD COLUMN     "read_at" TIMESTAMP(3),
ADD COLUMN     "receiver_id" TEXT NOT NULL,
ADD COLUMN     "sender_id" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'sent',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "extracted_traits" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_messages_user_id_created_at_idx" ON "conversation_messages"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_match_id_created_at_idx" ON "messages"("match_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");

-- CreateIndex
CREATE INDEX "messages_receiver_id_idx" ON "messages"("receiver_id");

-- CreateIndex
CREATE INDEX "messages_status_idx" ON "messages"("status");

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
