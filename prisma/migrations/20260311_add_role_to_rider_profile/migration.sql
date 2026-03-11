-- AlterTable
ALTER TABLE "RiderProfile" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'rider';
