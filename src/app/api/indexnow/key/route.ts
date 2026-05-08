// IndexNow key endpoint — serves the site key declared in INDEXNOW_KEY env var
// as text/plain. IndexNow protocol requires that the URL listed in
// `keyLocation` of each notification returns the exact key string.
// Spec: https://www.indexnow.org/documentation §"Key file location"
//
// We do NOT expose the key at the historical path `https://host/{key}.txt`
// (which would require either a dynamic catch-all conflicting with locale
// routes, or a build-time static file with the key baked in). The IndexNow
// spec explicitly allows ANY `keyLocation` URL, so we use a stable endpoint
// path here and reference it from the forwarder in `../route.ts`.

export const runtime = "edge";

export function GET() {
  const key = process.env["INDEXNOW_KEY"];
  if (!key) {
    return new Response(null, { status: 404 });
  }
  return new Response(key, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
