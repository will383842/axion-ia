/**
 * Reconnaître une fiche de candidature EMPLOI à son adresse.
 *
 * ── Pourquoi ce fichier existe ────────────────────────────────────────────
 * L'écran `/contacts/candidatures` (onglet « Toutes ») FUSIONNE deux tables
 * depuis le 2026-08-13 : les candidatures emploi (`JobApplication`) et les
 * candidatures d'apporteurs (`Submission`, sous-type commercial). Les lignes
 * sont triées ensemble par date de dépôt décroissante, et leur bouton
 * « Détail » ne mène PAS au même écran :
 *
 *   · emploi      → `/contacts/candidatures/<uuid>` — entretiens, journal, CV ;
 *   · apporteur   → `/contacts/commercial/<uuid>`   — ni entretiens ni journal.
 *
 * « La première ligne de la liste » n'est donc PAS un synonyme de « une fiche
 * de candidature emploi ». Ça l'était tant qu'aucun scénario n'écrivait de
 * candidature d'apporteur ; le jour où un parcours a soumis le tunnel
 * apporteurs, sept tests de recrutement se sont mis à ouvrir la fiche d'un
 * apporteur et à chercher un bouton « Planifier un entretien » qui n'y est pas.
 *
 * ── La forme exacte, et pourquoi pas plus large ───────────────────────────
 * On exige l'identifiant complet, pas seulement le segment `/candidatures/` :
 *
 *   · `/contacts/commercial/<uuid>`        doit être ÉCARTÉ (fiche apporteur) ;
 *   · `/contacts/candidatures/pilotage`    doit être ÉCARTÉ (écran de pilotage,
 *     qui vit sous le MÊME segment et qu'un motif approximatif attraperait) ;
 *   · `/contacts/candidatures`             doit être ÉCARTÉ (la liste elle-même).
 *
 * 🔑 Ce dépôt a déjà payé une expression trop permissive : `/format/i`
 * désignait aussi « Formations », et l'échec ne disait pas « mauvais champ »
 * mais « deux éléments ». Un motif de test se vérifie sur ce qu'il REFUSE.
 *
 * ⛔ Gardé par `tests/unit/ci/href-fiche-candidature-emploi.spec.ts` — sans lui,
 * un motif qui ne matcherait plus rien rendrait les parcours muets au lieu de
 * rouges (« aucune fiche ouvrable » ressemble à une base vide).
 *
 * Ce module ne dépend de RIEN : ni Playwright, ni Next, ni la base. C'est ce
 * qui permet à sa garde de tourner dans la suite unitaire.
 */

/** Les identifiants de `JobApplication` sont des UUID (`@default(uuid()) @db.Uuid`). */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Adresse d'une fiche de candidature EMPLOI.
 *
 * Le préfixe admin n'est pas contraint : il change d'un environnement à
 * l'autre (`ADMIN_URL_PREFIX`), et l'y écrire ferait rougir la garde pour un
 * motif sans rapport avec ce qu'elle protège.
 */
export const MOTIF_FICHE_CANDIDATURE_EMPLOI = new RegExp(`/contacts/candidatures/${UUID}$`, "i");

/**
 * Vrai si l'adresse désigne la fiche d'une candidature emploi, et elle seule.
 *
 * Le retour est un PRÉDICAT DE TYPE (`href is string`) : `filter` rétrécit alors
 * `(string | null)[]` en `string[]`, et personne n'a besoin d'un cast — un cast
 * aurait affirmé ce que la fonction vérifie déjà.
 */
export function estFicheCandidatureEmploi(href: string | null | undefined): href is string {
  if (typeof href !== "string" || href.length === 0) return false;
  // Une query (`?from=…`) ne change pas la nature de la fiche ; le motif est
  // ancré, on la retire donc avant de comparer plutôt que de relâcher l'ancre.
  const sansQuery = href.split(/[?#]/)[0] ?? "";
  return MOTIF_FICHE_CANDIDATURE_EMPLOI.test(sansQuery);
}
