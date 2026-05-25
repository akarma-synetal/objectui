/**
 * Resolve the absolute URL of the console "home" route used after switching
 * the active organization.
 *
 * History:
 *   - `${origin}${import.meta.env.BASE_URL}home` broke portable builds
 *     (`base: './'`), producing `https://host./home` — trailing-dot host.
 *   - `new URL('home', document.baseURI)` fixed that, but `document.baseURI`
 *     falls back to the current page URL when no `<base>` tag is present.
 *     From `/home/home/` that resolves to `/home/home/home`, and each
 *     subsequent navigation appended another `/home` segment.
 *
 * The robust resolution: read `<base href>` explicitly. When present it
 * carries the deployment mount (`/_console/`, `/`, or `./`); when absent
 * we resolve against the document origin root, which is independent of the
 * current SPA route.
 */
export function resolveHomeUrl(baseURI?: string): string {
  if (baseURI !== undefined) {
    return new URL('home', baseURI).toString();
  }
  const baseHref = document.querySelector('base')?.getAttribute('href');
  const root = baseHref
    ? new URL(baseHref, window.location.origin)
    : new URL('/', window.location.origin);
  return new URL('home', root).toString();
}
