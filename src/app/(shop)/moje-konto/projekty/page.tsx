import type { Metadata } from 'next';
import Link from 'next/link';

import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { listConfigurationsForUser } from '@/server/repositories/cart';
import { Heading } from '@/ui/primitives/Heading';
import { Text } from '@/ui/primitives/Text';
import { AccountConfigurationsList } from '@/ui/islands/AccountConfigurationsList';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';

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
        <div style={{ marginBlockStart: 24 }}>
          <ThemeRegistry>
            <AccountConfigurationsList configurations={configurations} />
          </ThemeRegistry>
        </div>
      )}
    </div>
  );
}
