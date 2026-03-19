-- AlterTable: add isGlobalAdmin to Admin
ALTER TABLE "Admin" ADD COLUMN "isGlobalAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: Invitation
CREATE TABLE "Invitation" (
    "id"          TEXT NOT NULL,
    "token"       TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "usedAt"      TIMESTAMP(3),
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: promote earliest admin to global admin
UPDATE "Admin"
SET "isGlobalAdmin" = true
WHERE "id" = (SELECT "id" FROM "Admin" ORDER BY "createdAt" ASC LIMIT 1);
