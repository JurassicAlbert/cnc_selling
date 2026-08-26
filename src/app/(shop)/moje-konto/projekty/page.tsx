import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { formatPln } from '@/domain/money/money';
import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { listConfigurationsForUser } from '@/server/repositories/cart';
import { addSavedConfigurationToCart } from '@/server/actions/cart';
import { writeSelectionsToSearch } from '@/ui/islands/configurator/selections-url';
import { Heading } from '@/ui/primitives/Heading';
import { Text } from '@/ui/primitives/Text';

export const metadata: Metadata = {
  title: SITE.accountConfigurationsHeadingPl,
};

export default async function AccountConfigurationsPage() {
  const session = await getSession();
  const configurations = session === null ? [] : await listConfigurationsForUser(session.userId);

  return (
    <div>
      <Heading level={1}>{SITE.accountConfigurationsHeadingPl}</Heading>

      {configurations.length === 0 ? (
        <div style={{ marginBlockStart: 24 }}>
          <Text muted>{SITE.accountConfigurationsEmptyPl}</Text>
          <Link href="/" style={{ display: 'inline-block', marginBlockStart: 12 }}>
            {SITE.accountConfigurationsEmptyActionPl}
          </Link>
        </div>
      ) : (
        <div style={{ marginBlockStart: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {configurations.map((configuration) => {
            const editHref = `/produkt/${configuration.productSlug}?${writeSelectionsToSearch(configuration.selections)}&edit=${configuration.configurationId}`;
            return (
              <div
                key={configuration.configurationId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: 16,
                  border: '1px solid var(--mui-palette-divider)',
                  borderRadius: 4,
                }}
              >
                {configuration.imageUrl !== null && (
                  <Image
                    src={configuration.imageUrl}
                    alt={configuration.productNamePl}
                    width={64}
                    height={64}
                    style={{ objectFit: 'cover', borderRadius: 4 }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <Text>{configuration.productNamePl}</Text>
                  {configuration.priceGrossGrosze !== null && (
                    <Text muted>{formatPln(configuration.priceGrossGrosze)}</Text>
                  )}
                </div>
                <Link href={editHref} style={{ font: 'var(--mui-font-body2)' }}>
                  {SITE.accountConfigurationEditPl}
                </Link>
                {configuration.isComplete && (
                  <form
                    action={addSavedConfigurationToCart.bind(
                      null,
                      configuration.productSlug,
                      configuration.selections,
                      configuration.acknowledgedWarnings,
                      1,
                    )}
                  >
                    <button type="submit" style={{ font: 'var(--mui-font-body2)', cursor: 'pointer' }}>
                      {SITE.accountConfigurationAddToCartPl}
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
