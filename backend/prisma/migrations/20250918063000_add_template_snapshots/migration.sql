-- CreateTable
CREATE TABLE "template_snapshots" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionId" TEXT,
    "plan" JSONB,
    "html" TEXT,
    "css" TEXT,
    "js" TEXT,
    "components" JSONB,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdByName" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "template_snapshots_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "template_snapshots" ADD CONSTRAINT "template_snapshots_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_snapshots" ADD CONSTRAINT "template_snapshots_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "template_snapshots_templateId_createdAt_idx" ON "template_snapshots"("templateId", "createdAt");
