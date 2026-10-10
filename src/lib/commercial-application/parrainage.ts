// Le code de parrainage capté par le tunnel de candidature — INT-T52-A (REQ-SEC-037, REQ-JUR-028).
//
// ── D'où vient la forme ─────────────────────────────────────────────────────
// Le code est ÉMIS par Axion Partners (SEC-21, `src/domain/parrainage/code.ts` du dépôt
// axion-apporteurs) : `AX` puis six caractères de l'alphabet Crockford base32, sans I, L, O ni
// U. Partners REVALIDE tout code reçu (`normaliserCodeParrainage`) : la forme écrite ici n'est
// qu'un pré-filtre, identique, qui n'invente rien. Le contrat publié ne la porte pas encore
// (`parrainCodeCapture` y est une chaîne libre) : la recopier ici est une dette nommée, à éteindre
// quand une version du contrat la portera.
//
// ── Ce que le tunnel fait du code ───────────────────────────────────────────
// Le `?p=` d'une visite est lu par la page, transmis en champ caché, jamais posé dans un cookie
// ni un stockage local (SEC-21, REQ-JUR-028). L'action serveur le juge ICI, puis le range dans
// `Submission.details` sous `CLE_DU_CODE_DE_PARRAINAGE`, d'où le producteur de
// `candidature.recue` le relit au clic « prêt à signer ». Un code mal formé est ignoré en
// silence ; la réponse au visiteur ne change jamais selon le code (aucun oracle).
//
// Partagé serveur / client, sans dépendance Node — comme `lead-apporteur.ts`.

/** La clé de `Submission.details` où le code capté est rangé. Une seule écriture, une lecture. */
export const CLE_DU_CODE_DE_PARRAINAGE = "parrainCode";

/**
 * Le compteur des captures (conditions (4) et (5) de la lentille sécurité, rattrapage 44) : trente
 * captures par heure et par adresse réseau HACHÉE avec sel, en refus sur panne ; au-delà de
 * `alertePanneSecondes` de panne continue, une alerte de catégorie fermée part, une fois. axion-ia
 * n'a pas de SSOT des seuils du tunnel : la constante vit ici, sur le modèle de
 * `src/lib/limites-connexion-admin.ts` (rattrapage 94).
 */
export const CAPTURES_DE_PARRAINAGE = {
  limite: 30,
  fenetreSecondes: 3600,
  alertePanneSecondes: 900,
  source: "INT-T52-A, lentille sécurité (rattrapage 44)",
} as const;

/**
 * La clé du compteur : TROIS segments, pour que le signal de panne du limiteur partagé, qui ne
 * rapporte que les deux premiers (`clePrefixe`), ne porte jamais l'empreinte de l'adresse.
 */
export function cleDuCompteurDeParrainage(empreinteIp: string): string {
  return `tunnel:parrainage:${empreinteIp}`;
}

/**
 * Le code du dossier complet : celui qu'il a reçu lui-même, sinon celui de son premier contact,
 * recopié côté serveur (rattrapage 94). Jamais par le navigateur.
 */
export function codeDuDossierComplet(
  codeDuDossier: string | null,
  codeDuPremierContact: string | null,
): string | null {
  return codeDuDossier ?? codeDuPremierContact;
}

/**
 * Le suivi d'une panne du compteur, dans le processus : rend `true` UNE fois, quand la panne dure
 * depuis au moins `alertePanneSecondes` ; un verdict sans panne remet le suivi à zéro. Dédoublonnée
 * par processus : une panne longue ne fait pas une alerte par candidature.
 */
const suivi: { depuisMs: number | null; alerte: boolean } = { depuisMs: null, alerte: false };

export function suivreLaPanneDuCompteur(panne: boolean, maintenantMs: number): boolean {
  if (!panne) {
    suivi.depuisMs = null;
    suivi.alerte = false;
    return false;
  }
  suivi.depuisMs ??= maintenantMs;
  const longue = maintenantMs - suivi.depuisMs >= CAPTURES_DE_PARRAINAGE.alertePanneSecondes * 1000;
  if (!longue || suivi.alerte) return false;
  suivi.alerte = true;
  return true;
}

/** La forme d'un code de parrainage (SEC-21) : `AX`, puis six caractères Crockford base32. */
function aLaFormeDUnCode(valeur: string): boolean {
  return /^AX[0-9A-HJKMNP-TV-Z]{6}$/.test(valeur);
}

/**
 * Un code CAPTÉ, sous sa forme canonique (blancs autour retirés, capitales), ou `null` : un code
 * absent, d'un autre type ou mal formé est ignoré, jamais une erreur. Même règle que Partners.
 */
export function codeDeParrainageCapte(capture: unknown): string | null {
  if (typeof capture !== "string") return null;
  const canonique = capture.trim().toUpperCase();
  return aLaFormeDUnCode(canonique) ? canonique : null;
}

/** Le verdict du limiteur partagé (`@/lib/rate-limit`), tel que l'action le reçoit. */
export interface VerdictDuLimiteur {
  readonly allowed: boolean;
  readonly panne?: boolean;
}

/**
 * Le code TRANSMIS à la fiche : celui qui a la forme d'un code, et seulement si le limiteur
 * l'a admis sans panne (décision de la coordination, rattrapage 44) : un code capté pendant
 * une panne ou au-delà de la limite n'est pas transmis, la candidature part sans code. La
 * candidature, elle, part toujours : rien ici ne la refuse.
 */
export function codeDeParrainageTransmis(
  capture: unknown,
  verdict: VerdictDuLimiteur,
): string | null {
  const code = codeDeParrainageCapte(capture);
  if (code === null || !verdict.allowed || verdict.panne === true) return null;
  return code;
}

/** Le code rangé dans une fiche, relu sous sa forme canonique, ou `null`. */
export function codeDeParrainageDeLaFiche(details: unknown): string | null {
  if (details === null || typeof details !== "object" || Array.isArray(details)) return null;
  return codeDeParrainageCapte((details as Record<string, unknown>)[CLE_DU_CODE_DE_PARRAINAGE]);
}
