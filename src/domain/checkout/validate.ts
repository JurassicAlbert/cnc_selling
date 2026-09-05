/**
 * Checkout field validation - NIP checksum, postal code, phone.
 *
 * Real Polish algorithms, not format guesses. A NIP that merely "looks like
 * ten digits" is not a NIP - the checksum is what makes it one, and a wrong
 * one on an invoice is a real compliance problem, not a cosmetic one.
 */

const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7] as const;

/**
 * Polish NIP (tax identification number) checksum - ten digits, no dashes.
 * `sum % 11` over the first nine digits, weighted, must equal the tenth
 * digit; `sum % 11 === 10` is defined as invalid, not wrapped to 0.
 */
export function validateNip(nip: string): boolean {
  if (!/^\d{10}$/.test(nip)) {
    return false;
  }
  const digits = nip.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < NIP_WEIGHTS.length; i++) {
    sum += (digits[i] as number) * (NIP_WEIGHTS[i] as number);
  }
  const control = sum % 11;
  if (control === 10) {
    return false;
  }
  return control === digits[9];
}

/** Polish postal code, `NN-NNN`. */
export function validatePostalCode(code: string): boolean {
  return /^\d{2}-\d{3}$/.test(code);
}

/**
 * Lenient on purpose - `Order.phone` is required (2026-08-29 owner
 * request), but Polish phone numbers appear in many written forms
 * (with/without `+48`, spaces, dashes). This rejects obvious garbage, not
 * anything that isn't the one canonical format; emptiness itself is
 * checked separately by the caller, not here.
 */
export function validatePhone(phone: string): boolean {
  const digitsOnly = phone.replace(/[\s-]/g, '');
  return /^\+?\d{9,15}$/.test(digitsOnly);
}
