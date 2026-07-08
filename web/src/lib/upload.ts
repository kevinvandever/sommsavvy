// Upload client — replaces platform.uploadFile with a direct multipart POST
// to the self-hosted backend's /upload endpoint.

const BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8788').replace(/\/$/, '');
const TOKEN_KEY = 'sommsavvy_token';

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Uploads an image file to the server and returns its public URL.
 *
 * Sends a multipart FormData POST to /upload with the bearer token attached
 * when available. Throws a user-friendly error on failure so the caller can
 * retain the captured preview and offer retry.
 */
export async function uploadImage(file: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', file);

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}/upload`, {
      method: 'POST',
      headers,
      body: form,
    });
  } catch {
    throw new Error('Unable to upload the image. Check your connection and try again.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    const message = body?.error?.message ?? 'Something went wrong uploading the image. Please try again.';
    throw new Error(message);
  }

  const data = (await res.json()) as { url: string };
  if (!data.url) {
    throw new Error('The server did not return a valid image URL. Please try again.');
  }

  return data.url;
}
