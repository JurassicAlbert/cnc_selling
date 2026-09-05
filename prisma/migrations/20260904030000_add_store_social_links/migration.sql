-- The shop's own social profiles, for the strip above the navigation.
--
-- Owner request, 2026-09-04: that strip is for "fb insta itd", not for links
-- to our own subpages. Nullable with no default, because "not configured" is
-- the honest starting state for every one of them - nobody has told us these
-- accounts exist yet, and a social icon linking to a profile nobody has
-- claimed is worse than no icon at all.
ALTER TABLE "StoreSettings" ADD COLUMN "facebookUrl" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN "tiktokUrl" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN "youtubeUrl" TEXT;
