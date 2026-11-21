/**
 * La salutation des accusés de réception (décision du fondateur, 17/11/2026) :
 * plus jamais « Bonjour <nom complet> ».
 *
 * Règle : civilité valide + nom de famille → « Bonjour Monsieur Dupont, » ;
 * sinon prénom → « Bonjour Michel, » ; sinon « Bonjour, ». Jamais de civilité
 * devinée, jamais le nom de famille seul.
 *
 * Module PUR : aucun import serveur, utilisable dans un gabarit d'e-mail comme
 * dans le navigateur. `contactName` (« Prénom Nom ») n'est volontairement pas
 * accepté ici : le type l'interdit.
 */

export type CiviliteSalutation = "madame" | "monsieur";

export interface IdentiteSalutation {
  readonly civilite?: unknown;
  readonly prenom?: unknown;
  readonly nomFamille?: unknown;
}

/** Madame / Monsieur, sans tenir compte de la casse ni des espaces ; le reste → null. */
export function normaliserCivilite(v: unknown): CiviliteSalutation | null {
  if (typeof v !== "string") return null;
  const c = v.replace(/\s+/g, "").toLowerCase();
  if (c === "madame" || c === "mme" || c === "mme.") return "madame";
  if (c === "monsieur" || c === "m" || c === "m." || c === "mr" || c === "mr.") return "monsieur";
  return null;
}

const PARTICULES = new Set([
  "de",
  "du",
  "des",
  "d'",
  "d’",
  "van",
  "von",
  "der",
  "den",
  "di",
  "da",
  "del",
  "dos",
  "das",
]);

function majusculeInitiale(mot: string): string {
  const [premier = "", ...reste] = Array.from(mot);
  return premier.toUpperCase() + reste.join("");
}

/** Majuscule initiale à chaque segment séparé par `-`, `'` ou `’` (le mot est déjà en minuscules). */
function capitaliserSegments(mot: string): string {
  return mot
    .split(/([-'’])/)
    .map((s) => (s === "-" || s === "'" || s === "’" ? s : majusculeInitiale(s)))
    .join("");
}

/**
 * Nettoie un prénom ou un nom saisi. Rend `null` si rien de présentable.
 * Ne touche à la casse que si la saisie est TOUT en majuscules ou TOUT en
 * minuscules : une casse mixte (McDonald, DiCaprio) est rendue telle quelle.
 */
export function nettoyerNomPropre(v: unknown, opts?: { particules?: boolean }): string | null {
  if (typeof v !== "string") return null;
  let s = v
    .normalize("NFC")
    .replace(/\p{Cc}/gu, "")
    .replace(/\p{Cf}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,;:.]+$/, "")
    .trim();
  if (s === "") return null;
  if (!/\p{L}/u.test(s)) return null;
  if (s.length > 80) return null;
  const bas = s.toLowerCase();
  if (bas.startsWith("enc:v") || bas.includes("[encrypted")) return null;

  if (s === s.toUpperCase() || s === s.toLowerCase()) {
    const mots = bas.split(" ");
    const dernier = mots.length - 1;
    s = mots
      .map((mot, i) => {
        if (opts?.particules && i !== dernier) {
          if (PARTICULES.has(mot)) return mot;
          if ((mot.startsWith("d'") || mot.startsWith("d’")) && mot.length > 2) {
            return mot.slice(0, 2) + capitaliserSegments(mot.slice(2));
          }
        }
        return capitaliserSegments(mot);
      })
      .join(" ");
  }
  return s;
}

/** « Bonjour Monsieur Dupont, » / « Bonjour Michel, » / « Bonjour, » (en : « Hello … »). */
export function salutation(id: IdentiteSalutation, locale: string): string {
  const en = locale === "en";
  const bonjour = en ? "Hello" : "Bonjour";
  const civilite = normaliserCivilite(id.civilite);
  const nom = nettoyerNomPropre(id.nomFamille, { particules: true });
  const prenom = nettoyerNomPropre(id.prenom);
  if (civilite && nom) {
    const femme = civilite === "madame";
    const titre = en ? (femme ? "Ms" : "Mr") : femme ? "Madame" : "Monsieur";
    return `${bonjour} ${titre} ${nom},`;
  }
  if (prenom) return `${bonjour} ${prenom},`;
  return `${bonjour},`;
}

export type SalutationPayload =
  | { readonly civilite: CiviliteSalutation; readonly nomFamille: string }
  | { readonly prenom: string }
  | Record<string, never>;

/**
 * La clé `salutation` du payload d'un e-mail de devis (envoi, renvoi, relance) — fonction PURE.
 * Civilité ET nom de famille fiables → `{ civilite, nomFamille }` ; sinon prénom → `{ prenom }` ;
 * sinon `{}` ; `undefined` (clé à omettre) seulement si `clientNom` est vide.
 * ⛔ Jamais `contactNom` découpé, jamais de civilité devinée.
 * Règle identique à `src/server/qualiopi/crm/salutation-payload.ts` (verrouillée par un test).
 */
export function salutationPourPayload(e: {
  clientNom: string;
  contactCivilite?: unknown;
  contactPrenom?: unknown;
  contactNomFamille?: unknown;
}): SalutationPayload | undefined {
  if (e.clientNom.trim() === "") return undefined;
  const civilite = normaliserCivilite(e.contactCivilite);
  const nomFamille = nettoyerNomPropre(e.contactNomFamille, { particules: true });
  if (civilite && nomFamille) return { civilite, nomFamille };
  const prenom = nettoyerNomPropre(e.contactPrenom);
  if (prenom) return { prenom };
  return {};
}
