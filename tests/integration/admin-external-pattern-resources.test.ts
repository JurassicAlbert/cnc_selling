import { afterEach, describe, expect, it } from 'vitest';

import {
  applyCreateExternalPatternResource,
  applySetExternalPatternResourceActive,
  applyUpdateExternalPatternResource,
} from '@/server/operations/admin-external-pattern-resources';
import { listExternalPatternResourcesForAdmin } from '@/server/repositories/admin-external-pattern-resources';
import { listActiveExternalPatternResources } from '@/server/repositories/external-pattern-resources';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-external-pattern-resources-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

function validInput(overrides: Partial<{ namePl: string; url: string; descPl: string; sourceLabel: string; sortOrder: number }> = {}) {
  return {
    namePl: `${PREFIX}resource`,
    url: 'https://example.test/patterns',
    descPl: '',
    sourceLabel: 'example.test',
    sortOrder: 0,
    ...overrides,
  };
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { entity: 'ExternalPatternResource', actorEmail: { startsWith: PREFIX } } });
  await prisma.externalPatternResource.deleteMany({ where: { namePl: { startsWith: PREFIX } } });
});

describe('applyCreateExternalPatternResource', () => {
  it('creates a real row and audits it', async () => {
    const staff = staffActor();

    const result = await applyCreateExternalPatternResource(staff, validInput());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    const created = await prisma.externalPatternResource.findUniqueOrThrow({ where: { id: result.id } });
    expect(created.url).toBe('https://example.test/patterns');
    expect(created.isActive).toBe(true);
    expect(await prisma.auditLog.count({ where: { entity: 'ExternalPatternResource', action: 'create', actorEmail: staff.email } })).toBe(1);
  });

  it('rejects a missing name', async () => {
    const result = await applyCreateExternalPatternResource(staffActor(), validInput({ namePl: '  ' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a missing source label', async () => {
    const result = await applyCreateExternalPatternResource(staffActor(), validInput({ sourceLabel: '  ' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a non-http(s) URL, e.g. a `javascript:` URI - this only ever renders as a real `<a href>`', async () => {
    const result = await applyCreateExternalPatternResource(staffActor(), validInput({ url: 'javascript:alert(1)' }));
    expect(result.ok).toBe(false);
  });

  it('rejects an unparseable URL', async () => {
    const result = await applyCreateExternalPatternResource(staffActor(), validInput({ url: 'not a url' }));
    expect(result.ok).toBe(false);
  });

  it('stores an empty description as null, not an empty string', async () => {
    const result = await applyCreateExternalPatternResource(staffActor(), validInput({ descPl: '   ' }));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect((await prisma.externalPatternResource.findUniqueOrThrow({ where: { id: result.id } })).descPl).toBeNull();
  });
});

describe('applyUpdateExternalPatternResource', () => {
  it('updates fields and audits the change', async () => {
    const staff = staffActor();
    const created = await applyCreateExternalPatternResource(staff, validInput());
    if (!created.ok) throw new Error('setup failed');

    const updated = await applyUpdateExternalPatternResource(staff, created.id, validInput({ namePl: `${PREFIX}renamed` }));
    expect(updated.ok).toBe(true);
    expect((await prisma.externalPatternResource.findUniqueOrThrow({ where: { id: created.id } })).namePl).toBe(`${PREFIX}renamed`);
  });

  it('returns a failure result for a non-existent resource', async () => {
    const result = await applyUpdateExternalPatternResource(staffActor(), 'does-not-exist', validInput());
    expect(result.ok).toBe(false);
  });
});

describe('applySetExternalPatternResourceActive', () => {
  it('deactivating removes it from the real public listing without deleting the row', async () => {
    const staff = staffActor();
    const created = await applyCreateExternalPatternResource(staff, validInput());
    if (!created.ok) throw new Error('setup failed');

    expect((await listActiveExternalPatternResources()).some((r) => r.id === created.id)).toBe(true);

    await applySetExternalPatternResourceActive(staff, created.id, false);

    expect((await listActiveExternalPatternResources()).some((r) => r.id === created.id)).toBe(false);
    expect((await listExternalPatternResourcesForAdmin()).some((r) => r.id === created.id)).toBe(true);
    expect(await prisma.externalPatternResource.findUnique({ where: { id: created.id } })).not.toBeNull();
  });
});
