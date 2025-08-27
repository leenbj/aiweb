/*
  Warnings:

  - You are about to drop the column `token_limit_daily` on the `user_settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user_settings" DROP COLUMN "token_limit_daily";
