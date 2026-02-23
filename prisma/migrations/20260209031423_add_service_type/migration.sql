-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('REGULAR', 'PREMIUM');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "serviceType" "ServiceType" NOT NULL DEFAULT 'REGULAR';
