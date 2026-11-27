/**
 * Normalisation des chemins vus par la Search Console. Module PUR (ni base, ni réseau).
 *
 * Résultat : chemin FR en minuscules, sans hôte, sans slash final, sans query ni fragment.
 * `null` = URL isolée (hôte étranger ou valeur illisible) : l'appelant la compte à part.
 */
import { mapEnToFr } from "@/lib/i18n/en-to-fr-redirect";

const HOTES_SITE: ReadonlySet<string> = new Set(["axion-ia.com", "www.axion-ia.com"]);

export function normaliserChemin(brut: string): string | null {
  let s = (brut ?? "").trim();
  if (!s || s.startsWith("//")) return null;
  // Hôte sans schéma (« axion-ia.com/fr/blog ») : lu comme une URL.
  if (/^(?:www\.)?axion-ia\.com(?:[/?#]|$)/i.test(s)) s = `https://${s}`;

  let u: URL;
  try {
    // Même passage par `URL` pour une URL complète et pour un chemin seul : mêmes `..`,
    // même encodage, donc une forme unique.
    u = new URL(s, "https://axion-ia.com");
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!HOTES_SITE.has(u.hostname.toLowerCase())) return null;

  let chemin = u.pathname;
  try {
    chemin = decodeURIComponent(chemin);
  } catch {
    // séquence % invalide : on garde la forme encodée
  }
  chemin = chemin
    .replace(/;[^/]*/g, "") // paramètres de chemin (;jsessionid=…)
    .toLowerCase()
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, "");
  if (!chemin.startsWith("/")) chemin = `/${chemin}`;
  if (chemin === "/en" || chemin.startsWith("/en/")) chemin = mapEnToFr(chemin);
  return chemin.replace(/\/+$/, "") || "/";
}
