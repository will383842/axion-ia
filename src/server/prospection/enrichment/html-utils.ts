/**
 * Prospection — Utilitaires HTML→texte légers (T5, pur, sans dépendance lourde).
 */

/** Retire script/style, remplace les balises par des espaces, décode quelques entités. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&eacute;/gi, "é")
    .replace(/&egrave;/gi, "è")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Extrait les valeurs des attributs `href` d'un type donné (`mailto:` / `tel:`). */
export function extractHrefs(html: string, scheme: "mailto:" | "tel:"): string[] {
  const re = new RegExp(`href\\s*=\\s*["']${scheme}([^"']+)["']`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1]) out.push(decodeURIComponent(m[1].split("?")[0] ?? m[1]));
  }
  return out;
}
