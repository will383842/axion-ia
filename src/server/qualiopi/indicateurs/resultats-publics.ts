/**
 * Résultats PUBLICS d'une formation — l'encadré « Nos résultats » de la fiche
 * catalogue (indicateur 2 du Référentiel national qualité : diffuser des
 * indicateurs de résultats).
 *
 * ## Pourquoi ce module existe
 *
 * 🔴 Audit initial 2026-10-01. Le bouton console « Publier les indicateurs »
 * pose `indicateursPubliesAt`, et le Mode auditeur lit cette date pour écrire
 * « Indicateurs de résultats diffusés ». Mais la seule page qui les affichait —
 * la branche « base de données » de `/formations/[slug]` — ne s'exécute jamais
 * (cf. `tests/unit/qualiopi/la-fiche-formation-db-est-du-code-mort.spec.ts`).
 * L'indicateur était donc déclaré diffusé sans l'être nulle part. Décision du
 * dirigeant (2026-10-01) : afficher, sur la fiche réellement servie.
 *
 * ## Ce qui est affiché, et ce qui ne l'est jamais
 *
 * - **Uniquement des comptes lus en base**, recalculés à chaque régénération
 *   ISR : sessions réalisées, stagiaires ACCUEILLIS, note de satisfaction,
 *   assiduité. « Accueillis », jamais « formés » : le décompte est celui de la
 *   console (inscrits non sortis), il compte donc aussi un absent ; c'est la
 *   tuile « Assiduité » qui dit qui a réellement suivi la formation. Les
 *   valeurs SAISIES à la main dans le formulaire console (`indicateursPublies`)
 *   ne sont PAS reprises : une saisie libre peut diverger de la mesure, le
 *   calcul non. La date `indicateursPubliesAt` sert d'ACCORD de publication.
 * - **Aucun arrondi flatteur** : la moyenne est TRONQUÉE au dixième (4,96 → 4,9,
 *   jamais 5,0). L'assiduité s'écrit en effectifs (« 1 stagiaire sur 1 »), pas
 *   en pourcentage.
 * - **L'échantillon est toujours écrit**, et déclaré faible sous le même seuil
 *   de fiabilité que la console (`SEUIL_FIABILITE`, 5 observations).
 * - **Rien sinon** : sans accord de publication, sans session réalisée ou sans
 *   stagiaire, la fonction rend `null` et la fiche n'affiche aucun bloc.
 *
 * ## Mêmes prédicats que la console
 *
 * Mêmes filtres que `getIndicateurs` (`./service`) : session `realisee`,
 * inscriptions actives (`inscriptionsActives()` : hors abandon et exclusion),
 * questionnaires `satisfaction_chaud` répondus avec une note, seuil de présence
 * lu en configuration (`seuil_presence_pct`). Deux écrans, une seule vérité.
 *
 * ## Rattachement catalogue ↔ base
 *
 * Par le SLUG : `catalog-import.ts` crée chaque formation avec
 * `slug: f.slugFr`, et `Formation.slug` est `@unique` au schéma. Une fiche
 * catalogue correspond donc à au plus UNE formation en base.
 *
 * ## Contrat de build `stub.invalid` (ADR 0026)
 *
 * Au build, aucune requête : retour `null` avant tout appel Prisma, rien n'est
 * affiché, et l'ISR (`revalidate = 3600` sur la page) repeuple en production.
 * Une base indisponible au runtime ne casse pas la fiche : `null` aussi.
 *
 * Ce fichier est PUR (calcul + libellés, aucune I/O) ; la lecture en base vit
 * dans `./resultats-publics-service`.
 */

import { getFormationV2 } from "@/content/formations/catalog-v2";
import { SEUIL_FIABILITE } from "./calcul";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DonneesResultatsFormation {
  /** Accord de publication posé en console (`Formation.indicateursPubliesAt`). */
  readonly indicateursPubliesAt: Date | null;
  /** Sessions `realisee` de la formation. */
  readonly sessions: ReadonlyArray<{ dateDebut: Date; dateFin: Date }>;
  /** Inscriptions actives de ces sessions. */
  readonly inscriptions: ReadonlyArray<{ tauxPresencePct: number | null }>;
  /** Notes globales /5 des questionnaires de satisfaction à chaud répondus. */
  readonly notes: ReadonlyArray<number>;
  /** Seuil de présence (configuration `seuil_presence_pct`). */
  readonly seuilPresencePct: number;
  /** Instant du calcul — affiché comme date de mise à jour. */
  readonly calculeLe: Date;
}

export interface ResultatsPublicsFormation {
  readonly nbSessions: number;
  /** Stagiaires ACCUEILLIS (inscrits non sortis) — jamais « formés ». */
  readonly nbStagiaires: number;
  readonly periode: { readonly debut: Date; readonly fin: Date };
  /** `null` tant qu'aucun questionnaire noté n'est revenu. */
  readonly satisfaction: { readonly moyenneSur5: number; readonly nbReponses: number } | null;
  /**
   * `null` si un taux de présence manque : on ne publie pas une assiduité
   * calculée sur des présences non saisies (un vide compterait comme absence).
   */
  readonly assiduite: { readonly nbAssidus: number; readonly seuilPct: number } | null;
  /** Sous le seuil de fiabilité de la console : « premiers résultats ». */
  readonly echantillonFaible: boolean;
  readonly calculeLe: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Calcul PUR
// ─────────────────────────────────────────────────────────────────────────────

/** Tronque au dixième, vers le bas : jamais d'arrondi qui embellit. */
export function tronquerAuDixieme(x: number): number {
  return Math.floor(x * 10 + 1e-9) / 10;
}

/**
 * LA règle de diffusion, à un seul endroit : accord de publication posé en
 * console, au moins une session réalisée, au moins un stagiaire accueilli.
 *
 * Lue par l'encadré public (`construireResultatsPublics`) ET par le Mode
 * auditeur (`aDesResultatsSurSaFichePublique` → `conformite-service.ts`,
 * indicateur 2) : l'écran de l'auditeur ne peut plus dire « diffusés » quand
 * la fiche n'affiche rien.
 */
export function resultatsDiffusables(c: {
  readonly indicateursPubliesAt: Date | null;
  readonly nbSessionsRealisees: number;
  readonly nbStagiaires: number;
}): boolean {
  return c.indicateursPubliesAt !== null && c.nbSessionsRealisees > 0 && c.nbStagiaires > 0;
}

/** Une formation publiée, telle que la lit le Mode auditeur. */
export interface FormationPublieeLue {
  readonly slug: unknown;
  readonly indicateursPubliesAt: Date | null;
  /** Sessions `realisee`, avec le nombre d'inscriptions ACTIVES de chacune. */
  readonly sessions?: ReadonlyArray<{ readonly _count?: { readonly enrollments?: number } }>;
}

/**
 * Les résultats de cette formation s'affichent-ils VRAIMENT sur une fiche
 * publique ? L'encadré ne vit que sur la fiche CATALOGUE, rattachée par
 * `Formation.slug` = `slugFr` : une formation hors catalogue (sur-mesure,
 * slug renommé) n'a pas de fiche qui le montre.
 */
export function aDesResultatsSurSaFichePublique(f: FormationPublieeLue): boolean {
  if (typeof f.slug !== "string" || getFormationV2(f.slug)?.slugFr !== f.slug) return false;
  const sessions = Array.isArray(f.sessions) ? f.sessions : [];
  return resultatsDiffusables({
    indicateursPubliesAt: f.indicateursPubliesAt ?? null,
    nbSessionsRealisees: sessions.length,
    nbStagiaires: sessions.reduce((n, s) => n + (s._count?.enrollments ?? 0), 0),
  });
}

export function construireResultatsPublics(
  d: DonneesResultatsFormation,
): ResultatsPublicsFormation | null {
  if (
    !resultatsDiffusables({
      indicateursPubliesAt: d.indicateursPubliesAt,
      nbSessionsRealisees: d.sessions.length,
      nbStagiaires: d.inscriptions.length,
    })
  ) {
    return null;
  }

  const debut = new Date(Math.min(...d.sessions.map((s) => s.dateDebut.getTime())));
  const fin = new Date(Math.max(...d.sessions.map((s) => s.dateFin.getTime())));

  const notes = d.notes.filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
  const satisfaction =
    notes.length === 0
      ? null
      : {
          moyenneSur5: tronquerAuDixieme(notes.reduce((a, n) => a + n, 0) / notes.length),
          nbReponses: notes.length,
        };

  const presencesCompletes =
    Number.isFinite(d.seuilPresencePct) && d.inscriptions.every((i) => i.tauxPresencePct !== null);
  const assiduite = presencesCompletes
    ? {
        nbAssidus: d.inscriptions.filter((i) => (i.tauxPresencePct ?? -1) >= d.seuilPresencePct)
          .length,
        seuilPct: d.seuilPresencePct,
      }
    : null;

  return {
    nbSessions: d.sessions.length,
    nbStagiaires: d.inscriptions.length,
    periode: { debut, fin },
    satisfaction,
    assiduite,
    echantillonFaible:
      d.inscriptions.length < SEUIL_FIABILITE ||
      (satisfaction !== null && satisfaction.nbReponses < SEUIL_FIABILITE),
    calculeLe: d.calculeLe,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Libellés (purs, testés)
// ─────────────────────────────────────────────────────────────────────────────

function pluriel(n: number, singulier: string, plurielForme: string): string {
  return `${n} ${n > 1 ? plurielForme : singulier}`;
}

/** « 1er octobre 2026 », « 5 septembre 2026 » — fuseau Europe/Paris. */
export function dateLongueFr(d: Date): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).formatToParts(d);
  const jour = parts.find((p) => p.type === "day")?.value ?? "";
  const mois = parts.find((p) => p.type === "month")?.value ?? "";
  const annee = parts.find((p) => p.type === "year")?.value ?? "";
  return `${jour === "1" ? "1er" : jour} ${mois} ${annee}`;
}

/** « 4,9 » — virgule décimale, sans zéro inutile (« 5 », pas « 5,0 »). */
export function noteFr(x: number): string {
  return Number.isInteger(x) ? String(x) : x.toFixed(1).replace(".", ",");
}

/** « Sur 1 session réalisée et 1 stagiaire — premiers résultats. » */
export function libelleEchantillon(r: ResultatsPublicsFormation): string {
  const base =
    `Sur ${pluriel(r.nbSessions, "session réalisée", "sessions réalisées")} et ` +
    `${pluriel(r.nbStagiaires, "stagiaire", "stagiaires")}`;
  return r.echantillonFaible ? `${base} — premiers résultats.` : `${base}.`;
}

/** « Session du 5 septembre 2026. » ou « Sessions du … au …. » */
export function libellePeriode(r: ResultatsPublicsFormation): string {
  const debut = dateLongueFr(r.periode.debut);
  const fin = dateLongueFr(r.periode.fin);
  const sujet = r.nbSessions > 1 ? "Sessions" : "Session";
  return debut === fin ? `${sujet} du ${debut}.` : `${sujet} du ${debut} au ${fin}.`;
}
