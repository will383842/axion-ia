/**
 * Normalisation des chemins vus par la Search Console. Module PUR (ni base, ni réseau).
 *
 * Résultat : chemin FR en minuscules, sans hôte, sans slash final, sans query ni fragment.
 * `null` = URL isolée (hôte étranger ou valeur illisible) : l'appelant la compte à part.
 */
import { mapEnToFr } from "@/lib/i18n/en-to-fr-redirect";

const HOTES_SITE: ReadonlySet<string> = new Set(["axion-ia.com", "www.axion-ia.com"]);

export function normaliserChemin(brut: string): string | null {
  const s = (brut ?? "").trim();
  if (!s) return null;

  let chemin: string;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    let u: URL;
    try {
      u = new URL(s);
    } catch {
      return null;
    }
    if (!HOTES_SITE.has(u.hostname.toLowerCase())) return null;
    chemin = u.pathname;
  } else if (s.startsWith("//")) {
    return null;
  } else {
    chemin = s.split("#")[0]!.split("?")[0]!;
  }

  chemin = chemin
    .toLowerCase()
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, "");
  if (!chemin.startsWith("/")) chemin = `/${chemin}`;
  if (chemin === "/en" || chemin.startsWith("/en/")) chemin = mapEnToFr(chemin);
  return chemin.replace(/\/+$/, "") || "/";
}
