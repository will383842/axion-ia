/**
 * Qualiopi — Persisteur du run mensuel de rémunération des formateurs.
 *
 * `calcul.ts` sait combien vaut une ligne, `run.ts` sait lesquelles existent et
 * ce qu'on a le droit de réécrire. Ce module est le SEUL des trois à toucher la
 * base : il lit les prestations du mois, appelle les moteurs purs, et écrit.
 *
 * ── Ce que le run garantit ───────────────────────────────────────────────────
 * - **Idempotent.** Relancer le run sur un mois recalculable efface ses lignes
 *   et les réécrit. Deux exécutions de suite donnent la même base.
 * - **Sérialisé.** Un `pg_advisory_xact_lock` par période empêche deux runs
 *   concurrents de dédoubler les lignes (même mécanique que `invoice-numbering.ts`).
 * - **Respectueux du passé.** Un formateur dont le relevé du mois a dépassé
 *   `a_valider` est intégralement sauté : ni ses lignes, ni son relevé ne sont
 *   touchés (invariant 1 de `run.ts`). Il ressort dans `formateursIgnores`.
 *
 * ── Deux limites ASSUMÉES, pas des oublis ────────────────────────────────────
 * 1. **Les prestations `audit` ne sont pas traitées.** Elles se rattachent à un
 *    `Booking`, or plus aucun `Booking` n'est créé depuis le retrait du module
 *    de réservation. L'entité `AuditMission` qui doit les remplacer n'existe
 *    pas encore. La colonne `booking_id` reste donc vide : le jour où
 *    `AuditMission` arrive, on ajoute une source ici, rien d'autre à changer.
 * 2. **Le CA d'un coaching vaut 0.** Le montant vit sur `CoachingContract`, qui
 *    couvre N séances ; l'attribuer à une séance demanderait une règle de
 *    répartition que personne n'a arbitrée. Conséquence : un barème
 *    `commission_ca_pct` sur un coaching produit 0 € — et `run.ts` lève alors
 *    l'anomalie `assiette_ca_absente` plutôt que de payer 0 € en silence.
 *
 * Le rattachement d'une session collective se fait sur sa date de DÉBUT : une
 * formation à cheval sur deux mois appartient au mois où elle a commencé. C'est
 * un choix (le prorata jour/jour serait défendable) ; il est explicite ici et
 * cohérent avec la vue prévisionnelle.
 */

import type { Prisma } from "../../../../prisma/generated/client";
import { prisma } from "@/lib/prisma";
import {
  appartientALaPeriode,
  construireLignesPrestation,
  construireReleve,
  estLigneDue,
  mapStatutCoaching,
  mapStatutSession,
  periodeRecalculable,
  type Anomalie,
  type FormateurContexte,
  type LigneAPersister,
  type Periode,
  type PrestationACalculer,
  type RegleIdentifiee,
  type StatementStatut,
} from "./run";
import { HEURES_PAR_JOUR_DEFAUT } from "./calcul";

/** Un formateur écarté du run parce que son relevé est déjà figé. */
export interface FormateurIgnore {
  trainerId: string;
  statutReleve: StatementStatut;
}

export interface RunResultat {
  periode: Periode;
  prestationsLues: number;
  lignesEcrites: number;
  relevesEcrits: number;
  /** Formateurs sautés : relevé au-delà de `a_valider` (invariant 1). */
  formateursIgnores: FormateurIgnore[];
  anomalies: Anomalie[];
  /** `true` = rien n'a été écrit (simulation). */
  dryRun: boolean;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Lecture
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Fenêtre UTC ÉLARGIE d'un jour de chaque côté du mois parisien.
 *
 * On ne cherche PAS à convertir « août à Paris » en bornes UTC exactes : le
 * décalage change deux fois l'an et une erreur d'une heure déplacerait une
 * session d'un mois. On requête large — un filet qui ne peut pas rater une
 * prestation — puis `appartientALaPeriode` (heure de Paris, exact) tranche.
 */
export function fenetreUtcElargie(periode: Periode): { debut: Date; fin: Date } {
  const debut = new Date(Date.UTC(periode.year, periode.month - 1, 1));
  const fin = new Date(Date.UTC(periode.year, periode.month, 1));
  debut.setUTCDate(debut.getUTCDate() - 1);
  fin.setUTCDate(fin.getUTCDate() + 1);
  return { debut, fin };
}

/** `Decimal | null` de Prisma → `number`. Jamais de `Decimal` dans le moteur. */
function decimalVersNombre(d: Prisma.Decimal | null | undefined): number | null {
  if (d === null || d === undefined) return null;
  return d.toNumber();
}

/** Heures d'un créneau de coaching, `0` si la fin n'est pas renseignée (legacy). */
function heuresCreneau(debut: Date, fin: Date | null): number {
  if (fin === null) return 0;
  const ms = fin.getTime() - debut.getTime();
  return ms > 0 ? ms / 3_600_000 : 0;
}

/**
 * Prestations du mois, toutes sources confondues. Le filtrage fin est fait à
 * Paris ; la requête, elle, ratisse large (cf. `fenetreUtcElargie`).
 */
async function lirePrestations(periode: Periode): Promise<PrestationACalculer[]> {
  const { debut, fin } = fenetreUtcElargie(periode);

  const [sessions, coachings] = await Promise.all([
    prisma.trainingSession.findMany({
      where: { dateDebut: { gte: debut, lt: fin } },
      select: {
        id: true,
        dateDebut: true,
        statut: true,
        montantHtCents: true,
        formation: { select: { slug: true, dureeHeures: true } },
        sessionFormateurs: { select: { trainerId: true, heuresAnimees: true } },
      },
    }),
    prisma.coachingSession.findMany({
      where: { dateSeance: { gte: debut, lt: fin } },
      select: {
        id: true,
        trainerId: true,
        dateSeance: true,
        dateSeanceFin: true,
        statut: true,
        interventionSlug: true,
      },
    }),
  ]);

  const prestations: PrestationACalculer[] = [];

  for (const s of sessions) {
    if (!appartientALaPeriode(s.dateDebut, periode)) continue;
    prestations.push({
      type: "formation_collective",
      sessionId: s.id,
      coachingSessionId: null,
      bookingId: null,
      date: s.dateDebut,
      statut: mapStatutSession(s.statut),
      // Un slug de formation peut dépasser les 80 caractères d'une règle ciblée :
      // dans ce cas aucune règle `interventionSlug` ne matchera et le barème
      // global du formateur s'appliquera. C'est le comportement voulu.
      interventionSlug: s.formation.slug,
      dureeHeures: s.formation.dureeHeures,
      caTotalCents: s.montantHtCents,
      affectations: s.sessionFormateurs.map((sf) => {
        const heures = decimalVersNombre(sf.heuresAnimees);
        // Heures non saisies → `construireLignesPrestation` retombe sur la durée
        // de la formation. On ne force PAS un 0 ici (cf. zéro silencieux).
        return heures === null
          ? { trainerId: sf.trainerId }
          : { trainerId: sf.trainerId, heuresAnimees: heures };
      }),
    });
  }

  for (const c of coachings) {
    if (!appartientALaPeriode(c.dateSeance, periode)) continue;
    const heures = heuresCreneau(c.dateSeance, c.dateSeanceFin);
    prestations.push({
      type: "coaching_1to1",
      sessionId: null,
      coachingSessionId: c.id,
      bookingId: null,
      date: c.dateSeance,
      statut: mapStatutCoaching(c.statut),
      interventionSlug: c.interventionSlug,
      dureeHeures: heures,
      // Le CA d'un coaching vit sur le contrat, pas sur la séance (cf. en-tête).
      caTotalCents: 0,
      affectations: [{ trainerId: c.trainerId }],
    });
  }

  return prestations;
}

/** Contexte des formateurs concernés + leurs barèmes versionnés. */
async function lireFormateursEtRegles(
  trainerIds: readonly string[],
): Promise<{ formateurs: Map<string, FormateurContexte>; regles: RegleIdentifiee[] }> {
  if (trainerIds.length === 0) return { formateurs: new Map(), regles: [] };

  const [trainers, rules] = await Promise.all([
    prisma.trainer.findMany({
      where: { id: { in: [...trainerIds] } },
      select: { id: true, statut: true, tarifJourneeHtCents: true, regimeTvaHonoraires: true },
    }),
    prisma.trainerCompensationRule.findMany({
      where: { trainerId: { in: [...trainerIds] } },
    }),
  ]);

  const formateurs = new Map<string, FormateurContexte>(
    trainers.map((t) => [
      t.id,
      {
        trainerId: t.id,
        statut: t.statut,
        tarifJourneeHtCentsFallback: t.tarifJourneeHtCents,
        regimeTva: t.regimeTvaHonoraires,
      },
    ]),
  );

  const regles: RegleIdentifiee[] = rules.map((r) => {
    const base: RegleIdentifiee = {
      id: r.id,
      trainerId: r.trainerId,
      prestationType: r.prestationType,
      interventionSlug: r.interventionSlug,
      model: r.model,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
    };
    // Construction conditionnelle (exactOptionalPropertyTypes) : un taux absent
    // doit rester absent, pas devenir `undefined` explicite.
    if (r.tauxJourneeHtCents !== null) base.tauxJourneeHtCents = r.tauxJourneeHtCents;
    if (r.tauxHoraireHtCents !== null) base.tauxHoraireHtCents = r.tauxHoraireHtCents;
    if (r.forfaitHtCents !== null) base.forfaitHtCents = r.forfaitHtCents;
    const pct = decimalVersNombre(r.commissionPct);
    if (pct !== null) base.commissionPct = pct;
    return base;
  });

  return { formateurs, regles };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Écriture
 * ────────────────────────────────────────────────────────────────────────────── */

/** Motif porté par la ligne quand une anomalie la concerne (trace persistée). */
function motifDeLigne(ligne: LigneAPersister, anomalies: readonly Anomalie[]): string | null {
  const refId = ligne.sessionId ?? ligne.coachingSessionId ?? ligne.bookingId;
  const a = anomalies.find(
    (x) =>
      x.trainerId === ligne.trainerId &&
      x.prestation !== null &&
      (x.prestation.sessionId ?? x.prestation.coachingSessionId ?? x.prestation.bookingId) ===
        refId,
  );
  return a?.motif ?? null;
}

/**
 * Exécute le run mensuel. `dryRun` calcule tout et n'écrit rien — c'est le mode
 * à offrir dans l'UI avant de laisser un humain valider.
 *
 * Le lock est pris DANS la transaction : il tombe au commit comme au rollback,
 * donc un run qui échoue ne laisse jamais la période verrouillée.
 */
export async function runRemunerationMensuelle(
  periode: Periode,
  opts: { dryRun?: boolean } = {},
): Promise<RunResultat> {
  const dryRun = opts.dryRun === true;

  const prestations = await lirePrestations(periode);
  const trainerIds = [
    ...new Set(prestations.flatMap((p) => p.affectations.map((a) => a.trainerId))),
  ];
  const { formateurs, regles } = await lireFormateursEtRegles(trainerIds);

  const anomalies: Anomalie[] = [];
  const lignesParFormateur = new Map<string, LigneAPersister[]>();

  for (const prestation of prestations) {
    const res = construireLignesPrestation(prestation, regles, formateurs, HEURES_PAR_JOUR_DEFAUT);
    anomalies.push(...res.anomalies);
    for (const ligne of res.lignes) {
      const acc = lignesParFormateur.get(ligne.trainerId) ?? [];
      acc.push(ligne);
      lignesParFormateur.set(ligne.trainerId, acc);
    }
  }

  const formateursIgnores: FormateurIgnore[] = [];
  let lignesEcrites = 0;
  let relevesEcrits = 0;

  if (dryRun) {
    for (const [trainerId, lignes] of lignesParFormateur) {
      const formateur = formateurs.get(trainerId);
      if (formateur === undefined) continue;
      const { releve, anomalies: aRel } = construireReleve(formateur, periode, lignes);
      anomalies.push(...aRel);
      lignesEcrites += lignes.length;
      if (releve !== null) relevesEcrits += 1;
    }
    return {
      periode,
      prestationsLues: prestations.length,
      lignesEcrites,
      relevesEcrits,
      formateursIgnores,
      anomalies,
      dryRun: true,
    };
  }

  await prisma.$transaction(
    async (tx) => {
      // Sérialise les runs concurrents sur CETTE période. Relâché au commit/rollback.
      const cle = `remuneration_run_${periode.year}_${periode.month}`;
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext('${cle.replace(/'/g, "''")}'))`,
      );

      // Les formateurs qui avaient des lignes sur la période mais n'en ont plus
      // (session supprimée, affectation retirée) doivent voir les leurs EFFACÉES.
      // Itérer seulement sur les formateurs du run laisserait des lignes
      // fantômes, et un relevé qui les totalise.
      const dejaPresents = await tx.trainerFeeLine.findMany({
        where: { periodeYear: periode.year, periodeMonth: periode.month },
        select: { trainerId: true },
        distinct: ["trainerId"],
      });
      const concernes = new Set<string>([
        ...lignesParFormateur.keys(),
        ...dejaPresents.map((l) => l.trainerId),
      ]);

      for (const trainerId of concernes) {
        const lignes = lignesParFormateur.get(trainerId) ?? [];

        const existant = await tx.trainerStatement.findUnique({
          where: {
            trainerId_periodeYear_periodeMonth: {
              trainerId,
              periodeYear: periode.year,
              periodeMonth: periode.month,
            },
          },
          select: { id: true, statut: true },
        });

        // Invariant 1 : au-delà de `a_valider`, on ne touche à RIEN. Ni les lignes
        // (elles sont figées dans un relevé relu par un humain), ni le relevé.
        if (existant !== null && !periodeRecalculable(existant.statut)) {
          formateursIgnores.push({ trainerId, statutReleve: existant.statut });
          continue;
        }

        // Idempotence : on efface les lignes recalculables de la période avant de
        // réécrire. Le garde `statut != valide` est une ceinture : une ligne
        // validée ne devrait pas survivre à un relevé encore recalculable.
        await tx.trainerFeeLine.deleteMany({
          where: {
            trainerId,
            periodeYear: periode.year,
            periodeMonth: periode.month,
            statut: { not: "valide" },
          },
        });

        // Formateur du run précédent qui n'a plus de prestation ce mois-ci : ses
        // lignes viennent d'être effacées, son relevé (encore recalculable) ne
        // totalise plus rien. Le laisser afficherait un montant fantôme.
        const formateur = formateurs.get(trainerId);
        if (formateur === undefined || lignes.length === 0) {
          if (existant !== null) await tx.trainerStatement.delete({ where: { id: existant.id } });
          continue;
        }

        const { releve, anomalies: aRel } = construireReleve(formateur, periode, lignes);
        anomalies.push(...aRel);

        let statementId: string | null = null;
        if (releve !== null) {
          const ecrit = await tx.trainerStatement.upsert({
            where: {
              trainerId_periodeYear_periodeMonth: {
                trainerId,
                periodeYear: periode.year,
                periodeMonth: periode.month,
              },
            },
            create: releve,
            // On ne réécrit JAMAIS le statut d'un relevé existant : il peut être
            // passé en `a_valider` par un opérateur pendant qu'on recalcule.
            update: {
              tvaRegime: releve.tvaRegime,
              totalHtCents: releve.totalHtCents,
              tvaCents: releve.tvaCents,
              totalTtcCents: releve.totalTtcCents,
            },
            select: { id: true },
          });
          statementId = ecrit.id;
          relevesEcrits += 1;
        } else if (existant !== null) {
          // Plus rien de dû (que du prévisionnel, de l'annulé, ou un salarié) :
          // le relevé recalculable qui restait n'a plus d'objet.
          await tx.trainerStatement.delete({ where: { id: existant.id } });
        }

        const maintenant = new Date();
        await tx.trainerFeeLine.createMany({
          data: lignes.map((l) => ({
            ...l,
            motif: motifDeLigne(l, anomalies),
            // Seules les lignes DUES sont rattachées au relevé qui les facture.
            statementId: statementId !== null && estLigneDue(l) ? statementId : null,
            calculatedAt: maintenant,
          })),
        });
        lignesEcrites += lignes.length;
      }
    },
    // Un mois chargé enchaîne beaucoup d'aller-retours : les 5 s par défaut de
    // Prisma sont trop courtes, et un timeout ici annulerait tout le run.
    { timeout: 120_000, maxWait: 10_000 },
  );

  return {
    periode,
    prestationsLues: prestations.length,
    lignesEcrites,
    relevesEcrits,
    formateursIgnores,
    anomalies,
    dryRun: false,
  };
}
