export async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(key),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
export function generateKey(): string {
  return (
    'bh_' +
    Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('')
  );
}
