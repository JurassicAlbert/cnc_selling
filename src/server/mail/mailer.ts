/**
 * `Mailer { send(template, to, data) }` — `docs/ARCHITECTURE.md`'s own §14
 * table entry, verbatim. A real interface, deliberately allowed to be
 * unconfigured: "if the mailer is unconfigured, the app logs and marks the
 * notification as not sent" (§14) — "the order still succeeds, and the UI
 * says the confirmation will follow — it does not claim an email was sent"
 * (§15.3). No SMTP/Resend credentials exist yet, so `UnconfiguredMailer` is
 * the only implementation wired up right now; a real one is a drop-in
 * replacement behind the same interface whenever those credentials exist,
 * nothing else about order creation changes.
 */

export type MailTemplate = 'order-confirmation';

export type OrderConfirmationMailData = {
  readonly orderNumber: string;
  readonly totalGrossGrosze: number;
  readonly paymentMethod: 'BANK_TRANSFER' | 'CONTACT_ARRANGED';
};

export type MailSendResult = { readonly sent: boolean };

export interface Mailer {
  send(template: MailTemplate, to: string, data: OrderConfirmationMailData): Promise<MailSendResult>;
}

/**
 * Logs and reports "not sent" — never throws, never blocks whatever called
 * it. Order creation's own caller treats a failed/unsent email as a
 * non-fatal side effect (`docs/ARCHITECTURE.md` §15.3), so this type never
 * needs to surface an error, only an honest boolean.
 */
class UnconfiguredMailer implements Mailer {
  async send(template: MailTemplate, to: string, data: OrderConfirmationMailData): Promise<MailSendResult> {
    console.log(
      `[mailer] unconfigured — would have sent "${template}" to ${to} (order ${data.orderNumber})`,
    );
    return { sent: false };
  }
}

export const mailer: Mailer = new UnconfiguredMailer();
