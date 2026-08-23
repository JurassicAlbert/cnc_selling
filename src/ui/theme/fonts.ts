/**
 * Self-hosted via `next/font/google` — downloaded at build time and served
 * from this origin, never a runtime request to Google (ARCHITECTURE.md
 * §17.1). `latin-ext` is not optional: the default `latin` subset omits
 * ą ć ę ł ń ó ś ź ż and fails silently on real Polish copy.
 *
 * Fraunces (display serif) + Inter (body/UI) is one of the pairings
 * ARCHITECTURE.md §2.1 recommends, not a decision it hands down — it names
 * three serif options and two body options as equally acceptable. This is a
 * swappable choice: changing it is a two-line edit here, nothing structural
 * depends on which pair was picked.
 */

import { Fraunces, Inter } from 'next/font/google';

export const displayFont = Fraunces({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-display',
  display: 'swap',
});

export const bodyFont = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-body',
  display: 'swap',
});
