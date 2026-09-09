/**
 * Which products offer an engraved inscription at all.
 *
 * Owner, 2026-09-06: "they pick a font from list - but thats only for
 * specific product like bracelet, overall they descirbe they own product. So
 * you can hide the personalization form most of the products and category.
 * Only personalization is picking material and size for now."
 *
 * So the inscription step belongs to the bracelet and nothing else. Everywhere
 * else a customer picks a material and a size, and anything bespoke is
 * described through the custom-order route rather than typed into a text
 * field the workshop cannot necessarily set.
 *
 * **Implemented as a narrowing, not as a new rule.** `applicableSteps`
 * already drops DESIGN, FINISH, THICKNESS and INSTALLATION_VARIANT when a
 * product has no options for them; PERSONALIZATION fell through to `true` and
 * so appeared for every product type that listed it, spec or no spec. It now
 * narrows on the spec the same way - which means "does this product offer an
 * inscription" is answered by the data, and turning it back on for a product
 * is a row rather than a deployment.
 *
 * That is also the read-side half of BUG-06. That item fixed the *write*
 * path, so a product with no spec could no longer have `personalizationText`
 * stored against it; the configurator would still show the step and take the
 * text first.
 */

import { describe, expect, it } from 'vitest';

import { applicableSteps } from '@/server/configurator/validate-and-price';
import { EMPTY_SELECTIONS } from '@/domain/configuration/steps';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
import { prisma } from '@/server/db/client';
import { readsActivePricing } from './pricing-fixture';

/*
  T-32. This file prices against whichever `PricingSettings` version is live,
  so it must not run while `admin-pricing.test.ts` or
  `pricing-version-swap.test.ts` has a throwaway version published. A shared
  lock, so it still runs in parallel with every other reader - see
  `pricing-fixture.ts` for why an exclusive one would have serialised the
  suite.
*/
readsActivePricing();

async function stepsFor(slug: string): Promise<readonly string[]> {
  const data = await getConfiguratorProductData(slug);
  if (data === null) {
    throw new Error(`no configurator data for ${slug}`);
  }
  return applicableSteps(data, EMPTY_SELECTIONS);
}

describe('the inscription step is offered where it can actually be made', () => {
  it('offers it on the bracelet, which is the product that has a font list', async () => {
    expect(await stepsFor('bransoletka-z-grawerem')).toContain('PERSONALIZATION');
  });

  it('does not offer it on a wall-art product', async () => {
    expect(await stepsFor('obraz-drewniany-z-grawerem')).not.toContain('PERSONALIZATION');
  });

  it('still offers material and size everywhere - that is the whole configurator now', async () => {
    // The owner's own words for what is left: "Only personalization is
    // picking material and size for now". Asserted so a narrowing that went
    // too far fails here rather than on the shop.
    const steps = await stepsFor('obraz-drewniany-z-grawerem');
    expect(steps).toContain('MATERIAL');
    expect(steps).toContain('SIZE');
  });

  it('offers it to no product that lacks a spec, whatever its type says', async () => {
    /*
      The general rule rather than two examples. `STEPS_BY_PRODUCT_TYPE` still
      lists PERSONALIZATION for several types, and that is deliberate - the
      type says what a product *may* have, the spec says what this one does.
      A product typed WALL_ART with a spec added tomorrow gets the step back
      with no code change, which is the point of narrowing on data.
    */
    const products = await prisma.product.findMany({
      where: { isActive: true, category: { isActive: true } },
      select: { slug: true, personalization: { select: { id: true } } },
    });
    expect(products.length).toBeGreaterThan(0);

    for (const product of products) {
      const offered = (await stepsFor(product.slug)).includes('PERSONALIZATION');
      expect(offered, `${product.slug} offers the inscription step`).toBe(product.personalization !== null);
    }
  });

  it('leaves exactly one product offering an inscription today', async () => {
    // Pins the owner's decision itself, not just the mechanism. If a seed or
    // a migration quietly reintroduces a spec somewhere, this says so.
    const withSpec = await prisma.product.findMany({
      where: { isActive: true, category: { isActive: true }, personalization: { isNot: null } },
      select: { slug: true },
    });

    expect(withSpec.map((product) => product.slug)).toEqual(['bransoletka-z-grawerem']);
  });
});
