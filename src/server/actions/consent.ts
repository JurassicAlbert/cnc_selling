'use server';

import { revalidatePath } from 'next/cache';

import type { ConsentChoice } from '@/server/session/consent';
import { writeConsentChoice } from '@/server/session/consent';

export async function submitConsentChoice(choice: ConsentChoice): Promise<void> {
  await writeConsentChoice(choice);
  // The banner reads its own visibility from a server-rendered prop
  // (`layout.tsx`'s `readConsentChoice()`), so the layout must re-render
  // for it to disappear without a full page reload.
  revalidatePath('/', 'layout');
}
