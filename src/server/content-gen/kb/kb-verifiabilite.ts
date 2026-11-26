/**
 * Règle de vérifiabilité des fiches de la base de connaissances (audit 26/11/2026, PR 1).
 *
 * Un fait attribué à un organisme extérieur ET qui contient un chiffre doit pointer vers la
 * page précise qui le contient. Une page d'accueil (« https://www.bpifrance.fr ») ne prouve
 * rien : elle ne permet pas de retrouver le chiffre. Un tel fait est retiré, ou réécrit sans
 * chiffre ni attribution. Les chiffres « Retours terrain » d'Axion-IA sont retirés aussi.
 *
 * Module pur : aucune dépendance, utilisable par les tests et par le journal de quarantaine.
 */

interface FaitVerifiable {
  readonly text: string;
  readonly source: string;
  readonly sourceUrl: string;
}

/** Texte débarrassé des nombres qui ne sont pas des statistiques (années, références de textes). */
function sansNombresDeReference(texte: string): string {
  return texte
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\d{4}\/\d+/g, "")
    .replace(/ISO(\/IEC)?\s?\d+(:\d+)?/g, "")
    .replace(/\b(article|articles|annexe|art\.)\s?\d+[\w.()]*/gi, "")
    .replace(/\b(v|version)\s?\d+(\.\d+)*/gi, "")
    .replace(/\bRFC\s?\d+/g, "")
    .replace(/\b(GPT|Claude|Llama|H)-?\s?\d[\w.]*/g, "");
}

export function contientUnChiffre(texte: string): boolean {
  return /\d/.test(sansNombresDeReference(texte));
}

export function estFaitAxion(fait: FaitVerifiable): boolean {
  return /axion-ia/i.test(fait.source) || /axion-ia\.com/.test(fait.sourceUrl);
}

/**
 * Adresse « profonde » : elle désigne un document ou une page précise, pas un accueil ni une
 * rubrique générale. Profonde si : 3 segments de chemin ou plus, ou paramètres/ancre, ou
 * dernier segment avec un chiffre, une extension .html/.pdf ou un titre (≥ 3 mots à tirets).
 */
export function aAdresseProfonde(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const segments = u.pathname.split("/").filter(Boolean);
  const dernier = segments[segments.length - 1] ?? "";
  return (
    segments.length >= 3 ||
    u.search !== "" ||
    u.hash !== "" ||
    /\d|\.(html|pdf)$/.test(dernier) ||
    (dernier.match(/-/g) ?? []).length >= 2
  );
}

/** Fait d'un organisme extérieur, chiffré, sans adresse profonde : à ne pas laisser dans la base. */
export function estFaitTiersChiffreSansAdresseProfonde(fait: FaitVerifiable): boolean {
  return !estFaitAxion(fait) && contientUnChiffre(fait.text) && !aAdresseProfonde(fait.sourceUrl);
}

/** Chiffre présenté comme une observation de terrain d'Axion-IA (non vérifiable). */
export function estRetourTerrainChiffre(fait: FaitVerifiable): boolean {
  return /retours?\s+terrain/i.test(fait.source) && contientUnChiffre(fait.text);
}
