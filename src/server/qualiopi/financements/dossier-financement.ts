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
import { opcoLabel } from "./opco-referentiel";
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
  montantHtCents: true,
  financementType: true,
  opcoSubrogation: true,
  numeroDossierOpco: true,
  priseEnChargeMontantCents: true,
  edofVerifieAt: true,
  ftDispositif: true,
  client: { select: { id: true, raisonSociale: true, opcoIdentifie: true } },
  // 🔴 T4a — les inscriptions décident des payeurs en inter-entreprises. Les
  // abandons et exclusions sont hors périmètre : on ne réclame pas le siège de
  // quelqu'un qui n'a pas suivi l'action.
  enrollments: {
    where: { statut: { notIn: ["abandon", "exclu"] } },
    select: {
      financementType: true,
      clientId: true,
      numeroDossierOpco: true,
      edofVerifieAt: true,
      ftDispositif: true,
      montantHtCents: true,
      client: { select: { id: true, raisonSociale: true, opcoIdentifie: true } },
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
    priseEnChargeMontantCents: session.priseEnChargeMontantCents,
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
}): Promise<{ statut: DossierFinancementStatut }> {
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
  const { count } = await prisma.dossierFinancement.updateMany({
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
    },
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

    await prisma.$transaction([
      prisma.dossierPayeur.deleteMany({ where: { dossierId } }),
      prisma.dossierPayeur.createMany({
        data: lignes.map((l) => ({ ...l, dossierId })),
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
      },
    });
    if (!dossier || dossier.statut !== "facture") return;
    if (dossier.factures.length === 0) return;
    const toutesPayees = dossier.factures.every((f) => f.statut === "payee");
    if (!toutesPayees) return;
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
    where: { trainingSessionId: sessionId },
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

  const type =
    session.financementType === "france_travail"
      ? "france_travail"
      : session.financementType === "cpf"
        ? "cpf"
        : session.financementType === "mixte"
          ? "mixte"
          : "opco";

  const priseEnCharge = session.priseEnChargeMontantCents ?? 0;

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
      ...(session.client?.opcoIdentifie != null && (type === "opco" || type === "mixte")
        ? { financeurNom: opcoLabel(session.client.opcoIdentifie) }
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
