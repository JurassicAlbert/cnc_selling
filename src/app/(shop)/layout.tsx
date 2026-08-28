import type { ReactNode } from 'react';

import { StorefrontChrome } from '@/ui/layout/StorefrontChrome';

/** See `StorefrontChrome`'s own header comment for why this exists — the true root layout no longer renders the customer chrome directly. */
export default function ShopLayout({ children }: { readonly children: ReactNode }) {
  return <StorefrontChrome>{children}</StorefrontChrome>;
}
