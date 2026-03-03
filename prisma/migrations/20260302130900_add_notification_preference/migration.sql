-- CreateEnum
CREATE TYPE "NotificationPreference" AS ENUM ('IN_APP_ONLY', 'IN_APP_AND_EMAIL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "notification_preference" "NotificationPreference" NOT NULL DEFAULT 'IN_APP_ONLY';
