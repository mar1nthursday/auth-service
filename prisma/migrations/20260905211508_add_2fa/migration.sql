-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SecurityEventType" ADD VALUE 'TWO_FACTOR_ENABLED';
ALTER TYPE "SecurityEventType" ADD VALUE 'TWO_FACTOR_DISABLED';
ALTER TYPE "SecurityEventType" ADD VALUE 'TWO_FACTOR_FAILURE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpSecret" TEXT;
