/**
 * Masquage des données bancaires et personnelles avant toute écriture dans un
 * canal de traçabilité (journal `ActivityLog`, événement Sentry).
 *
 * Pur et sans import Node : partagé entre le serveur, l'Edge et le client.
 *
 * ## Ce qui est masqué
 *
 * - **Bancaire** — toute clé dont un mot est `iban`, `bic` ou `rib`, à
 *   n'importe quelle profondeur : la valeur devient `{ masque: true, fin4 }`.
 *   Les quatre derniers caractères suffisent à reconnaître le compte dans une
 *   conversation, et ne permettent pas de l'utiliser.
 * - **Personnel** — e-mail, téléphone, adresse postale : la valeur devient
 *   `{ masque: true }`.
 * - Une valeur texte qui a la FORME d'un IBAN est masquée quelle que soit sa
 *   clé (un IBAN rangé sous `note` reste un IBAN).
 *
 * ## Ce qui ne l'est pas
 *
 * - Les booléens et `null` : `emailEnvoye: true` ne dit rien de la personne.
 * - Les clés d'EMPREINTE (`emailHash`, `contactEmailHash`, `emailSha256`…) :
 *   elles existent précisément pour remplacer la donnée en clair.
 *
 * ⚠️ La clé est découpée en MOTS (camelCase, `_`, `-`) avant comparaison : un
 * simple `/rib/i` attraperait `attribut` ou `distribution`, et masquerait des
 * données d'audit qui n'ont rien de bancaire.
 */

export interface ValeurMasquee {
  readonly masque: true;
  readonly fin4?: string | null;
}

type Nature = "bancaire" | "personnel";

const MOTS_BANCAIRES = new Set(["iban", "bic", "rib"]);
const MOTS_PERSONNELS = new Set([
  "email",
  "mail",
  "courriel",
  "telephone",
  "tel",
  "phone",
  "mobile",
  "portable",
  "fax",
  "adresse",
  "address",
  "postal",
  "rue",
]);
/** Mots qui désignent une empreinte ou une valeur déjà masquée : on n'y touche pas. */
const MOTS_EMPREINTE = new Set(["hash", "sha256", "empreinte", "fin4", "masque"]);

/**
 * Forme d'un IBAN (avec ou sans espaces), en MAJUSCULES seulement : une
 * empreinte hexadécimale minuscule (`pdfHash`) commence souvent par deux
 * lettres et deux chiffres, et ne doit pas être prise pour un compte.
 */
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g;

const PROFONDEUR_MAX = 12;

function motsDeLaCle(cle: string): string[] {
  return cle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length > 0);
}

/** Nature sensible d'une clé (`empreinte` : à laisser telle quelle), ou `null`. */
export function natureDeLaCle(cle: string): Nature | "empreinte" | null {
  const mots = motsDeLaCle(cle);
  if (mots.some((m) => MOTS_EMPREINTE.has(m))) return "empreinte";
  if (mots.some((m) => MOTS_BANCAIRES.has(m))) return "bancaire";
  if (mots.some((m) => MOTS_PERSONNELS.has(m))) return "personnel";
  return null;
}

function fin4(valeur: string): string | null {
  const brut = valeur.replace(/[^A-Za-z0-9]/g, "");
  return brut.length === 0 ? null : brut.slice(-4);
}

function masquerFeuille(valeur: unknown, nature: Nature): unknown {
  if (typeof valeur === "string") {
    if (valeur.length === 0) return valeur;
    return nature === "bancaire"
      ? ({ masque: true, fin4: fin4(valeur) } satisfies ValeurMasquee)
      : ({ masque: true } satisfies ValeurMasquee);
  }
  if (typeof valeur === "number" || typeof valeur === "bigint") {
    return nature === "bancaire"
      ? ({ masque: true, fin4: fin4(String(valeur)) } satisfies ValeurMasquee)
      : ({ masque: true } satisfies ValeurMasquee);
  }
  return valeur;
}

function masquerIbanDansTexte(texte: string): string {
  return texte.replace(IBAN_RE, (m) => `[IBAN masqué …${fin4(m) ?? ""}]`);
}

function parcourir(
  valeur: unknown,
  heritee: Nature | "empreinte" | null,
  profondeur: number,
  vus: WeakSet<object>,
): unknown {
  if (heritee === "empreinte") return valeur;
  if (heritee !== null && (valeur === null || typeof valeur !== "object")) {
    return masquerFeuille(valeur, heritee);
  }
  if (typeof valeur === "string") return masquerIbanDansTexte(valeur);
  if (valeur === null || typeof valeur !== "object") return valeur;
  if (valeur instanceof Date) return valeur;
  if (vus.has(valeur)) return "[circulaire]";
  if (profondeur >= PROFONDEUR_MAX) return "[profondeur]";
  vus.add(valeur);
  try {
    if (Array.isArray(valeur)) {
      return valeur.map((v) => parcourir(v, heritee, profondeur + 1, vus));
    }
    const sortie: Record<string, unknown> = {};
    for (const [cle, v] of Object.entries(valeur as Record<string, unknown>)) {
      const nature = heritee ?? natureDeLaCle(cle);
      sortie[cle] = parcourir(v, nature, profondeur + 1, vus);
    }
    return sortie;
  } finally {
    vus.delete(valeur);
  }
}

/**
 * Copie profonde de `valeur` où toute donnée bancaire ou personnelle est
 * masquée. Ne modifie jamais l'objet reçu.
 */
export function masquerDonneesSensibles<T>(valeur: T): T {
  return parcourir(valeur, null, 0, new WeakSet()) as T;
}
