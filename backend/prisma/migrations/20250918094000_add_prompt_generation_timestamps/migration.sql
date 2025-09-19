-- AlterTable
ALTER TABLE "prompt_generation_runs" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "prompt_generation_runs" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Ensure updatedAt auto-updates via trigger (optional). Prisma @updatedAt handles values on client side, so no extra trigger required.
