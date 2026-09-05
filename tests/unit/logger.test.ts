import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '@/server/logging/logger';

afterEach(() => {
  vi.restoreAllMocks();
});

function lastLoggedLine(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const call = spy.mock.calls.at(-1);
  if (call === undefined) {
    throw new Error('logger was never called');
  }
  return JSON.parse(String(call[0]));
}

describe('logger - one JSON object per line, real fields a log query can filter on', () => {
  it('info() writes to console.log with level/event/timestamp plus the context fields, flat', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    logger.info('mailer.unconfigured_send', { template: 'order-confirmation', to: 'test@example.test' });

    const entry = lastLoggedLine(spy);
    expect(entry.level).toBe('info');
    expect(entry.event).toBe('mailer.unconfigured_send');
    expect(entry.template).toBe('order-confirmation');
    expect(entry.to).toBe('test@example.test');
    expect(typeof entry.timestamp).toBe('string');
    expect(new Date(String(entry.timestamp)).toString()).not.toBe('Invalid Date');
  });

  it('warn() writes to console.warn, not console.log or console.error', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logger.warn('mailer.template_lookup_failed', { template: 'order-confirmation' });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(lastLoggedLine(warnSpy).level).toBe('warn');
  });

  it('error() writes to console.error and expands a nested Error into name/message/stack, not {}', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const boom = new Error('boom');

    logger.error('mailer.resend_send_threw', { template: 'order-confirmation', error: boom });

    const entry = lastLoggedLine(spy);
    expect(entry.level).toBe('error');
    const loggedError = entry.error as Record<string, unknown>;
    expect(loggedError.message).toBe('boom');
    expect(typeof loggedError.stack).toBe('string');
  });

  it('omits the context spread entirely when no context is passed, rather than logging undefined fields', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    logger.info('some.event');

    const entry = lastLoggedLine(spy);
    expect(Object.keys(entry).sort()).toEqual(['event', 'level', 'timestamp']);
  });
});
