/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ActionRunner — resultDialog + target interpolation behaviour.
 *
 * Locks in the contract the metadata layer relies on:
 *   - `resultDialog` SUPPRESSES the success toast and awaits the registered
 *     ResultDialogHandler before resolving.
 *   - When no handler is registered, the action still succeeds (we don't
 *     want a missing UI dependency to roll back a server-side change).
 *   - `target` interpolation handles `${param.X}` and `${ctx.X}`, applies
 *     `encodeURIComponent`, and degrades missing keys to empty string.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActionRunner, type ActionDef } from '../ActionRunner';

describe('ActionRunner - resultDialog', () => {
  let runner: ActionRunner;
  let toast: ReturnType<typeof vi.fn>;
  let resultDialog: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    runner = new ActionRunner({});
    toast = vi.fn();
    resultDialog = vi.fn().mockResolvedValue(undefined);
    runner.setToastHandler(toast);
    runner.setResultDialogHandler(resultDialog);
  });

  it('invokes the result-dialog handler with the action data on success', async () => {
    runner.registerHandler('reveal', () => ({ success: true, data: { secret: 'abc' } }));
    const action: ActionDef = {
      type: 'reveal',
      successMessage: 'should-not-toast',
      resultDialog: {
        title: 'Save this',
        fields: [{ path: 'secret', format: 'secret' }],
      },
    };

    const result = await runner.execute(action);

    expect(result.success).toBe(true);
    expect(resultDialog).toHaveBeenCalledOnce();
    const [spec, data] = resultDialog.mock.calls[0];
    expect(spec.title).toBe('Save this');
    expect(data).toEqual({ secret: 'abc' });
    // The success toast is suppressed when resultDialog is set so the user
    // can't dismiss the reveal accidentally.
    expect(toast).not.toHaveBeenCalled();
  });

  it('still fires the success toast when resultDialog is absent', async () => {
    runner.registerHandler('plain', () => ({ success: true, data: { ok: true } }));
    await runner.execute({ type: 'plain', successMessage: 'done' });
    expect(toast).toHaveBeenCalledWith('done', expect.objectContaining({ type: 'success' }));
    expect(resultDialog).not.toHaveBeenCalled();
  });

  it('skips the result-dialog handler on failure', async () => {
    runner.registerHandler('fail', () => ({ success: false, error: 'nope' }));
    const result = await runner.execute({
      type: 'fail',
      resultDialog: { title: 'never' },
    });
    expect(result.success).toBe(false);
    expect(resultDialog).not.toHaveBeenCalled();
  });

  it('still succeeds when no resultDialog handler is registered', async () => {
    const noHandlerRunner = new ActionRunner({});
    noHandlerRunner.registerHandler('reveal', () => ({ success: true, data: { x: 1 } }));
    // Silence the expected console.warn for missing handler.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await noHandlerRunner.execute({
      type: 'reveal',
      resultDialog: { title: 'oops' },
    });
    expect(result.success).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('treats a rejected resultDialog handler as acknowledged', async () => {
    runner.registerHandler('reveal', () => ({ success: true, data: { x: 1 } }));
    resultDialog.mockRejectedValueOnce(new Error('user closed tab'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await runner.execute({
      type: 'reveal',
      resultDialog: { title: 't' },
    });
    expect(result.success).toBe(true);
    warn.mockRestore();
  });
});

describe('ActionRunner - target interpolation', () => {
  it('substitutes ${param.X} into url targets and URL-encodes the value', async () => {
    const navHandler = vi.fn();
    const runner = new ActionRunner({});
    runner.setNavigationHandler(navHandler);

    await runner.execute({
      type: 'url',
      target: '/api/v1/auth/sign-in/social?provider=${param.provider}&callbackURL=${ctx.origin}/done',
      params: { provider: 'google' },
    });

    expect(navHandler).toHaveBeenCalledOnce();
    const [url] = navHandler.mock.calls[0];
    // `${ctx.origin}` resolves to window.location.origin under happy-dom/node.
    // We don't assert its concrete value, but the provider must land URL-encoded
    // and the rest of the path must survive unchanged.
    expect(url).toContain('provider=google');
    expect(url).toContain('/api/v1/auth/sign-in/social');
    expect(url).toContain('/done');
  });

  it('URL-encodes values with reserved characters', async () => {
    const navHandler = vi.fn();
    const runner = new ActionRunner({});
    runner.setNavigationHandler(navHandler);

    await runner.execute({
      type: 'url',
      target: '/go?q=${param.q}',
      params: { q: 'a b+c/d' },
    });

    const [url] = navHandler.mock.calls[0];
    expect(url).toBe('/go?q=a%20b%2Bc%2Fd');
  });

  it('resolves missing tokens to empty string instead of throwing', async () => {
    const navHandler = vi.fn();
    const runner = new ActionRunner({});
    runner.setNavigationHandler(navHandler);

    await runner.execute({
      type: 'url',
      target: '/x?a=${param.missing}&b=${ctx.nope}',
      params: { other: 1 },
    });

    const [url] = navHandler.mock.calls[0];
    expect(url).toBe('/x?a=&b=');
  });

  it('exposes ctx.user.id from the action context', async () => {
    const navHandler = vi.fn();
    const runner = new ActionRunner({ user: { id: 'u_42' } });
    runner.setNavigationHandler(navHandler);

    await runner.execute({
      type: 'url',
      target: '/u/${ctx.user.id}',
    });

    expect(navHandler.mock.calls[0][0]).toBe('/u/u_42');
  });

  it('substitutes ${param.X} into api endpoints (fetch URL)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis as any, 'fetch')
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
        text: async () => '',
        blob: async () => new Blob(),
      } as any);

    const runner = new ActionRunner({});
    await runner.execute({
      type: 'api',
      target: '/api/echo/${param.id}',
      params: { id: 'abc-1' },
    });

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toBe('/api/echo/abc-1');
    fetchSpy.mockRestore();
  });
});
