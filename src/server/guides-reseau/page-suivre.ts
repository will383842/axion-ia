// Bouton « Suivre la page Axion IA » du parcours « guide par réseau » (formulaire, merci, e-mail).
//
// MODULE PUR, sans JavaScript navigateur : il ne fait que choisir une adresse et fabriquer un lien
// HTML simple (balise a). L'adresse vient de variables d'environnement lues à la requête :
//   PAGE_SUIVRE_FACEBOOK · PAGE_SUIVRE_LINKEDIN · PAGE_SUIVRE_INSTAGRAM
//
// Règles (décision de Williams) :
//   · variable absente ou vide → AUCUN bouton (comportement d'avant, inchangé) ;
//   · seules les adresses https dont l'hôte est facebook.com, linkedin.com ou instagram.com
//     (avec ou sans « www. ») sont acceptées ; toute autre → aucun bouton ;
//   · `tiktok`, `autre` ou réseau inconnu → aucun bouton ;
//   · jamais une condition pour recevoir le guide ni pour envoyer le formulaire.

export const TEXTE_SUIVRE_PAGE = "Suivre la page Axion IA";

const VARIABLE_PAR_RESEAU = {
  facebook: "PAGE_SUIVRE_FACEBOOK",
  linkedin: "PAGE_SUIVRE_LINKEDIN",
  instagram: "PAGE_SUIVRE_INSTAGRAM",
} as const;

const HOTES_ACCEPTES: ReadonlySet<string> = new Set([
  "facebook.com",
  "www.facebook.com",
  "linkedin.com",
  "www.linkedin.com",
  "instagram.com",
  "www.instagram.com",
]);

type Env = Readonly<Record<string, string | undefined>>;

/** Réseau d'origine connu pour le bouton, ou `null` (tiktok, autre, inconnu, non texte). */
export function reseauSuivable(reseau: unknown): keyof typeof VARIABLE_PAR_RESEAU | null {
  return typeof reseau === "string" && Object.hasOwn(VARIABLE_PAR_RESEAU, reseau)
    ? (reseau as keyof typeof VARIABLE_PAR_RESEAU)
    : null;
}

/** Adresse https à suivre pour ce réseau, ou `null` : alors, aucun bouton. */
export function adressePageSuivre(reseau: unknown, env: Env = process.env): string | null {
  const r = reseauSuivable(reseau);
  if (r === null) return null;
  const brut = env[VARIABLE_PAR_RESEAU[r]]?.trim();
  if (!brut) return null;
  try {
    const u = new URL(brut);
    if (u.protocol !== "https:" || !HOTES_ACCEPTES.has(u.hostname)) return null;
    if (u.username !== "" || u.password !== "" || u.port !== "") return null;
    return u.href;
  } catch {
    return null;
  }
}

const echapper = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Bouton HTML pour les pages-routes (formulaire, merci), ou chaîne vide. Simple lien, aucune image,
 * aucun script. La hauteur est fixée (`min-height`) : pas de décalage de mise en page.
 */
export function boutonSuivrePageHtml(reseau: unknown, env: Env = process.env): string {
  const href = adressePageSuivre(reseau, env);
  if (href === null) return "";
  return `<p><a href="${echapper(href)}" rel="noopener noreferrer" target="_blank" style="display:inline-block;box-sizing:border-box;min-height:2.75rem;padding:.7rem 1.2rem;font-weight:600;color:#c24a1b;border:2px solid #c24a1b;border-radius:.5rem;text-decoration:none">${echapper(TEXTE_SUIVRE_PAGE)}</a></p>`; // hex-ok: page HTML autonome, aucun jeton Tailwind (réponse de route)
}
