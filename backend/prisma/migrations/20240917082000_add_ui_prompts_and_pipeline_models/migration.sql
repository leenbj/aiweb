-- CreateEnum
CREATE TYPE "PromptStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PromptSource" AS ENUM ('OPERATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('ZIP', 'PROMPT');

-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "source" TEXT DEFAULT 'ZIP';
ALTER TABLE "templates" ADD COLUMN     "planSnapshot" JSONB;

-- CreateTable
CREATE TABLE "ui_prompts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PromptStatus" NOT NULL DEFAULT 'PENDING',
    "source" "PromptSource" NOT NULL DEFAULT 'OPERATION',
    "targetSlug" TEXT,
    "latestJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ui_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_generation_runs" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "status" "PipelineStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMessage" TEXT,
    "artifactPath" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "prompt_generation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_pipeline_jobs" (
    "id" TEXT NOT NULL,
    "promptId" TEXT,
    "importType" "ImportType" NOT NULL,
    "templateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "versionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PipelineStatus" NOT NULL DEFAULT 'QUEUED',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_pipeline_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ui_prompts_name_key" ON "ui_prompts"("name");

-- CreateIndex
CREATE INDEX "ui_prompts_status_idx" ON "ui_prompts"("status");

-- CreateIndex
CREATE INDEX "ui_prompts_targetSlug_idx" ON "ui_prompts"("targetSlug");

-- CreateIndex
CREATE INDEX "prompt_generation_runs_promptId_idx" ON "prompt_generation_runs"("promptId");

-- CreateIndex
CREATE INDEX "prompt_generation_runs_status_idx" ON "prompt_generation_runs"("status");

-- CreateIndex
CREATE INDEX "template_pipeline_jobs_promptId_idx" ON "template_pipeline_jobs"("promptId");

-- CreateIndex
CREATE INDEX "template_pipeline_jobs_status_idx" ON "template_pipeline_jobs"("status");

-- AddForeignKey
ALTER TABLE "prompt_generation_runs" ADD CONSTRAINT "prompt_generation_runs_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "ui_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_pipeline_jobs" ADD CONSTRAINT "template_pipeline_jobs_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "ui_prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
