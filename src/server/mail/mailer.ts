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

import { prisma } from '@/server/db/client';

export type MailTemplate = 'order-confirmation' | 'verification-otp';

export type OrderConfirmationMailData = {
  readonly orderNumber: string;
  readonly totalGrossGrosze: number;
  readonly paymentMethod: 'BANK_TRANSFER' | 'CONTACT_ARRANGED';
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
    : never;

export type MailSendResult = { readonly sent: boolean };

export interface Mailer {
  send<T extends MailTemplate>(template: T, to: string, data: MailDataFor<T>): Promise<MailSendResult>;
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
  const d = data as VerificationOtpMailData;
  return {
    subject: `Twój kod ${otpPurposePl(d.purpose)}: ${d.otp}`,
    text: `Kod ${otpPurposePl(d.purpose)}: ${d.otp}\n\nKod jest ważny przez 5 minut. Jeśli to nie Ty prosiłeś/aś o ten kod, zignoruj tę wiadomość.`,
  };
}

/**
 * Placeholder values available to a DB-stored `EmailTemplate` override for
 * each template — deliberately only ever built from the same typed
 * `MailDataFor<T>` shape `renderSubjectAndText` already consumes, never
 * arbitrary object properties. The admin edit screen shows these key names
 * as a hint, sourced from `content/pl/admin.ts`'s own static copy of this
 * same set — kept in sync by hand, not derived, since there are only two.
 */
function buildPlaceholders<T extends MailTemplate>(template: T, data: MailDataFor<T>): Record<string, string> {
  if (template === 'order-confirmation') {
    const d = data as OrderConfirmationMailData;
    return { orderNumber: d.orderNumber, totalGrossZloty: formatGrossZloty(d.totalGrossGrosze), paymentMethodPl: paymentMethodPl(d.paymentMethod) };
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
    console.error(`[mailer] EmailTemplate lookup failed for "${template}", using the hardcoded default:`, error);
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
    const { subject } = await resolveSubjectAndText(template, data);
    console.log(`[mailer] unconfigured — would have sent "${template}" (${subject}) to ${to}`);
    return { sent: false };
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
        console.error(`[mailer] Resend send failed (${response.status}) for "${template}" to ${to}`);
        return { sent: false };
      }
      return { sent: true };
    } catch (error) {
      console.error(`[mailer] Resend send threw for "${template}" to ${to}:`, error);
      return { sent: false };
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
