import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uploadImage } from './upload';

// Stub localStorage
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('uploadImage', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage.clear();
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends a multipart FormData POST with the file', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://cdn.example.com/photo.png' }),
    });

    const blob = new Blob(['image-data'], { type: 'image/png' });
    const url = await uploadImage(blob);

    expect(url).toBe('https://cdn.example.com/photo.png');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [reqUrl, reqInit] = fetchSpy.mock.calls[0];
    expect(reqUrl).toContain('/upload');
    expect(reqInit.method).toBe('POST');
    expect(reqInit.body).toBeInstanceOf(FormData);

    const form = reqInit.body as FormData;
    expect(form.get('file')).toBeInstanceOf(Blob);
  });

  it('attaches the bearer token when present in localStorage', async () => {
    storage.set('sommsavvy_token', 'my-jwt-token');

    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://cdn.example.com/photo.png' }),
    });

    const blob = new Blob(['data'], { type: 'image/png' });
    await uploadImage(blob);

    const [, reqInit] = fetchSpy.mock.calls[0];
    expect(reqInit.headers['Authorization']).toBe('Bearer my-jwt-token');
  });

  it('does not attach an Authorization header when no token is stored', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://cdn.example.com/photo.png' }),
    });

    const blob = new Blob(['data'], { type: 'image/png' });
    await uploadImage(blob);

    const [, reqInit] = fetchSpy.mock.calls[0];
    expect(reqInit.headers['Authorization']).toBeUndefined();
  });

  it('throws a friendly error when the server returns non-ok', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'File too large.' } }),
    });

    const blob = new Blob(['data'], { type: 'image/png' });
    await expect(uploadImage(blob)).rejects.toThrow('File too large.');
  });

  it('throws a generic friendly error when the server error has no message', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const blob = new Blob(['data'], { type: 'image/png' });
    await expect(uploadImage(blob)).rejects.toThrow(
      'Something went wrong uploading the image. Please try again.',
    );
  });

  it('throws a network error with a friendly message', async () => {
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));

    const blob = new Blob(['data'], { type: 'image/png' });
    await expect(uploadImage(blob)).rejects.toThrow(
      'Unable to upload the image. Check your connection and try again.',
    );
  });

  it('throws if the response has no url field', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const blob = new Blob(['data'], { type: 'image/png' });
    await expect(uploadImage(blob)).rejects.toThrow(
      'The server did not return a valid image URL. Please try again.',
    );
  });
});
