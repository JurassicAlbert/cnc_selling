import { AccountBalanceIcon, DrawIcon, EngineeringIcon, MailIcon } from '@/ui/icons';
import { SITE } from '@/content/pl/site';

const BADGES = [
  { Icon: EngineeringIcon, titlePl: SITE.trustMadeToOrderTitlePl, descPl: SITE.trustMadeToOrderDescPl },
  { Icon: DrawIcon, titlePl: SITE.trustEngravingTitlePl, descPl: SITE.trustEngravingDescPl },
  { Icon: AccountBalanceIcon, titlePl: SITE.trustPaymentTitlePl, descPl: SITE.trustPaymentDescPl },
  { Icon: MailIcon, titlePl: SITE.trustContactTitlePl, descPl: SITE.trustContactDescPl },
] as const;

/**
 * Four real, verifiable claims about how this business actually operates —
 * not the generic "free shipping / money-back guarantee" badges the
 * reference templates use, which nothing confirms are true here yet.
 */
export function TrustBadgeStrip() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 24,
      }}
    >
      {BADGES.map(({ Icon, titlePl, descPl }) => (
        <div key={titlePl} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon size={32} style={{ color: 'var(--mui-palette-secondary-main)' }} />
          <div>
            <div style={{ font: 'var(--mui-font-subtitle2)', color: 'var(--mui-palette-text-primary)' }}>
              {titlePl}
            </div>
            <div style={{ font: 'var(--mui-font-caption)', color: 'var(--mui-palette-text-secondary)' }}>
              {descPl}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
