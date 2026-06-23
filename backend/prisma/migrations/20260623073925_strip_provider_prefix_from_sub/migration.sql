-- Historically the OAuth strategies stored `sub` with a redundant provider prefix
-- (e.g. "google:123") even though the User table has a dedicated `provider` column and a
-- unique([sub, provider]) constraint. External apps query /api/v1/access with the clean,
-- provider-native subject id, so the prefixed value never matched. Strip the prefix from
-- existing rows so stored subs equal the provider-native id.
--
-- Safe: only rows whose `sub` begins with "<provider>:" are touched, and each
-- "<provider>:<id>" maps uniquely back to (<id>, <provider>), so no unique([sub, provider])
-- collisions are possible. No-op on a fresh database.
UPDATE "User"
SET "sub" = substring("sub" FROM char_length("provider") + 2)
WHERE "sub" LIKE "provider" || ':%';
