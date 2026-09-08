-- The engraved inscription is offered on the bracelet and nowhere else.
--
-- Owner, 2026-09-06: "they pick a font from list - but thats only for
-- specific product like bracelet, overall they descirbe they own product. So
-- you can hide the personalization form most of the products and category.
-- Only personalization is picking material and size for now."
--
-- `applicableSteps` narrows the PERSONALIZATION step on whether the product
-- has a `PersonalizationSpec`, so deleting the row is what takes the step off
-- a product - and adding one back turns it on again with no code change. The
-- seed carries the same single spec, so a fresh database agrees; the seed is
-- idempotent and leaves existing rows alone, which is why an already-seeded
-- database needs this.
--
-- Deleted rather than deactivated. `PersonalizationSpec` has no `isActive`
-- column and nothing references it - `OrderItem` keeps the personalisation
-- text in its own snapshot, so past orders are unaffected by this and read
-- back exactly as they did before.
--
-- Scoped by the product's slug rather than by type: the type says what a
-- product *may* have, and the owner's decision is about these products.

DELETE FROM "PersonalizationSpec"
WHERE "productId" IN (
  SELECT "id" FROM "Product" WHERE "slug" <> 'bransoletka-z-grawerem'
);
