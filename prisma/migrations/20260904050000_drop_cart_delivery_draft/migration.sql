-- Drops the cart delivery-draft columns added earlier the same day.
--
-- They existed so the cart page could collect an address and pre-fill the
-- order form with it. The owner then asked for that form to live only on the
-- second step ("formularz powinien być tylko w drugiej karcie żeby nie
-- powtarzać"), which leaves nothing to write them: no UI, no Server Action,
-- no reader.
--
-- Dropped rather than left in place. Eight unused nullable columns on the
-- cart are debris that the next person has to work out the history of, and
-- what they held was a transient draft nobody can miss - never an order,
-- never anything an order was built from.
ALTER TABLE "Cart" DROP COLUMN "draftEmail";
ALTER TABLE "Cart" DROP COLUMN "draftPhone";
ALTER TABLE "Cart" DROP COLUMN "draftFirstName";
ALTER TABLE "Cart" DROP COLUMN "draftLastName";
ALTER TABLE "Cart" DROP COLUMN "draftStreet";
ALTER TABLE "Cart" DROP COLUMN "draftPostalCode";
ALTER TABLE "Cart" DROP COLUMN "draftCity";
ALTER TABLE "Cart" DROP COLUMN "draftCourierNotePl";
