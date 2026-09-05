/**
 * `docs/REVIEW-DETAILED.md` UX-21 - the last visible edge of SEC-03.
 *
 * SEC-03 made the write path refuse a configuration naming something the shop
 * no longer offers. It did not stop the configurator *pricing* that
 * configuration first, so a customer arriving on a stale link, or holding a
 * saved project after staff retired a pattern, still saw a real price for
 * something they could not buy. That is the same "showing a price you will
 * not honour" shape BUG-02 existed to remove.
 *
 * `findUnavailableSelection` is the shared decision. It takes a
 * `ResolvedOptions` - what §7.2 says is selectable right now - so the server
 * can call it after `resolveOptions` and the client can call it against the
 * snapshot it already has. One definition, used by both, is the only version
 * that cannot drift; re-implementing the rule in the browser is how the
 * picker and the gate came apart in the first place.
 */

import { describe, expect, it } from 'vitest';

import { EMPTY_SELECTIONS } from '@/domain/configuration/steps';
import type { Selections } from '@/domain/configuration/steps';
import { findUnavailableSelection } from '@/server/configurator/resolve-options';
import type { ResolvedOptions } from '@/server/configurator/resolve-options';

const OFFERED: ResolvedOptions = {
  materialIds: ['oak', 'pine'],
  designIds: ['olive', 'compass'],
  finishIds: ['oil'],
  thicknessesMm: [18, 27],
  installVariantCodes: ['FULL_WALL'],
  fontIds: ['inter'],
};

function selections(overrides: Partial<Selections>): Selections {
  return { ...EMPTY_SELECTIONS, ...overrides };
}

describe('findUnavailableSelection', () => {
  it('accepts a selection made entirely from what is offered', () => {
    const chosen = selections({
      materialId: 'oak',
      designId: 'olive',
      finishId: 'oil',
      thicknessMm: 18,
      installationVariant: 'FULL_WALL',
      fontId: 'inter',
      widthMm: 400,
      heightMm: 400,
    });

    expect(findUnavailableSelection(OFFERED, chosen)).toBeNull();
  });

  it('accepts the empty selection set', () => {
    // Nothing chosen is not the same as something unavailable. Whether a
    // field is *required* is `checkConfigurationComplete`'s job.
    expect(findUnavailableSelection(OFFERED, EMPTY_SELECTIONS)).toBeNull();
  });

  it.each([
    ['designId', { designId: 'retired-pattern' }],
    ['materialId', { materialId: 'walnut' }],
    ['finishId', { finishId: 'lacquer' }],
    ['thicknessMm', { thicknessMm: 40 }],
    ['installationVariant', { installationVariant: 'SPLASHBACK' }],
    ['fontId', { fontId: 'comic' }],
  ] as const)('reports %s when it is not in the offered set', (field, override) => {
    expect(findUnavailableSelection(OFFERED, selections(override))).toBe(field);
  });

  it('reports the design before anything else, because that is what a stale link usually carries', () => {
    // Order is not arbitrary: a retired pattern is overwhelmingly the reason
    // a saved project stops being orderable, so naming it first gives the
    // customer the sentence they can act on.
    const chosen = selections({ designId: 'retired-pattern', materialId: 'walnut' });
    expect(findUnavailableSelection(OFFERED, chosen)).toBe('designId');
  });

  it('reports an unavailable selection even when the option list is empty', () => {
    // A product whose only material has no finishes offers an empty
    // `finishIds`, and a link carrying a finish for it must still be refused.
    const nothingOffered: ResolvedOptions = {
      materialIds: [],
      designIds: [],
      finishIds: [],
      thicknessesMm: [],
      installVariantCodes: [],
      fontIds: [],
    };
    expect(findUnavailableSelection(nothingOffered, selections({ finishId: 'oil' }))).toBe('finishId');
  });

  it('ignores size and the custom upload, which no option list constrains', () => {
    // `widthMm`/`heightMm` are bounded by the dimension envelope and
    // `customUploadId` by ownership, neither of which is a `ResolvedOptions`
    // question. Reporting them here would produce a message naming the wrong
    // thing.
    const chosen = selections({ widthMm: 999_999, heightMm: 1, customUploadId: 'someone-elses' });
    expect(findUnavailableSelection(OFFERED, chosen)).toBeNull();
  });
});
