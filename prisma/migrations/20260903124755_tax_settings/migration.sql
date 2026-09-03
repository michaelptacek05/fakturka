-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('MAIN', 'SECONDARY');

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "activityType" "ActivityType" NOT NULL DEFAULT 'MAIN',
ADD COLUMN     "applyTaxpayerCredit" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "flatExpenseRate" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "socialThreshold" INTEGER NOT NULL DEFAULT 117521,
ADD COLUMN     "taxpayerCredit" INTEGER NOT NULL DEFAULT 30840;
