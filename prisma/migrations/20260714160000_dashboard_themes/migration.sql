-- AlterTable
ALTER TABLE "User" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'nocturne';

-- AlterTable
ALTER TABLE "Dashboard" ADD COLUMN "shareTheme" TEXT NOT NULL DEFAULT 'nocturne';
