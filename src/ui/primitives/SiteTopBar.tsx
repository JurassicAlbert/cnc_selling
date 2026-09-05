import { DrawIcon, FacebookIcon, InstagramIcon, TikTokIcon, YouTubeIcon } from '@/ui/icons';
import { Container } from '@/ui/primitives/Container';
import { SITE } from '@/content/pl/site';

type SocialProfiles = {
  readonly facebookUrl: string | null;
  readonly instagramUrl: string | null;
  readonly tiktokUrl: string | null;
  readonly youtubeUrl: string | null;
};

/**
 * The slim strip above the main navigation - UX-23, owner request
 * 2026-09-04, arrangement taken from `template.getbazaar.io`.
 *
 * **What belongs in it, corrected 2026-09-04:** "navbar nad navbarem dotyczy
 * mediów fb insta itd nie podstron". It first carried links to our own FAQ
 * and contact pages, which is what the main navigation and the footer are
 * for. It carries the shop's social profiles instead.
 *
 * Which meant the profiles had to become real data. A hard-coded
 * `facebook.com/...` would be a guess about an account that may not exist,
 * and a social icon linking nowhere is worse than no icon - so they are
 * `StoreSettings` fields the owner fills in at `/panel/ustawienia`, and this
 * renders **only what is actually configured**. With none set, the strip is
 * the note alone.
 *
 * What it does **not** carry is a promotional claim. The reference puts a
 * shipping offer here; this shop has none - no carrier is integrated and
 * shipping is a flat rate the owner sets - so a strip on every page
 * announcing one would be the fake-functionality rule broken in the most
 * visible place available. The note is one sentence that is already true and
 * already said elsewhere on the site.
 *
 * A Server Component with no client JS, like every other piece of storefront
 * chrome.
 */
export function SiteTopBar({ social }: { readonly social: SocialProfiles }) {
  type Profile = { readonly url: string; readonly Icon: typeof FacebookIcon; readonly namePl: string };

  const configured: readonly (Profile | null)[] = [
    social.facebookUrl === null ? null : { url: social.facebookUrl, Icon: FacebookIcon, namePl: SITE.socialFacebookPl },
    social.instagramUrl === null ? null : { url: social.instagramUrl, Icon: InstagramIcon, namePl: SITE.socialInstagramPl },
    social.tiktokUrl === null ? null : { url: social.tiktokUrl, Icon: TikTokIcon, namePl: SITE.socialTiktokPl },
    social.youtubeUrl === null ? null : { url: social.youtubeUrl, Icon: YouTubeIcon, namePl: SITE.socialYoutubePl },
  ];
  const profiles = configured.filter((profile): profile is Profile => profile !== null);

  return (
    <div className={profiles.length === 0 ? 'site-topbar site-topbar--note-only' : 'site-topbar'}>
      <Container>
        <div className="site-topbar-row">
          <span className="site-topbar-note">
            <DrawIcon size={16} />
            {SITE.topbarNotePl}
          </span>

          {profiles.length > 0 && (
            <nav className="site-topbar-links" aria-label={SITE.socialNavLabelPl}>
              {profiles.map(({ url, Icon, namePl }) => (
                <a
                  key={namePl}
                  href={url}
                  className="site-topbar-link"
                  /*
                    These leave our site. `noopener` is the one that matters -
                    without it the opened page gets a handle on ours through
                    `window.opener` - and `nofollow` because the shop's own
                    profile links are not an editorial endorsement worth
                    passing rank to.
                  */
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  // The icon is `aria-hidden`, so without this the link has
                  // no accessible name at all.
                  aria-label={namePl}
                  title={namePl}
                >
                  <Icon size={16} />
                </a>
              ))}
            </nav>
          )}
        </div>
      </Container>
    </div>
  );
}
