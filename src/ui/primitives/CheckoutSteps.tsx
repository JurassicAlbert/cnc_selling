import Link from 'next/link';
import type { ReactNode } from 'react';

import { Container } from '@/ui/primitives/Container';
import { SITE } from '@/content/pl/site';
import type { CheckoutStepCode } from '@/ui/primitives/checkout-steps';
import { resolveCheckoutSteps } from '@/ui/primitives/checkout-steps';

/**
 * The rail across the top of the checkout flow - owner request 2026-09-04:
 * "nie ma u nas pod paskiem wyszukiwania - nad zakupami menu przejścia
 * między etapami płatności".
 *
 * A Server Component with no client JS, like the rest of the storefront
 * chrome. `checkout-steps.ts` holds the rule and is unit-tested; this file
 * only draws it.
 *
 * The state is announced, not only drawn. A completed step reads „Koszyk
 * (ukończony)" to a screen reader, and the current one carries
 * `aria-current="step"` - a rail whose only signal is a colour tells a
 * customer using assistive technology nothing at all about where they are.
 */
export function CheckoutSteps({ current }: { readonly current: CheckoutStepCode }) {
  const steps = resolveCheckoutSteps(current);

  return (
    <div className="checkout-steps">
      <Container>
        <ol className="checkout-steps-track" aria-label={SITE.checkoutStepsLabelPl}>
          {steps.map((step) => {
            const label = (
              <>
                <span className="checkout-step-number" aria-hidden="true">
                  {step.number}
                </span>
                <span className="checkout-step-label">{step.labelPl}</span>
                {step.state !== 'upcoming' && (
                  <span className="checkout-step-state">
                    {step.state === 'done' ? SITE.checkoutStepDonePl : SITE.checkoutStepCurrentPl}
                  </span>
                )}
              </>
            );

            return (
              <li key={step.code} className={`checkout-step checkout-step--${step.state}`}>
                <StepBody href={step.href} isCurrent={step.state === 'current'}>
                  {label}
                </StepBody>
              </li>
            );
          })}
        </ol>
      </Container>
    </div>
  );
}

/**
 * A link when the step is somewhere the customer can genuinely go back to, a
 * plain `<span>` otherwise. Not a disabled link: there is no such thing in
 * HTML, and an `<a>` without an `href` is not focusable, which is exactly
 * the right behaviour for a step that is not a destination.
 */
function StepBody({
  href,
  isCurrent,
  children,
}: {
  readonly href: string | null;
  readonly isCurrent: boolean;
  readonly children: ReactNode;
}) {
  if (href === null) {
    return (
      <span className="checkout-step-body" aria-current={isCurrent ? 'step' : undefined}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className="checkout-step-body checkout-step-body--link">
      {children}
    </Link>
  );
}
