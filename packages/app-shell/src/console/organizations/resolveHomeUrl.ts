/**
 * Resolve the absolute URL of the console "home" route used after switching
 * the active organization.
 *
 * Earlier versions concatenated `import.meta.env.BASE_URL` to
 * `window.location.origin` ("`${origin}${base}home`"). That was correct for
 * apps built with an absolute Vite base (e.g. `base: '/_console/'`), but
 * silently broken for portable builds that ship with `base: './'` — the
 * resulting URL `https://host./home` has a trailing-dot host (`host.` is a
 * fully-qualified-domain marker the browser keeps) AND drops the mount
 * prefix, landing the user on a 404.
 *
 * The fix is to resolve `home` against `document.baseURI`, which already
 * accounts for any `<base href="...">` injected by the host page. This works
 * for both `<base href="/_console/">` (tenant deployments) and
 * `<base href="/">` (root-mount deployments), and also for hosts that omit
 * `<base>` entirely (falls back to the current document URL's directory).
 */
export function resolveHomeUrl(baseURI: string = document.baseURI): string {
  return new URL('home', baseURI).toString();
}
