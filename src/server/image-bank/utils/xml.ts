// Template : src/server/image-bank/utils/xml.ts
//
// Escape XML pour sitemap-images-*.xml + JSON-LD output.
// Cohérent avec `src/app/sitemap-news.xml/route.ts` (pattern existant).

export function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function escapeHtmlAttr(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
