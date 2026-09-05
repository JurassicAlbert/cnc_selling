-- The delivery details a customer typed on the cart page, before there is an
-- order to attach them to.
--
-- Owner request, 2026-09-04: the cart should let someone give their full
-- address and a note there. Every column is nullable with no default, because
-- "not filled in" is the correct state for an existing cart and for every new
-- one - this is a draft, not a requirement.
ALTER TABLE "Cart" ADD COLUMN "draftEmail" TEXT;
ALTER TABLE "Cart" ADD COLUMN "draftPhone" TEXT;
ALTER TABLE "Cart" ADD COLUMN "draftFirstName" TEXT;
ALTER TABLE "Cart" ADD COLUMN "draftLastName" TEXT;
ALTER TABLE "Cart" ADD COLUMN "draftStreet" TEXT;
ALTER TABLE "Cart" ADD COLUMN "draftPostalCode" TEXT;
ALTER TABLE "Cart" ADD COLUMN "draftCity" TEXT;
ALTER TABLE "Cart" ADD COLUMN "draftCourierNotePl" TEXT;
