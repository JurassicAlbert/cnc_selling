import Link from 'next/link';

import { Heading } from '@/ui/primitives/Heading';
import { Text } from '@/ui/primitives/Text';

/**
 * The header of a page section: a heading, one line saying what the section
 * is, and - where there is somewhere to go - the link to the rest of it.
 *
 * **Owner feedback, 2026-09-11: "something seems missing in this layout - the
 * way the sections are presented".** Measured against the reference the owner
 * pointed at (`template.getbazaar.io`, its own landing page and the
 * `/furniture-2` shop): **every section there is a heading followed
 * immediately by a one-sentence subtitle**, without exception. Every one of
 * ours was a bare `<h2>` and then content - five sections, no lead-in on any
 * of them. That is the thing that was missing, and it is structural rather
 * than decorative: a heading alone says what a block is called, not what it
 * is for or why to look at it.
 *
 * **Left-aligned, where the reference centres.** That is a deliberate
 * departure, not an oversight: our sections carry asymmetric decorative
 * clusters down one side (`Section`'s `decorative` prop), and a centred
 * header fights that layout instead of sitting in it. The borrowed idea is
 * the lead, not the alignment.
 *
 * **The action link moves up here rather than being added.** The blog and FAQ
 * sections already had a „Zobacz wszystkie…" link at the bottom; it belongs
 * in the header with the heading it qualifies, and duplicating it would break
 * every `getByRole('link', { name })` in the suite on a strict-mode
 * violation. Sections with nowhere to send anyone - categories and products
 * are already the full list - simply pass no action.
 */
export function SectionIntro({
  id,
  headingPl,
  leadPl,
  action,
}: {
  /** Anchor target, for the sections a nav link or a skip link points at. */
  readonly id?: string;
  readonly headingPl: string;
  readonly leadPl?: string;
  readonly action?: { readonly href: string; readonly labelPl: string };
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        marginBlockEnd: 'var(--space-4)',
      }}
    >
      {/*
        The heading and its lead are one block, so the link cannot be pushed
        between them when the row wraps on a narrow screen.
      */}
      <div id={id} style={{ scrollMarginTop: 96, maxWidth: '52ch' }}>
        <Heading level={2}>{headingPl}</Heading>
        {leadPl !== undefined && (
          <div style={{ marginBlockStart: 'var(--space-2)' }}>
            <Text muted>{leadPl}</Text>
          </div>
        )}
      </div>

      {action !== undefined && (
        <Link
          href={action.href}
          className="section-intro-action"
          style={{ font: 'var(--mui-font-body2)', whiteSpace: 'nowrap' }}
        >
          {action.labelPl}
        </Link>
      )}
    </div>
  );
}
