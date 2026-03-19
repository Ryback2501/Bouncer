-- Drop Invitation first (it has FK to Admin), then Admin
DROP TABLE IF EXISTS "Invitation";
DROP TABLE IF EXISTS "Admin";

-- AlterTable User: add email and isGlobalAdmin
ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD COLUMN "isGlobalAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable Invitation (now references User)
CREATE TABLE "Invitation" (
    "id"          TEXT NOT NULL,
    "token"       TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "usedAt"      TIMESTAMP(3),
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
