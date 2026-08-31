/**
 * `Mailer { send(template, to, data) }` — `docs/ARCHITECTURE.md`'s own §14
 * table entry, verbatim. A real interface, deliberately allowed to be
 * unconfigured: "if the mailer is unconfigured, the app logs and marks the
 * notification as not sent" (§14) — "the order still succeeds, and the UI
 * says the confirmation will follow — it does not claim an email was sent"
 * (§15.3).
 *
 * Restructured for P6 (2026-08-26): `send` used to take one hardcoded
 * template/data pair (`'order-confirmation'` only). Better Auth's
 * `emailOTP` plugin needs a second, differently-shaped template
 * (`'verification-otp'`), so `send` is now generic over `MailTemplate` and
 * `MailDataFor<T>` maps each template to its own data shape — a real
 * interface change, not just widening a literal type, so a caller passing
 * the wrong data shape for a given template is still a compile error.
 *
 * `ResendMailer` is the real implementation, used whenever `RESEND_API_KEY`
 * is set; `UnconfiguredMailer` (same safe-fallback behaviour as before)
 * otherwise. No SDK dependency — Resend's send endpoint is one small JSON
 * POST, not worth a package for.
 */

import { createHash } from 'node:crypto';

import { prisma } from '@/server/db/client';
import { logger } from '@/server/logging/logger';

export type MailTemplate = 'order-confirmation' | 'verification-otp' | 'order-status-update';

export type OrderConfirmationMailData = {
  readonly orderNumber: string;
  readonly totalGrossGrosze: number;
  readonly paymentMethod: 'BANK_TRANSFER' | 'CONTACT_ARRANGED';
};

/**
 * `statusPl` — the real customer-facing Polish label, `content/pl/
 * messages.ts`'s own `orderStatusMessage()`, not `content/pl/admin.ts`'s
 * staff-facing one. Deliberate: this text goes to a customer, and the two
 * copies are allowed to diverge (the admin one can afford to be terser/more
 * internal) — reusing the wrong one would silently couple customer-facing
 * wording to whatever staff-screen phrasing happens to exist.
 *
 * Deliberately no free-text note field: `applyOrderStatusTransition`'s
 * `notePl` is an internal staff/audit note (shown in the admin order-event
 * timeline), not vetted as customer-safe — forwarding it verbatim into a
 * real customer email risks leaking internal-only commentary. A genuine
 * customer-facing reason field, if wanted, needs its own explicit UI
 * distinct from the audit note, not a silent reuse of it.
 */
export type OrderStatusUpdateMailData = {
  readonly orderNumber: string;
  readonly statusPl: string;
};

export type VerificationOtpPurpose = 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';

export type VerificationOtpMailData = {
  readonly otp: string;
  readonly purpose: VerificationOtpPurpose;
};

export type MailDataFor<T extends MailTemplate> = T extends 'order-confirmation'
  ? OrderConfirmationMailData
  : T extends 'verification-otp'
    ? VerificationOtpMailData
    : T extends 'order-status-update'
      ? OrderStatusUpdateMailData
      : never;

export type MailSendResult = {
  readonly sent: boolean;
  /**
   * The fully resolved subject, after any DB template override.
   *
   * Returned rather than logged (`docs/REVIEW-DETAILED.md` SEC-02): the
   * tests need to assert what the real template renders, and reading that
   * off a log line is what put a login code into the application log in the
   * first place. A subject is safe to hand back — the body is not, and is
   * deliberately not returned.
   */
  readonly subject: string;
};

export interface Mailer {
  send<T extends MailTemplate>(template: T, to: string, data: MailDataFor<T>): Promise<MailSendResult>;
}

/**
 * A stable, non-reversible tag for a recipient, so two log lines can be
 * correlated as "the same person" during an incident without the log ever
 * holding an address. §16.1: "No PII in logs beyond user id."
 */
function recipientTag(to: string): string {
  return createHash('sha256').update(to.trim().toLowerCase()).digest('hex').slice(0, 12);
}

/**
 * The one deliberate escape hatch for local development, where reading the
 * OTP out of the dev server's own log is a genuinely useful workflow (and
 * one `logging/logger.ts`'s header still describes).
 *
 * Two locks, not one: the variable must be set explicitly **and** the build
 * must not be production. A single forgotten environment variable can then
 * never turn logging back on where it matters.
 */
function devSecretLoggingEnabled(): boolean {
  return process.env.MAIL_DEV_LOG_SECRETS === '1' && process.env.NODE_ENV !== 'production';
}

function formatGrossZloty(grosze: number): string {
  return `${(grosze / 100).toFixed(2).replace('.', ',')} zł`;
}

function paymentMethodPl(method: OrderConfirmationMailData['paymentMethod']): string {
  return method === 'BANK_TRANSFER' ? 'przelew bankowy' : 'ustalenie kontaktowe';
}

function otpPurposePl(purpose: VerificationOtpPurpose): string {
  switch (purpose) {
    case 'sign-in':
      return 'logowania';
    case 'email-verification':
      return 'potwierdzenia adresu e-mail';
    case 'forget-password':
      return 'resetu hasła';
    case 'change-email':
      return 'zmiany adresu e-mail';
  }
}

function renderSubjectAndText<T extends MailTemplate>(template: T, data: MailDataFor<T>): {
  subject: string;
  text: string;
} {
  if (template === 'order-confirmation') {
    const d = data as OrderConfirmationMailData;
    return {
      subject: `Potwierdzenie zamówienia ${d.orderNumber}`,
      text: `Dziękujemy za zamówienie ${d.orderNumber}.\n\nKwota do zapłaty: ${formatGrossZloty(d.totalGrossGrosze)}.\nSposób płatności: ${paymentMethodPl(d.paymentMethod)}.\n\nO dalszych krokach poinformujemy Cię osobnym e-mailem.`,
    };
  }
  if (template === 'order-status-update') {
    const d = data as OrderStatusUpdateMailData;
    return {
      subject: `Zamówienie ${d.orderNumber}: ${d.statusPl}`,
      text: `Status Twojego zamówienia ${d.orderNumber} zmienił się na: ${d.statusPl}.`,
    };
  }
  const d = data as VerificationOtpMailData;
  // The code is deliberately NOT in the subject (`docs/REVIEW-DETAILED.md`
  // SEC-02). A subject is what a phone shows on a locked screen, what a
  // mail client puts in a notification, and what every "preview" surface
  // renders — none of which should carry a credential. The body is the
  // only place it belongs.
  return {
    subject: `Kod ${otpPurposePl(d.purpose)} — RYT`,
    text: `Kod ${otpPurposePl(d.purpose)}: ${d.otp}\n\nKod jest ważny przez 5 minut. Jeśli to nie Ty prosiłeś/aś o ten kod, zignoruj tę wiadomość.`,
  };
}

/**
 * Placeholder values available to a DB-stored `EmailTemplate` override for
 * each template — deliberately only ever built from the same typed
 * `MailDataFor<T>` shape `renderSubjectAndText` already consumes, never
 * arbitrary object properties. The admin edit screen shows these key names
 * as a hint, sourced from `content/pl/admin.ts`'s own static copy of this
 * same set — kept in sync by hand, not derived.
 */
function buildPlaceholders<T extends MailTemplate>(template: T, data: MailDataFor<T>): Record<string, string> {
  if (template === 'order-confirmation') {
    const d = data as OrderConfirmationMailData;
    return { orderNumber: d.orderNumber, totalGrossZloty: formatGrossZloty(d.totalGrossGrosze), paymentMethodPl: paymentMethodPl(d.paymentMethod) };
  }
  if (template === 'order-status-update') {
    const d = data as OrderStatusUpdateMailData;
    return { orderNumber: d.orderNumber, statusPl: d.statusPl };
  }
  const d = data as VerificationOtpMailData;
  return { otp: d.otp, otpPurposePl: otpPurposePl(d.purpose) };
}

/** `{{key}}` substitution. An unmatched token is left as literal text — a safe no-op, not an error, since an admin typo shouldn't ever throw mid-send. */
function interpolate(text: string, placeholders: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => placeholders[key] ?? match);
}

/**
 * Looks up a DB-stored override for `template` before falling back to the
 * hardcoded default — the one place both `Mailer` implementations share
 * this logic, so it can't drift between them. A missing row (nothing
 * configured, or the DB is unreachable) is not an error: `renderSubjectAndText`
 * is always a safe, complete fallback.
 */
async function resolveSubjectAndText<T extends MailTemplate>(template: T, data: MailDataFor<T>): Promise<{ subject: string; text: string }> {
  try {
    const override = await prisma.emailTemplate.findUnique({ where: { key: template }, select: { subjectPl: true, bodyPl: true } });
    if (override !== null) {
      const placeholders = buildPlaceholders(template, data);
      return { subject: interpolate(override.subjectPl, placeholders), text: interpolate(override.bodyPl, placeholders) };
    }
  } catch (error) {
    logger.warn('mailer.template_lookup_failed', { template, error });
  }
  return renderSubjectAndText(template, data);
}

/**
 * Logs and reports "not sent" — never throws, never blocks whatever called
 * it. Order creation's own caller treats a failed/unsent email as a
 * non-fatal side effect (`docs/ARCHITECTURE.md` §15.3), and Better Auth's
 * `emailOTP` plugin has no fallback path of its own if `sendVerificationOTP`
 * throws, so this must stay non-throwing for that flow too.
 */
class UnconfiguredMailer implements Mailer {
  async send<T extends MailTemplate>(template: T, to: string, data: MailDataFor<T>): Promise<MailSendResult> {
    const { subject, text } = await resolveSubjectAndText(template, data);

    // Never the subject, never the body, never the address
    // (`docs/REVIEW-DETAILED.md` SEC-02). This used to log
    // `{ template, subject, to }`, and the OTP subject contained the code,
    // so every login code reached the application log in plaintext — with
    // no production guard, since this implementation is selected purely by
    // RESEND_API_KEY being unset. An admin can also put `{{otp}}` into a
    // DB-stored template, so the guarantee has to come from not logging
    // rendered text at all rather than from trusting the default copy.
    if (process.env.NODE_ENV === 'production') {
      // Loud, and once per send: a production shop silently not sending
      // order confirmations is its own incident, and the operator needs to
      // find out from the log rather than from a customer. Still does not
      // throw — §14/§15.3 are explicit that the order must succeed even
      // when the notification cannot be delivered.
      logger.error('mailer.not_configured', { template, recipient: recipientTag(to) });
      return { sent: false, subject };
    }

    if (devSecretLoggingEnabled()) {
      // Opt-in, development only, and clearly labelled. This is the
      // workflow `logging/logger.ts`'s header describes — reading an OTP
      // out of the dev server's own output — kept deliberately rather than
      // by accident.
      logger.warn('mailer.unconfigured_send_with_secrets', { template, to, subject, text });
      return { sent: false, subject };
    }

    logger.info('mailer.unconfigured_send', { template, recipient: recipientTag(to) });
    return { sent: false, subject };
  }
}

/**
 * Resend's HTTP API directly (https://resend.com/docs/api-reference/emails/send-email)
 * — a single JSON POST, so a full SDK dependency isn't worth adding. Errors
 * are caught and logged rather than thrown, matching `UnconfiguredMailer`'s
 * contract: a failed send is always reported as `{ sent: false }`, never an
 * exception the caller has to handle.
 */
class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send<T extends MailTemplate>(template: T, to: string, data: MailDataFor<T>): Promise<MailSendResult> {
    const { subject, text } = await resolveSubjectAndText(template, data);
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: this.from, to, subject, text }),
      });
      if (!response.ok) {
        logger.error('mailer.resend_send_failed', { template, recipient: recipientTag(to), status: response.status });
        return { sent: false, subject };
      }
      return { sent: true, subject };
    } catch (error) {
      logger.error('mailer.resend_send_threw', { template, recipient: recipientTag(to), error });
      return { sent: false, subject };
    }
  }
}

function createMailer(): Mailer {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (apiKey !== undefined && apiKey.length > 0 && from !== undefined && from.length > 0) {
    return new ResendMailer(apiKey, from);
  }
  return new UnconfiguredMailer();
}

export const mailer: Mailer = createMailer();
