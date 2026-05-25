-- App-scoped invitations: invitations now carry a target application + role (so connected
-- apps can invite their own users), an optional redirect URL, and an optional creator
-- (app-minted invites have no admin creator). Applications gain a redirect-URI allowlist.
--
-- applicationId/roleId are added nullable, backfilled for any existing (legacy admin)
-- invitations from the Bouncer app + admin role, then set NOT NULL.

-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_createdById_fkey";

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "redirectUris" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable (applicationId/roleId nullable for now — backfilled below)
ALTER TABLE "Invitation" ADD COLUMN     "applicationId" TEXT,
ADD COLUMN     "redirectUri" TEXT,
ADD COLUMN     "roleId" TEXT,
ALTER COLUMN "createdById" DROP NOT NULL;

-- Backfill legacy invitations (all were Bouncer admin invites) to the Bouncer app + admin role.
UPDATE "Invitation" i
SET "applicationId" = a."id",
    "roleId" = r."id"
FROM "Application" a
JOIN "Role" r ON r."applicationId" = a."id" AND r."customId" = 'admin'
WHERE a."customId" = 'bouncer'
  AND (i."applicationId" IS NULL OR i."roleId" IS NULL);

-- Enforce NOT NULL now that existing rows are backfilled.
ALTER TABLE "Invitation" ALTER COLUMN "applicationId" SET NOT NULL,
ALTER COLUMN "roleId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
