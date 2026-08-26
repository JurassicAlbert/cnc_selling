import type { Metadata } from 'next';
import Link from 'next/link';

import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { Heading } from '@/ui/primitives/Heading';
import { Text } from '@/ui/primitives/Text';

export const metadata: Metadata = {
  title: SITE.headerAccountLinkPl,
};

export default async function AccountOverviewPage() {
  const session = await getSession();

  return (
    <div>
      <Heading level={1}>{SITE.headerAccountLinkPl}</Heading>
      <Text muted>{session?.name}</Text>
      <div style={{ marginBlockStart: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link href="/moje-konto/zamowienia">{SITE.accountNavOrdersPl}</Link>
        <Link href="/moje-konto/projekty">{SITE.accountNavConfigurationsPl}</Link>
      </div>
    </div>
  );
}
