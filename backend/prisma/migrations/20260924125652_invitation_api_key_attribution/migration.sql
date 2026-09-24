-- Records which API key minted an invitation, so one can be traced back after an incident.
-- Invitations created through /api/v1/invitations previously left no creator at all.
--
-- These are plain columns with no foreign key, on purpose. API keys are hard-deleted on revocation
-- and the documented rotation is "create the new key, switch over, delete the old one" — so a real
-- relation with ON DELETE SET NULL would wipe the attribution exactly when someone is investigating,
-- and ON DELETE RESTRICT would block revoking a key that had ever minted an invitation. The label is
-- copied alongside the id so the record still reads usefully once the key is gone.
--
-- Safe: both columns are nullable and additive, with no backfill. Existing rows keep NULL, which is
-- the correct value for invitations that were not created by a key. No-op on a fresh database.

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "createdByApiKeyId" TEXT,
ADD COLUMN     "createdByApiKeyLabel" TEXT;
