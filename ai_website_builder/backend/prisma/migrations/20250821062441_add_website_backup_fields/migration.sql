-- AlterTable
ALTER TABLE "websites" ADD COLUMN     "css" TEXT,
ADD COLUMN     "deploymentPath" TEXT,
ADD COLUMN     "html" TEXT,
ADD COLUMN     "js" TEXT;

-- CreateTable
CREATE TABLE "website_backups" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "html" TEXT,
    "css" TEXT,
    "js" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_backups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "website_backups_websiteId_version_key" ON "website_backups"("websiteId", "version");

-- AddForeignKey
ALTER TABLE "website_backups" ADD CONSTRAINT "website_backups_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
