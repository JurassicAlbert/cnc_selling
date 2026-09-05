/**
 * Checking a bank account number before the shop starts telling customers to
 * pay into it - `docs/AI-CHECKLIST.md` UX-22.
 *
 * `StoreSettings.bankAccountNumber` is printed on every bank-transfer
 * confirmation page and in every confirmation email. A transposed digit there
 * sends real money somewhere else, and nothing about the wrong number looks
 * wrong: it is the right length, the right shape, and the person who typed it
 * will read it back as what they meant to type.
 *
 * UX-22 suggested a confirm dialog, reusing `CustomerAnonymizeForm`'s
 * pattern. That is the right control for a destructive action and the wrong
 * one here - pressing „na pewno?" does not catch a typo, because the person
 * confirming has the same wrong number in their head. What catches it is the
 * checksum below, plus re-typing the number
 * (`applyUpdateStoreSettings` compares the two).
 *
 * Pure and in `domain/` for the same reason `cart/quantity.ts` is: the rule
 * belongs to the business, the value arrives from a form, and the server and
 * the UI must apply exactly one version of it.
 */

export type BankAccountCheck = 'ok' | 'checksum-failed' | 'not-recognised' | 'empty';

/**
 * The digits alone, upper-cased, with every space removed.
 *
 * Used both for storage comparison and for matching the re-typed
 * confirmation against the number. Nobody groups digits the same way twice,
 * and refusing a match over a space would be infuriating rather than safe.
 */
export function normaliseBankAccountNumber(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

/**
 * The IBAN mod-97 rule (ISO 13616): move the first four characters to the
 * end, turn letters into numbers (A=10 ... Z=35), and the whole thing read as
 * one integer must be congruent to 1 modulo 97.
 *
 * Computed digit by digit rather than with `BigInt` because a 30-character
 * number does not fit a `Number`, and a running remainder is exact, cheap and
 * has no dependency.
 */
function mod97(digits: string): number {
  let remainder = 0;
  for (const character of digits) {
    remainder = (remainder * 10 + Number(character)) % 97;
  }
  return remainder;
}

/**
 * `ok` only for a number this function genuinely verified.
 *
 * `not-recognised` is deliberately distinct from `checksum-failed`, and the
 * distinction decides whether the shop refuses to save: a German IBAN is not
 * a Polish account and this shop is not required to refuse one, so "we cannot
 * verify this" must not be reported as "this is wrong". An unverifiable
 * number is still not an unguarded one - the re-typed confirmation applies to
 * every value.
 */
export function checkBankAccountNumber(value: string): BankAccountCheck {
  const normalised = normaliseBankAccountNumber(value);
  if (normalised.length === 0) {
    // Clearing the field genuinely un-configures the account, and
    // `OrderSummary` already has honest copy for that state.
    return 'empty';
  }

  const digits = normalised.startsWith('PL') ? normalised.slice(2) : normalised;
  if (digits.length !== 26 || !/^\d{26}$/.test(digits)) {
    return 'not-recognised';
  }

  // `PL` is 25 and 21. The two check digits move to the very end with it.
  const rearranged = `${digits.slice(2)}2521${digits.slice(0, 2)}`;
  return mod97(rearranged) === 1 ? 'ok' : 'checksum-failed';
}
