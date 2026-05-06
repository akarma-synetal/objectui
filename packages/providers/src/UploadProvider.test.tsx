import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UploadProvider,
  useUpload,
  createObjectUrlAdapter,
  createS3Adapter,
  createAzureBlobAdapter,
  type UploadAdapter,
} from './UploadProvider';

function HookProbe({ onReady }: { onReady: (api: ReturnType<typeof useUpload>) => void }) {
  const api = useUpload();
  React.useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return null;
}

beforeEach(() => {
  // jsdom does not provide URL.createObjectURL by default.
  if (!('createObjectURL' in URL)) {
    (URL as any).createObjectURL = vi.fn(() => 'blob:mock');
  } else {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
  }
});

describe('UploadProvider', () => {
  it('falls back to object-url adapter when no provider is mounted', async () => {
    let api: ReturnType<typeof useUpload> | undefined;
    render(<HookProbe onReady={(v) => { api = v; }} />);
    expect(api?.adapter.name).toBe('object-url');
    const file = new File(['hi'], 'a.txt', { type: 'text/plain' });
    const result = await api!.upload(file);
    expect(result.url).toBe('blob:mock');
    expect(result.name).toBe('a.txt');
    expect(result.size).toBe(2);
  });

  it('uses the injected adapter', async () => {
    const adapter: UploadAdapter = {
      name: 'mock',
      upload: vi.fn(async (file) => ({
        url: 'https://cdn/test.png',
        name: 'test.png',
        size: file.size,
        mimeType: 'image/png',
      })),
    };
    let api: ReturnType<typeof useUpload> | undefined;
    render(
      <UploadProvider adapter={adapter}>
        <HookProbe onReady={(v) => { api = v; }} />
      </UploadProvider>,
    );
    expect(api?.adapter.name).toBe('mock');
    const file = new File(['x'], 'test.png', { type: 'image/png' });
    const res = await api!.upload(file);
    expect(adapter.upload).toHaveBeenCalledWith(file, undefined);
    expect(res.url).toBe('https://cdn/test.png');
  });
});

describe('createObjectUrlAdapter', () => {
  it('returns a blob URL with file metadata', async () => {
    const a = createObjectUrlAdapter();
    const file = new File(['data'], 'pic.jpg', { type: 'image/jpeg' });
    const r = await a.upload(file);
    expect(r.url).toBe('blob:mock');
    expect(r.mimeType).toBe('image/jpeg');
    expect(r.name).toBe('pic.jpg');
  });
});

describe('createS3Adapter', () => {
  it('presigns then PUTs the file and returns the public URL', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
    const getPresignedUrl = vi.fn(async () => ({
      uploadUrl: 'https://bucket.s3/upload?sig=abc',
      publicUrl: 'https://cdn.example.com/avatars/x.png',
      headers: { 'x-amz-acl': 'public-read' },
    }));
    const adapter = createS3Adapter({ getPresignedUrl, fetchImpl });
    const file = new File(['data'], 'x.png', { type: 'image/png' });
    const result = await adapter.upload(file, { path: 'avatars/' });
    expect(getPresignedUrl).toHaveBeenCalledWith({
      name: 'x.png',
      type: 'image/png',
      size: 4,
      path: 'avatars/',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://bucket.s3/upload?sig=abc',
      expect.objectContaining({
        method: 'PUT',
        body: file,
        headers: { 'x-amz-acl': 'public-read' },
      }),
    );
    expect(result.url).toBe('https://cdn.example.com/avatars/x.png');
  });

  it('retries failed uploads with exponential backoff', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error('boom');
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;
    const adapter = createS3Adapter({
      getPresignedUrl: async () => ({ uploadUrl: 'u', publicUrl: 'p' }),
      fetchImpl,
    });
    await adapter.upload(new File(['x'], 'x.png', { type: 'image/png' }), {
      maxRetries: 5,
      retryDelayMs: 1,
    });
    expect(calls).toBe(3);
  });

  it('aborts when the signal fires', async () => {
    const fetchImpl = vi.fn(
      async (_url: any, init: any) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    ) as unknown as typeof fetch;
    const adapter = createS3Adapter({
      getPresignedUrl: async () => ({ uploadUrl: 'u', publicUrl: 'p' }),
      fetchImpl,
    });
    const ctrl = new AbortController();
    const p = adapter.upload(new File(['x'], 'x.png'), { signal: ctrl.signal, maxRetries: 0 });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('createAzureBlobAdapter', () => {
  it('PUTs with x-ms-blob-type=BlockBlob', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 })) as unknown as typeof fetch;
    const adapter = createAzureBlobAdapter({
      getSasUrl: async () => ({
        uploadUrl: 'https://acc.blob.core.windows.net/c/x.png?sv=...',
        publicUrl: 'https://acc.blob.core.windows.net/c/x.png',
      }),
      fetchImpl,
    });
    const file = new File(['data'], 'x.png', { type: 'image/png' });
    const r = await adapter.upload(file);
    const callArgs = (fetchImpl as any).mock.calls[0][1];
    expect(callArgs.method).toBe('PUT');
    expect(callArgs.headers['x-ms-blob-type']).toBe('BlockBlob');
    expect(r.url).toBe('https://acc.blob.core.windows.net/c/x.png');
  });
});
