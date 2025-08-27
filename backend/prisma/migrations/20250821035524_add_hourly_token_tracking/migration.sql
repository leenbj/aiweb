/*
  Warnings:

  - A unique constraint covering the columns `[userId,date,hour,provider]` on the table `token_usage` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "token_usage_userId_date_provider_key";

-- AlterTable
ALTER TABLE "token_usage" ADD COLUMN     "hour" INTEGER DEFAULT 0,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "operation" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "token_usage_userId_date_hour_provider_key" ON "token_usage"("userId", "date", "hour", "provider");
