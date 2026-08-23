import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';
import { bodyFont, displayFont } from '@/ui/theme/fonts';

export const metadata: Metadata = {
  title: 'CNC Selling',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
