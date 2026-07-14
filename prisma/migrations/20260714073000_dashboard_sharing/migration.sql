-- AlterTable
ALTER TABLE "Dashboard" ADD COLUMN "shareToken" TEXT;
ALTER TABLE "Dashboard" ADD COLUMN "sharedAt" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "Dashboard_shareToken_key" ON "Dashboard"("shareToken");
