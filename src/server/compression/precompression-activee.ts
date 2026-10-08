// Précompression Brotli/Gzip des fichiers du build (`scripts/precompress-static.ts`) : DÉSACTIVÉE
// par défaut depuis le 2026-10-08.
//
// Mesuré sur la mise en ligne du 2026-10-08 (run 37736377320) : 1 297 s, soit 21,6 min des 56 min
// du job « Build & push image to GHCR », et 22,3 min des 39,8 min de la Gate C. Le gain était
// NUL en production : les `.br` et `.gz` ne sont servis par personne. Le site passe par Traefik
// (proxy Coolify) jusqu'au serveur Next (`compress: false`), et la réponse d'origine d'un chunk
// arrive SANS `Content-Encoding` même avec `Accept-Encoding: br`. C'est Cloudflare qui compresse
// vers les visiteurs. Le Caddyfile du dépôt, qui aurait servi ces fichiers, n'est pas sur le
// chemin du site.
//
// Pour la rallumer (si un proxy qui sert les fichiers précompressés est remis devant le site) :
// `PRECOMPRESS_STATIC=true` au build.

export function precompressionActivee(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env["PRECOMPRESS_STATIC"] === "true";
}
