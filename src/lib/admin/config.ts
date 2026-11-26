export function readAuthConfig(env: Readonly<Record<string, string | undefined>>) {
  const { AUTH_URL, AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET } = env;
  if (!AUTH_URL || !AUTH_SECRET || AUTH_SECRET.trim().length < 32 ||
      !AUTH_GITHUB_ID?.trim() || !AUTH_GITHUB_SECRET?.trim()) return null;
  try {
    const url = new URL(AUTH_URL);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
        // Next.js normalizes loopback IP URLs to localhost, which changes OAuth's callback origin.
        url.hostname.startsWith("127.") || url.hostname === "[::1]" ||
        !(url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "localhost"))) {
      return null;
    }
    return { secret: AUTH_SECRET, clientId: AUTH_GITHUB_ID, clientSecret: AUTH_GITHUB_SECRET };
  } catch {
    return null;
  }
}
