/**
 * `PaymentProvider` — the interface `docs/ARCHITECTURE.md` §14 has named
 * since before any implementation existed ("PaymentProvider interface (no
 * impl in MVP)"). `Przelewy24Provider` (`przelewy24.ts`) is the first real
 * implementation — see that file's own header comment for why it's real
 * code that still can't be selected at checkout today.
 */

export type RegisterPaymentInput = {
  readonly orderNumber: string;
  /** Gross total, in grosze — never a float, same discipline as every other money value in this codebase (`domain/money/money.ts`). */
  readonly amountGrosze: number;
  readonly currency: 'PLN';
  readonly customerEmail: string;
  readonly description: string;
  /** Where the customer's browser is sent back after paying (success or cancel alike — the provider tells us which via its own status callback, not the redirect itself). */
  readonly returnUrl: string;
  /** Server-to-server confirmation endpoint — never trusted from the browser redirect alone (§15.3's own "never trust the client" discipline extends here: a customer could reload/skip the return URL). */
  readonly statusCallbackUrl: string;
};

export type RegisterPaymentResult =
  | { readonly ok: true; readonly redirectUrl: string; readonly providerToken: string }
  | { readonly ok: false; readonly reason: string };

export interface PaymentProvider {
  readonly name: string;
  /** True only when this provider has everything it needs (merchant credentials, API reachability assumptions) to actually attempt a real transaction — checked before ever calling `registerPayment`. */
  isConfigured(): boolean;
  registerPayment(input: RegisterPaymentInput): Promise<RegisterPaymentResult>;
}
