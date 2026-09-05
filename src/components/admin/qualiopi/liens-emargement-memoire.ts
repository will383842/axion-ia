/**
 * F9 — les liens d'émargement ne se perdent plus au premier changement de page.
 *
 * ## Le défaut fermé
 *
 * L'écran annonce, à juste titre : « Ces liens ne sont affichés qu'ici et ne
 * sont pas conservés en clair. » La base ne garde QUE le SHA-256 du jeton, et
 * c'est un choix de sécurité qu'il ne faut pas défaire.
 *
 * Mais le chemin naturel — émettre les liens, aller chercher l'adresse d'un
 * stagiaire, revenir — les détruisait. Ils vivaient dans un `useState` de
 * `LiensEmargement`, donc dans la mémoire d'un composant démonté à la première
 * navigation. Il fallait alors RÉÉMETTRE, ce qui invalide les liens déjà
 * distribués : à cinquante lignes de QR, l'usage « je copie le lien dans le
 * chat de la visio » — celui que l'aide de l'écran recommande explicitement —
 * ne survivait pas à un aller-retour.
 *
 * ## Le choix, et sa limite
 *
 * Les liens sont conservés dans le **`sessionStorage` de l'onglet**, jamais
 * envoyés nulle part. Ce n'est pas un contournement du choix de sécurité :
 *
 * - le SERVEUR continue de ne stocker que l'empreinte — rien n'est ajouté en
 *   base, aucune Server Action n'est touchée ;
 * - `sessionStorage` meurt avec l'ONGLET. La phrase « si vous fermez cette
 *   page, il faudra en réémettre » reste donc vraie au sens fort — c'est la
 *   navigation INTERNE qui cesse de détruire ;
 * - un jeton périmé n'est jamais rendu : la relecture purge sur `expiresAt`,
 *   sinon on afficherait un QR qui ne signe plus, ce qui est pire qu'un écran
 *   vide (on le distribue en salle et personne ne peut émarger).
 *
 * ⚠️ Module SANS "use client", sans JSX et **sans aucun accès direct au
 * `sessionStorage`** : il ne fait que sérialiser et relire une chaîne. C'est ce
 * qui le rend testable — et `LiensEmargement` importe trois Server Actions, donc
 * un test qui monterait le composant échouerait au CHARGEMENT en annonçant « no
 * tests ». Même raison d'être que `lieu-values.ts` et `montant-euros.ts`.
 */

/** Un lien tel qu'il est conservé le temps de la visite. */
export interface LienMemorise {
  readonly enrollmentId: string;
  readonly stagiaireNom: string;
  readonly url: string;
  readonly qr: string;
  /** Date d'expiration en ISO — sert à purger, et à afficher. */
  readonly expiresAtIso: string;
}

/**
 * Clé de stockage, PAR SESSION de formation.
 *
 * Sans le `sessionId`, ouvrir une seconde session ferait apparaître les liens
 * de la première sous les noms de ses propres stagiaires — l'erreur la plus
 * coûteuse possible sur une pièce probante.
 */
export function clefMemoireLiens(sessionId: string): string {
  return `qualiopi-liens-emargement:${sessionId}`;
}

/** Forme stockée : version + liens. La version permet d'ignorer un ancien format. */
const VERSION = 1;

export function serialiserLiens(liens: readonly LienMemorise[]): string {
  return JSON.stringify({ v: VERSION, liens });
}

function estLienValide(x: unknown): x is LienMemorise {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o["enrollmentId"] === "string" &&
    typeof o["stagiaireNom"] === "string" &&
    typeof o["url"] === "string" &&
    typeof o["qr"] === "string" &&
    typeof o["expiresAtIso"] === "string" &&
    !Number.isNaN(Date.parse(o["expiresAtIso"]))
  );
}

/**
 * Relit ce qui a été conservé, purgé de tout jeton expiré.
 *
 * Rend `null` — et non `[]` — dès qu'il n'y a plus RIEN à montrer : l'écran doit
 * alors retomber sur son état « pas encore émis », et non afficher une liste
 * vide qui laisserait croire que l'émission a échoué.
 *
 * Toute anomalie (chaîne absente, JSON illisible, version inconnue, entrée
 * malformée) rend `null` sans jamais lever : une mémoire corrompue ne doit pas
 * empêcher d'ouvrir l'écran d'émargement le jour de la session.
 */
export function lireLiensMemorises(brut: string | null, maintenant: Date): LienMemorise[] | null {
  if (brut === null || brut === "") return null;
  let parse: unknown;
  try {
    parse = JSON.parse(brut);
  } catch {
    return null;
  }
  if (typeof parse !== "object" || parse === null) return null;
  const enveloppe = parse as Record<string, unknown>;
  if (enveloppe["v"] !== VERSION) return null;
  const liens = enveloppe["liens"];
  if (!Array.isArray(liens)) return null;

  const vivants = liens
    .filter(estLienValide)
    .filter((l) => Date.parse(l.expiresAtIso) > maintenant.getTime());

  return vivants.length > 0 ? vivants : null;
}
