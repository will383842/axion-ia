// S1 (404) — adresses « miroir » suffixées `-1`, `-2`… (`/fr/contact-1`, `/fr/appel-2`).
// Elles viennent d'un copieur externe du site (cf. proxy.ts 0a-ter). Si, une fois le suffixe
// retiré, le chemin est une page STATIQUE de `routing.pathnames` (clés sans `[`), on renvoie
// cette page. Les slugs dynamiques (villes `bassens-73`, articles…) ne sont jamais touchés :
// seules les routes statiques servent de cible. Offres, prix, apporteurs, pages légales : exclus.
import { routing } from "../../i18n/routing";
import { resolveLegacyRedirect } from "../legacy-redirects";
import { estIntouchable } from "./etendre";

let statiques: Set<string> | undefined;

function pagesStatiques(): Set<string> {
  if (statiques) return statiques;
  const out = new Set<string>();
  for (const [cle, val] of Object.entries(routing.pathnames as Record<string, unknown>)) {
    const fr = typeof val === "string" ? val : (val as { fr?: string }).fr;
    if (!fr || fr === "/" || fr.includes("[")) continue;
    if (estIntouchable({ source: fr, destination: fr })) continue;
    out.add(fr);
    void cle;
  }
  return (statiques = out);
}

/** `/contact-1` → `/contact` ; `null` si ce n'est pas un suffixe miroir d'une page statique. */
export function cheminSansSuffixeMiroir(segments: readonly string[]): string | null {
  const dernier = segments[segments.length - 1];
  if (!dernier || !/^[a-z0-9-]*[a-z0-9]-\d{1,2}$/.test(dernier)) return null;
  const nettoye = [...segments.slice(0, -1), dernier.replace(/-\d{1,2}$/, "")];
  const chemin = `/${nettoye.join("/")}`;
  // Une page qui n'existe plus (déjà redirigée) n'est pas une cible : ce serait un 2e saut.
  if (resolveLegacyRedirect(chemin)) return null;
  return pagesStatiques().has(chemin) ? chemin : null;
}
