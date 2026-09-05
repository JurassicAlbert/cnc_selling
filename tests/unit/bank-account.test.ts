/**
 * `docs/AI-CHECKLIST.md` UX-22 - `StoreSettings.bankAccountNumber` was a
 * plain text field that saved with the rest of the form.
 *
 * It is the account number every bank-transfer customer is told to pay into,
 * printed on the confirmation page and in the confirmation email. A
 * transposed digit there sends real money somewhere else, and nothing about
 * the wrong number looks wrong.
 *
 * The item suggested a confirm dialog, reusing `CustomerAnonymizeForm`'s
 * pattern. A dialog is the right control for a destructive action and the
 * wrong one here: pressing „na pewno?" does not catch a typo, because the
 * person confirming has the same wrong number in their head. Two things do:
 *
 *  1. **the checksum**, which rejects a mistyped Polish account
 *     deterministically - that is what the two leading digits are for;
 *  2. **re-typing it**, which catches the rest, because you would have to
 *     make the same mistake twice.
 *
 * This is the first. Pure, so it can be tested exhaustively without a
 * database, and shared so the server and the form apply one rule.
 */

import { describe, expect, it } from 'vitest';

import { checkBankAccountNumber, normaliseBankAccountNumber } from '@/domain/banking/account-number';

describe('checkBankAccountNumber', () => {
  it('accepts a real Polish account number, written the way a bank prints it', () => {
    expect(checkBankAccountNumber('PL61 1090 1014 0000 0712 1981 2874')).toBe('ok');
  });

  it('accepts the same number without the country prefix', () => {
    // Polish banks print the 26 digits alone at least as often as with PL.
    expect(checkBankAccountNumber('61 1090 1014 0000 0712 1981 2874')).toBe('ok');
  });

  it('rejects a single mistyped digit', () => {
    // The realistic failure, and the whole reason the check digits exist.
    expect(checkBankAccountNumber('PL61 1090 1014 0000 0712 1981 2875')).toBe('checksum-failed');
  });

  it('rejects two transposed digits', () => {
    // The other realistic failure: ...2874 typed as ...2847.
    expect(checkBankAccountNumber('PL61 1090 1014 0000 0712 1981 2847')).toBe('checksum-failed');
  });

  it('rejects a Polish-looking number of the wrong length', () => {
    expect(checkBankAccountNumber('61 1090 1014 0000 0712 1981 287')).toBe('not-recognised');
  });

  it('does not reject an account it cannot check', () => {
    /*
      A German IBAN is not a Polish one, and this shop is not required to
      refuse a foreign account. Returning `not-recognised` rather than
      `checksum-failed` is the difference between "we cannot verify this" and
      "this is wrong", and only the second is grounds for refusing to save.

      The re-typed confirmation still applies to it, so an unverifiable
      number is not an unguarded one.
    */
    expect(checkBankAccountNumber('DE89 3704 0044 0532 0130 00')).toBe('not-recognised');
  });

  it('treats blank as nothing to check', () => {
    // Clearing the field is legitimate - it un-configures the account, and
    // `OrderSummary` already has honest copy for that state.
    expect(checkBankAccountNumber('')).toBe('empty');
    expect(checkBankAccountNumber('   ')).toBe('empty');
  });
});

describe('normaliseBankAccountNumber', () => {
  it('ignores the spacing a person happens to use', () => {
    // Comparing the typed confirmation against the typed number has to
    // compare the numbers, not the formatting: nobody groups digits the same
    // way twice, and rejecting a match over a space would be infuriating.
    expect(normaliseBankAccountNumber('PL61 1090 1014 0000 0712 1981 2874')).toBe(
      normaliseBankAccountNumber('PL6110901014000007121981 2874'),
    );
  });

  it('ignores case in the country prefix', () => {
    expect(normaliseBankAccountNumber('pl61109010140000071219812874')).toBe(
      normaliseBankAccountNumber('PL61109010140000071219812874'),
    );
  });

  it('does not treat a different number as the same', () => {
    expect(normaliseBankAccountNumber('PL61 1090 1014 0000 0712 1981 2874')).not.toBe(
      normaliseBankAccountNumber('PL61 1090 1014 0000 0712 1981 2875'),
    );
  });
});
