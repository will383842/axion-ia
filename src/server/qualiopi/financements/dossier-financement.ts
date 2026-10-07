/**
 * Hub facturation — dossiers de financement (Phase 3).
 *
 * Machine à états MANUELLE (aucun email automatique) :
 *   a_monter → envoye → accord_recu → facture → paiement_recu → clos
 *                     ↘ refuse ────────────────────────────────↗
 * Chaque transition pose son horodatage. Le montant REÇU se dérive des
 * `Payment` des factures liées (SSOT encaissements) — jamais dupliqué ici.
 *
 * `marquerPaiementRecuSiSoldee` est le pont encaissement → dossier : appelé
 * après un encaissement, il passe le dossier à `paiement_recu` quand TOUTES
 * ses factures sont payées.
 */

import { prisma } from "@/lib/prisma";
import {
  emettreFinancementMisAJour,
  transactionFaitFacturation,
} from "@/server/partners-sync/producteurs/facturation";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { nomOpcoDuClient, referenceOpcoDuClient } from "./opco-referentiel";
import { montantPrisEnChargeCents } from "./prise-en-charge-montant";
import { sessionExigeUnDossier } from "./dossier-auto";
import { planAccordEcrit } from "./accord-ecrit";
import { employeursConcernes, exigerIdccConfirme } from "./blocage-idcc";
import {
  construireLignesPayeurs,
  montantDemandeFinanceurCents,
  type ContexteSessionPayeurs,
} from "./dossier-payeurs";
import type { DossierFinancementStatut, Prisma } from "../../../../prisma/generated/client";

/**
 * Les colonnes de session dont dépend la ventilation des créances — écrites UNE
 * fois, lues par la création du dossier ET par sa reventilation.
 *
 * 🔴 Deux `select` distincts finiraient par diverger : la création ventilerait
 * sur les inscriptions et la reventilation sur autre chose, et le dossier
 * changerait de forme au moment de l'accord sans que personne ne comprenne.
 */
const SELECT_SESSION_PAYEURS = {
  id: true,
  clientId: true,
  // INT-T67-A : le refus faute d'IDCC confirmé rappelle la date de début.
  dateDebut: true,
  montantHtCents: true,
  financementType: true,
  opcoSubrogation: true,
  numeroDossierOpco: true,
  // 🔴 Le tarif NE SE LIT PAS SEUL — cf. `prise-en-charge-montant.ts`. L'unité
  // et les plafonds décident de ce qu'il vaut ; la durée et l'effectif aussi.
  priseEnChargeMontantCents: true,
  priseEnChargeUnite: true,
  priseEnChargePlafondFormationCents: true,
  priseEnChargePlafondAnnuelCents: true,
  nbParticipantsPrevus: true,
  formation: { select: { dureeHeures: true } },
  edofVerifieAt: true,
  ftDispositif: true,
  client: { select: { id: true, raisonSociale: true, opco: true, opcoIdentifie: true } },
  // 🔴 T4a — les inscriptions décident des payeurs en inter-entreprises. Les
  // abandons et exclusions sont hors périmètre : on ne réclame pas le siège de
  // quelqu'un qui n'a pas suivi l'action.
  enrollments: {
    where: { ...inscriptionsActives() },
    select: {
      financementType: true,
      clientId: true,
      numeroDossierOpco: true,
      edofVerifieAt: true,
      ftDispositif: true,
      montantHtCents: true,
      client: { select: { id: true, raisonSociale: true, opco: true, opcoIdentifie: true } },
    },
  },
} satisfies Prisma.TrainingSessionSelect;

type SessionPourPayeurs = Prisma.TrainingSessionGetPayload<{
  select: typeof SELECT_SESSION_PAYEURS;
}>;

/** Traduit la session lue en contexte de ventilation. */
function contexteDepuisSession(session: SessionPourPayeurs): ContexteSessionPayeurs {
  return {
    financementType: session.financementType,
    clientId: session.clientId,
    numeroDossierOpco: session.numeroDossierOpco,
    edofVerifieAt: session.edofVerifieAt,
    ftDispositif: session.ftDispositif,
    montantHtCents: session.montantHtCents,
    opcoSubrogation: session.opcoSubrogation,
    // 🔴 Le MONTANT CALCULÉ, pas le tarif brut. `priseEnChargeMontantCents` est
    // un tarif dont le sens dépend de l'unité : le passer tel quel plafonnait
    // la part financeur à « 40 € » quand l'OPCO couvre 40 €/h × 14 h × 8
    // participants. Les créances étaient fausses du même facteur.
    //
    // `null` se propage volontairement : `construireLignesPayeurs` traite un
    // plafond nul comme « pas de plafond connu » et laisse le financeur couvrir
    // ce qui le concerne — c'est la demande, avant la réponse. Un 0 aurait
    // signifié « refus », ce qui n'est pas la même chose.
    priseEnChargeMontantCents: montantPrisEnChargeCents({
      priseEnChargeMontantCents: session.priseEnChargeMontantCents,
      priseEnChargeUnite: session.priseEnChargeUnite,
      priseEnChargePlafondFormationCents: session.priseEnChargePlafondFormationCents,
      priseEnChargePlafondAnnuelCents: session.priseEnChargePlafondAnnuelCents,
      dureeHeures: session.formation?.dureeHeures ?? null,
      nbParticipants: session.nbParticipantsPrevus,
    }),
    client: session.client,
  };
}

/** Transitions autorisées (machine à états — tout le reste est rejeté). */
export const DOSSIER_TRANSITIONS: Record<
  DossierFinancementStatut,
  ReadonlyArray<DossierFinancementStatut>
> = {
  a_monter: ["envoye", "clos"],
  envoye: ["accord_recu", "refuse", "a_monter"],
  accord_recu: ["facture", "clos"],
  refuse: ["clos", "envoye"],
  facture: ["paiement_recu", "clos"],
  paiement_recu: ["clos"],
  clos: [],
};

/** Champ d'horodatage posé à l'arrivée dans chaque statut. */
const STATUT_TIMESTAMP: Partial<
  Record<DossierFinancementStatut, keyof Prisma.DossierFinancementUncheckedUpdateInput>
> = {
  envoye: "envoyeAt",
  accord_recu: "accordAt",
  refuse: "refuseAt",
  paiement_recu: "paiementRecuAt",
  clos: "closAt",
};

export function isTransitionDossierValide(
  from: DossierFinancementStatut,
  to: DossierFinancementStatut,
): boolean {
  return DOSSIER_TRANSITIONS[from].includes(to);
}

/**
 * Applique une transition de statut (verrou optimiste : la mise à jour est
 * conditionnée au statut d'origine — une transition concurrente perd).
 */
export async function transitionnerDossier(input: {
  dossierId: string;
  vers: DossierFinancementStatut;
  /** Posé à l'accord (montant accordé par le financeur, centimes). */
  montantAccordeCents?: number;
  /** Posé à l'accord/facturation : date de paiement attendue du financeur. */
  echeanceFinanceurAt?: Date;
  /**
   * Chantier OPCO A6 — date ÉCRITE sur l'accord du financeur (colonne `@db.Date`).
   * Distincte de `accordAt` (le clic en console) : c'est elle qui fait foi pour
   * le régime de paiement. Posée seulement à l'arrivée en `accord_recu`.
   */
  accordEcritLe?: Date;
}): Promise<{ statut: DossierFinancementStatut }> {
  if (input.accordEcritLe !== undefined && input.vers !== "accord_recu") {
    throw new Error("La date de l'accord écrit ne se saisit qu'à l'accord.");
  }
  const dossier = await prisma.dossierFinancement.findUniqueOrThrow({
    where: { id: input.dossierId },
    select: { statut: true },
  });
  if (!isTransitionDossierValide(dossier.statut, input.vers)) {
    throw new Error(
      `Transition invalide : ${dossier.statut} → ${input.vers} (autorisées : ${DOSSIER_TRANSITIONS[dossier.statut].join(", ") || "aucune"}).`,
    );
  }

  const tsField = STATUT_TIMESTAMP[input.vers];
  const { count } = await transactionFaitFacturation(prisma, async (tx) => {
    const ecrit = await tx.dossierFinancement.updateMany({
      where: { id: input.dossierId, statut: dossier.statut },
      data: {
        statut: input.vers,
        ...(tsField !== undefined ? { [tsField]: new Date() } : {}),
        ...(input.montantAccordeCents !== undefined
          ? { montantAccordeCents: input.montantAccordeCents }
          : {}),
        ...(input.echeanceFinanceurAt !== undefined
          ? { echeanceFinanceurAt: input.echeanceFinanceurAt }
          : {}),
        ...(input.accordEcritLe !== undefined ? { accordEcritLe: input.accordEcritLe } : {}),
      },
    });
    // 🔑 `financement.mis_a_jour` (INT-T05, REQ-INT-032) : l'échéance du financeur est dans la
    // charge de CHAQUE facture émise du dossier. La poser est un fait pour chacune, écrit dans la
    // transaction de l'écriture — canal fermé, rien ne change (inertie).
    if (ecrit.count > 0 && input.echeanceFinanceurAt !== undefined) {
      const factures = await tx.factureFormation.findMany({
        where: {
          dossierFinancementId: input.dossierId,
          avoirDeId: null,
          statut: { not: "brouillon" },
        },
        select: { id: true },
      });
      for (const f of factures) await emettreFinancementMisAJour(tx, f.id);
    }
    return ecrit;
  });
  if (count === 0) {
    throw new Error("Transition concurrente détectée — recharger le dossier.");
  }

  // ── 🔴 LA DÉCISION DU FINANCEUR CHANGE QUI DOIT QUOI ──────────────────────
  //
  // Question de Will le 16/08 : que se passe-t-il si l'OPCO ne prend qu'une
  // partie en charge, s'il change son montant après coup, ou s'il annule ?
  // Réponse d'alors : RIEN. Les créances étaient écrites une fois à la création
  // et jamais retouchées — aucun code du dépôt n'écrivait dans `DossierPayeur`
  // après le `create`. Le reste à charge du client restait faux, et rien ne
  // signalait qu'il devenait débiteur du tout.
  //
  // Les trois cas ne font qu'un : le PLAFOND du financeur change.
  //   accord reçu  → le montant accordé (à défaut, ce qui était demandé)
  //   refus        → 0, tout retombe sur les entreprises
  //
  // ⚠️ Seules ces deux transitions reventilent. `facture`, `paiement_recu` et
  // `clos` n'apportent aucune information nouvelle sur QUI doit : recalculer là
  // écraserait une ventilation éventuellement corrigée à la main entre-temps.
  if (input.vers === "accord_recu" || input.vers === "refuse") {
    await reventilerPayeurs(input.dossierId, input.vers === "refuse" ? 0 : null);
  }

  return { statut: input.vers };
}

/**
 * Chantier OPCO A6 — saisit le dépôt de la demande de prise en charge, fait
 * par l'ENTREPRISE sur son espace OPCO : « Dépôt fait le » et, s'il est connu,
 * le numéro de dossier attribué par l'OPCO.
 *
 * ⚠️ Ce n'est PAS une transition : le statut ne bouge pas (l'envoi reste un
 * geste distinct de la machine à états). L'écriture est conditionnée au statut
 * lu — même verrou optimiste que `transitionnerDossier` — et refusée sur un
 * dossier clos.
 */
export async function enregistrerDepotDossier(input: {
  dossierId: string;
  depotFaitLe: Date;
  numeroDossierExterne?: string;
}): Promise<{ trainingSessionId: string | null }> {
  const dossier = await prisma.dossierFinancement.findUniqueOrThrow({
    where: { id: input.dossierId },
    select: { statut: true, trainingSessionId: true },
  });
  if (dossier.statut === "clos") {
    throw new Error("Dossier clos : le dépôt ne se saisit plus.");
  }
  const { count } = await prisma.dossierFinancement.updateMany({
    where: { id: input.dossierId, statut: dossier.statut },
    data: {
      depotFaitLe: input.depotFaitLe,
      ...(input.numeroDossierExterne !== undefined
        ? { numeroDossierExterne: input.numeroDossierExterne }
        : {}),
    },
  });
  if (count === 0) {
    throw new Error("Modification concurrente détectée — recharger le dossier.");
  }
  return { trainingSessionId: dossier.trainingSessionId };
}

/**
 * Lot OPCO A7b — saisit la date ÉCRITE sur l'accord du financeur depuis la page
 * Financement de la session. Le geste dépend du statut (`planAccordEcrit`) :
 * date seule si l'accord est déjà acté, sinon transition(s) jusqu'à
 * `accord_recu` par `transitionnerDossier` (même machine à états, même
 * reventilation des créances). Rend les transitions faites, pour le journal.
 */
export async function enregistrerAccordEcrit(input: {
  dossierId: string;
  accordEcritLe: Date;
}): Promise<{ trainingSessionId: string | null; transitions: DossierFinancementStatut[] }> {
  const dossier = await prisma.dossierFinancement.findUniqueOrThrow({
    where: { id: input.dossierId },
    select: { statut: true, depotFaitLe: true, trainingSessionId: true },
  });
  const plan = planAccordEcrit(dossier);
  if (plan.geste === "refus") throw new Error(plan.message);
  if (plan.geste === "transitions") {
    for (const vers of plan.vers) {
      await transitionnerDossier({
        dossierId: input.dossierId,
        vers,
        ...(vers === "accord_recu" ? { accordEcritLe: input.accordEcritLe } : {}),
      });
    }
    return { trainingSessionId: dossier.trainingSessionId, transitions: plan.vers };
  }
  const { count } = await prisma.dossierFinancement.updateMany({
    where: { id: input.dossierId, statut: dossier.statut },
    data: { accordEcritLe: input.accordEcritLe },
  });
  if (count === 0) {
    throw new Error("Modification concurrente détectée — recharger le dossier.");
  }
  return { trainingSessionId: dossier.trainingSessionId, transitions: [] };
}

/**
 * Recalcule les créances d'un dossier après une décision du financeur.
 *
 * @param plafondForce `0` pour un refus/une annulation ; `null` pour reprendre
 *   le montant accordé s'il existe, sinon celui demandé.
 *
 * Best-effort : une transition déjà écrite ne doit pas être annulée parce que
 * la ventilation n'a pas pu être refaite. L'échec est journalisé ; la
 * transition, elle, est un fait acté par un humain habilité.
 *
 * 🔴 Les lignes sont REMPLACÉES, pas complétées : une ventilation est un
 * partage, pas un historique. Y ajouter les nouvelles lignes ferait un dossier
 * dont la somme des créances dépasse le prix de la formation.
 */
export async function reventilerPayeurs(
  dossierId: string,
  plafondForce: number | null,
): Promise<void> {
  try {
    const dossier = await prisma.dossierFinancement.findUnique({
      where: { id: dossierId },
      select: {
        montantDemandeCents: true,
        montantAccordeCents: true,
        trainingSession: { select: SELECT_SESSION_PAYEURS },
      },
    });
    const session = dossier?.trainingSession;
    // Sans session rattachée (dossier de coaching, d'audit, ou facture libre),
    // la ventilation par siège n'a pas de sens : on ne touche à rien.
    if (!dossier || !session) return;

    const plafond =
      plafondForce !== null
        ? plafondForce
        : (dossier.montantAccordeCents ?? dossier.montantDemandeCents);

    const lignes = construireLignesPayeurs(session.enrollments, contexteDepuisSession(session), {
      plafondFinanceurCents: plafond,
    });

    // ── 🔴 UNE CRÉANCE DÉJÀ FACTURÉE NE SE REVENTILE PAS ─────────────────────
    //
    // La suppression/recréation était sans danger tant que `factureFormationId`
    // n'était écrit nulle part. Depuis qu'une facture s'y rattache à
    // l'émission, effacer la ligne **casserait le lien d'une facture réelle** —
    // une perte de donnée silencieuse, et une facture orpheline dans un dossier
    // qui ne saurait plus ce qu'elle solde.
    //
    // Sur le fond : une créance facturée est ENGAGÉE. Une pièce comptable est
    // partie, avec un numéro légal, chez un débiteur nommé. La reventiler
    // reviendrait à modifier après coup ce qui a été réclamé. On ne redistribue
    // donc que le solde NON facturé.
    const dejaFacturees = await prisma.dossierPayeur.findMany({
      where: { dossierId, factureFormationId: { not: null } },
      select: { id: true, payeurType: true, montantAttenduCents: true },
    });

    // Ce que les créances engagées ont déjà pris au financeur : le nouveau
    // plafond ne peut porter que sur le reste.
    const engageFinanceur = dejaFacturees
      .filter((c) => c.payeurType === "opco_subroge" || c.payeurType === "france_travail")
      .reduce((n, c) => n + c.montantAttenduCents, 0);

    const aReecrire = lignes
      // Les lignes engagées restent telles quelles : on ne recrée que ce qui ne
      // l'est pas, et on retire du nouveau partage ce qui est déjà parti.
      .map((l) =>
        (l.payeurType === "opco_subroge" || l.payeurType === "france_travail") &&
        engageFinanceur > 0
          ? { ...l, montantAttenduCents: Math.max(0, l.montantAttenduCents - engageFinanceur) }
          : l,
      )
      .filter((l) => l.montantAttenduCents > 0);

    await prisma.$transaction([
      // ⚠️ Le `where` EXCLUT les lignes facturées — c'est toute la garde.
      prisma.dossierPayeur.deleteMany({ where: { dossierId, factureFormationId: null } }),
      prisma.dossierPayeur.createMany({
        data: aReecrire.map((l) => ({ ...l, dossierId })),
      }),
    ]);
  } catch (err) {
    console.error("[dossier-financement] reventilation impossible", {
      dossierId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Statuts où les créances ne sont pas encore ENGAGÉES par une facture : la
 * décision de subrogation peut encore les redistribuer.
 */
const STATUTS_REVENTILABLES_SUBROGATION: ReadonlyArray<DossierFinancementStatut> = [
  "a_monter",
  "envoye",
  "accord_recu",
  // Refusé : le plafond reste 0 (tout à l'entreprise), seul le drapeau suit.
  "refuse",
];

/**
 * Lot A8c — la subrogation de la session vient de changer : les dossiers OPCO
 * ouverts suivent (drapeau `subrogation`, lu par la relance, et créances).
 *
 * 🔴 Sans elle, les créances restaient celles de l'OUVERTURE du dossier — qui
 * précède en général la décision de subrogation : la facture à l'OPCO était
 * alors refusée, ou une créance OPCO survivait au passage en remboursement.
 *
 * À appeler APRÈS l'écriture de la session : `reventilerPayeurs` relit la
 * subrogation sur la session. Un dossier déjà facturé (ou au-delà) n'est pas
 * touché — ses créances sont engagées — et il est rendu dans `engages` pour
 * que l'écran le dise.
 */
export async function alignerDossiersSurSubrogation(
  sessionId: string,
  subrogation: boolean,
): Promise<{
  alignes: string[];
  engages: Array<{ id: string; statut: DossierFinancementStatut }>;
}> {
  const dossiers = await prisma.dossierFinancement.findMany({
    where: {
      trainingSessionId: sessionId,
      type: { in: ["opco", "mixte"] },
      statut: { not: "clos" },
    },
    select: {
      id: true,
      statut: true,
      subrogation: true,
      // Relecture A8c : une créance déjà FACTURÉE engage le dossier, quel que soit
      // son statut (ex. `accord_recu` avec une facture émise) — sinon la
      // reventilation recréerait une créance du total à côté de la facturée.
      payeurs: { where: { factureFormationId: { not: null } }, select: { id: true }, take: 1 },
    },
  });
  const alignes: string[] = [];
  const engages: Array<{ id: string; statut: DossierFinancementStatut }> = [];
  for (const d of dossiers) {
    if (!STATUTS_REVENTILABLES_SUBROGATION.includes(d.statut) || d.payeurs.length > 0) {
      engages.push({ id: d.id, statut: d.statut });
      continue;
    }
    if (d.subrogation !== subrogation) {
      await prisma.dossierFinancement.update({ where: { id: d.id }, data: { subrogation } });
    }
    await reventilerPayeurs(d.id, d.statut === "refuse" ? 0 : null);
    alignes.push(d.id);
  }
  return { alignes, engages };
}

/**
 * Pont encaissement → dossier : si TOUTES les factures (non annulées, hors
 * avoirs) d'un dossier `facture` sont payées, il passe à `paiement_recu`.
 * Best-effort : ne throw jamais (l'encaissement reste valide même si le
 * dossier ne bouge pas).
 */
export async function marquerPaiementRecuSiSoldee(dossierId: string): Promise<void> {
  try {
    const dossier = await prisma.dossierFinancement.findUnique({
      where: { id: dossierId },
      select: {
        statut: true,
        factures: {
          where: { statut: { not: "annulee" }, avoirDeId: null },
          select: { statut: true },
        },
        payeurs: { select: { factureFormationId: true, montantAttenduCents: true } },
      },
    });
    if (!dossier || dossier.statut !== "facture") return;
    if (dossier.factures.length === 0) return;
    const toutesPayees = dossier.factures.every((f) => f.statut === "payee");
    if (!toutesPayees) return;
    // 🔴 Lot A8c — une créance non nulle encore NON FACTURÉE (le reste à charge
    // d'une subrogation partielle) retient le dossier : sinon la facture de
    // l'OPCO payée suffisait à annoncer soldée une affaire dont une part
    // n'était même pas réclamée.
    const resteAFacturer = (dossier.payeurs ?? []).some(
      (p) => p.factureFormationId === null && p.montantAttenduCents > 0,
    );
    if (resteAFacturer) return;
    await prisma.dossierFinancement.updateMany({
      where: { id: dossierId, statut: "facture" },
      data: { statut: "paiement_recu", paiementRecuAt: new Date() },
    });
  } catch {
    // Best-effort — le pilotage du dossier ne bloque jamais un encaissement.
  }
}

/**
 * Crée un dossier depuis une session de formation en REPRENANT les champs
 * OPCO existants (source Qualiopi inchangée — le dossier est la vue de
 * pilotage). Payeurs : OPCO subrogé + reste à charge entreprise si
 * subrogation, sinon entreprise seule.
 *
 * 🔴 IDEMPOTENT depuis le sous-lot 8C : si un dossier existe déjà pour cette
 * session, il est rendu tel quel. Deux raisons, et la seconde n'existait pas
 * avant 8C :
 *
 *  1. le bouton du hub facturation créait un dossier **à chaque clic** — deux
 *     clics, deux créances pour la même affaire, et le cockpit comptait double.
 *     C'est le même défaut que la file de validation d'e-mails (Lot 3quinquies) ;
 *  2. l'ouverture automatique à la déclaration du financement passe par ici.
 *     Sans idempotence, corriger un champ après coup dupliquerait le dossier.
 *
 * ⚠️ Ce n'est pas une garantie de base : sans contrainte d'unicité, deux appels
 * strictement simultanés peuvent encore passer. Le cas est théorique (l'action
 * est admin, séquentielle) et une contrainte relève d'une migration — hors du
 * périmètre des lots UI. C'est dit ici plutôt que supposé ailleurs.
 */
export async function creerDossierDepuisSession(sessionId: string): Promise<{ id: string }> {
  const existant = await prisma.dossierFinancement.findFirst({
    // 🔴 Un dossier `clos` n'est plus un suivi : le compter ici ferait qu'un
    // aller-retour opco → direct → opco (dont le retour referme le dossier)
    // laisserait la session en OPCO avec pour seul dossier un dossier clos —
    // aucune alerte, aucune ligne au cockpit, le défaut même du sous-lot 8C.
    where: { trainingSessionId: sessionId, statut: { not: "clos" } },
    select: { id: true },
    // Le plus ancien : si un doublon a été créé avant cette garde, c'est lui
    // qui porte l'historique de transitions.
    orderBy: { createdAt: "asc" },
  });
  if (existant !== null) return existant;

  const session = await prisma.trainingSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: SELECT_SESSION_PAYEURS,
  });

  // 🔴 16/08 — le repli sur « opco » MENTAIT sur les affaires sans financeur.
  //
  // `DossierFinancementType` ne contient que `opco | france_travail | cpf |
  // mixte` : il n'y a **aucune** valeur pour un financement direct. Le repli
  // faisait donc d'une affaire payée sur fonds propres un dossier « OPCO » —
  // et si le client avait un OPCO identifié, son nom était même inscrit comme
  // financeur d'une affaire qui n'en a jamais eu.
  //
  // Le défaut était discret tant que l'ouverture était manuelle et rare ; le
  // sous-lot 8C, qui ouvre les dossiers tout seuls, l'aurait multiplié.
  //
  // On refuse au lieu de mal typer : un dossier ne se justifie que s'il y a un
  // financeur à suivre. `sessionExigeUnDossier` dit lesquels, et c'est la même
  // règle que celle qui décide de l'ouverture automatique — une seule, pas deux.
  if (!sessionExigeUnDossier(session.financementType)) {
    throw new Error(
      "Aucun dossier de financement pour cette session : son financement est direct (ou non déclaré), il n'y a donc pas de financeur à suivre. Déclarez d'abord un financement OPCO, CPF, France Travail ou mixte.",
    );
  }

  const type =
    session.financementType === "france_travail"
      ? "france_travail"
      : session.financementType === "cpf"
        ? "cpf"
        : session.financementType === "mixte"
          ? "mixte"
          : "opco";

  // 🔴 INT-T67-A — un dossier OPCO ou mixte ne se GÉNÈRE pas tant que l'IDCC de
  // chaque employeur concerné n'est pas `confirme` (INT-T61-A). Le refus nomme
  // les entreprises en cause. Placé APRÈS le retour du dossier existant : un
  // dossier déjà généré reste intact, seule une nouvelle génération est bloquée.
  // Contrôle par employeur en inter-entreprises (`Enrollment.clientId`).
  await exigerIdccConfirme(prisma, {
    typeDossier: type,
    employeurs: employeursConcernes(session),
    dateDebut: session.dateDebut ?? null,
  });

  // Montant CALCULÉ (unité, durée, effectif, plafonds), jamais le tarif brut.
  const priseEnCharge = contexteDepuisSession(session).priseEnChargeMontantCents ?? 0;

  // 🔴 T4a — les créances viennent des INSCRIPTIONS quand il y en a.
  //
  // Avant : une seule ligne, au nom du client porteur, pour le montant de la
  // session. En inter-entreprises, six employeurs relevant de six OPCO ne
  // faisaient donc qu'une créance — alors que `DossierPayeur` est
  // multi-payeurs depuis l'origine et que `resolveEnrollmentFinancement`
  // existait déjà, inutilisé ici.
  //
  // Sans inscription, `construireLignesPayeurs` rend exactement la ventilation
  // historique (OPCO subrogé + reste à charge, ou entreprise seule) : le
  // comportement d'une session intra est inchangé.
  // Le plafond n'est pas forcé ici : `construireLignesPayeurs` reprend la prise
  // en charge DÉCLARÉE sur la session. C'est la demande, pas encore la réponse
  // du financeur — celle-ci reventile au moment de l'accord ou du refus.
  const lignesPayeurs = construireLignesPayeurs(
    session.enrollments,
    contexteDepuisSession(session),
  );

  const dossier = await prisma.dossierFinancement.create({
    data: {
      type,
      subrogation: session.opcoSubrogation,
      // 🔴 GARDE DE TYPE — l'OPCO n'est le financeur QUE d'un dossier OPCO (ou
      // mixte). Un dossier CPF a pour financeur la Caisse des Dépôts, un dossier
      // France Travail l'opérateur public : y inscrire l'OPCO du client
      // afficherait un financeur FAUX sur le hub facturation. Le `type` était
      // calculé JUSTE AU-DESSUS puis ignoré. Le défaut était dormant tant que
      // `opcoIdentifie` restait vide en base ; F6 le remplit, donc il devient
      // visible — d'où la garde, posée dans le MÊME commit.
      // Libellé et non slug : la colonne stocke « akto », on écrit « Akto ».
      // Règle unique (lot A7a) : OPCO typé d'abord, ancien texte libre ensuite.
      ...(referenceOpcoDuClient(session.client) !== null && (type === "opco" || type === "mixte")
        ? { financeurNom: nomOpcoDuClient(session.client) }
        : {}),
      ...(session.numeroDossierOpco != null
        ? { numeroDossierExterne: session.numeroDossierOpco }
        : {}),
      // 🔴 T4a — le montant DEMANDÉ au financeur est la somme de ce que les
      // lignes financeur attendent, pas le montant de la session.
      //
      // L'ancienne formule (`priseEnCharge > 0 ? priseEnCharge : montantHt`)
      // valait pour une session intra à un seul payeur. En inter-entreprises,
      // elle aurait annoncé au financeur un montant sans rapport avec les
      // sièges réellement pris en charge — et le cockpit aurait comparé ce
      // montant à des encaissements calculés autrement.
      //
      // Repli sur l'ancienne formule quand aucune ligne financeur n'existe :
      // un dossier en financement direct n'a rien à demander à personne, et
      // afficher 0 se lirait comme une erreur de génération.
      montantDemandeCents: montantDemandeFinanceurCents(lignesPayeurs, {
        priseEnCharge,
        montantSessionCents: session.montantHtCents,
      }),
      ...(session.clientId != null ? { clientId: session.clientId } : {}),
      trainingSessionId: session.id,
      payeurs: { create: lignesPayeurs },
    },
    select: { id: true },
  });
  return dossier;
}

/**
 * Un dossier `a_monter` n'est un classeur VIDE que s'il n'a jamais été déposé.
 *
 * 🔴 #1112, revue 5250421969 : `envoye → a_monter` est une transition permise
 * (le financeur renvoie pour complément) et ne remet AUCUN horodatage à zéro. Un
 * `a_monter` qui porte `envoyeAt` est une demande en cours chez un financeur :
 * la refermer d'office supprimait, côté console, une instruction réelle — par un
 * `editor` qui n'a même pas l'habilitation de la clore à la main.
 *
 * Se lit sur TOUS les horodatages d'engagement de `STATUT_TIMESTAMP` (sauf
 * `closAt`, un dossier clos n'arrive jamais ici) : si l'un est posé, le dossier
 * a quitté le classeur vide, quel que soit son statut actuel.
 */
export function dossierJamaisDepose(d: {
  statut: DossierFinancementStatut;
  envoyeAt: Date | null;
  accordAt: Date | null;
  refuseAt: Date | null;
  paiementRecuAt: Date | null;
}): boolean {
  return (
    d.statut === "a_monter" &&
    d.envoyeAt === null &&
    d.accordAt === null &&
    d.refuseAt === null &&
    d.paiementRecuAt === null
  );
}

/** Libellés des statuts de dossier, pour les messages rendus à l'humain. */
export const DOSSIER_STATUT_LIBELLES: Record<DossierFinancementStatut, string> = {
  a_monter: "À monter",
  envoye: "Envoyé",
  accord_recu: "Accord reçu",
  refuse: "Refusé",
  facture: "Facturé",
  paiement_recu: "Paiement reçu",
  clos: "Clos",
};

/**
 * Le RETOUR de l'ouverture automatique : referme les dossiers JAMAIS DÉPOSÉS d'une
 * session qui n'a plus de financeur à suivre (cf. `financementRefermeLesDossiers`).
 *
 * - `a_monter` jamais déposé (`dossierJamaisDepose`) → `clos` par la machine à
 *   états (verrou optimiste compris) : un classeur vide se referme comme il s'est
 *   ouvert, sans humain. Jamais supprimé. `onClos` est appelé APRÈS CHAQUE
 *   fermeture — le journal suit la base, pas la boucle : si le suivant lève, ce
 *   qui est déjà clos reste tracé.
 * - Tout autre dossier ouvert — y compris un `a_monter` déjà déposé puis renvoyé —
 *   engage l'organisme auprès d'un financeur : il n'est JAMAIS touché ici. Il est
 *   rendu à l'appelant, qui doit le dire en clair.
 * - `clos` : exclu de la lecture.
 */
export async function refermerDossiersAMonter(
  sessionId: string,
  onClos: (dossierId: string) => Promise<void>,
): Promise<{
  clos: string[];
  engages: Array<{ id: string; statut: DossierFinancementStatut; depose: boolean }>;
}> {
  const dossiers = await prisma.dossierFinancement.findMany({
    where: { trainingSessionId: sessionId, statut: { not: "clos" } },
    select: {
      id: true,
      statut: true,
      envoyeAt: true,
      accordAt: true,
      refuseAt: true,
      paiementRecuAt: true,
    },
  });

  const clos: string[] = [];
  const engages: Array<{ id: string; statut: DossierFinancementStatut; depose: boolean }> = [];
  for (const d of dossiers) {
    if (dossierJamaisDepose(d)) {
      await transitionnerDossier({ dossierId: d.id, vers: "clos" });
      clos.push(d.id);
      await onClos(d.id);
    } else {
      engages.push({ id: d.id, statut: d.statut, depose: d.statut === "a_monter" });
    }
  }
  return { clos, engages };
}
