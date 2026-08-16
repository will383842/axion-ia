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
import type { DossierFinancementStatut, Prisma } from "../../../../prisma/generated/client";

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
  return { statut: input.vers };
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
    select: {
      id: true,
      clientId: true,
      montantHtCents: true,
      financementType: true,
      opcoSubrogation: true,
      numeroDossierOpco: true,
      priseEnChargeMontantCents: true,
      client: { select: { raisonSociale: true, opcoIdentifie: true } },
    },
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
  const resteACharge = Math.max(0, session.montantHtCents - priseEnCharge);

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
      montantDemandeCents: priseEnCharge > 0 ? priseEnCharge : session.montantHtCents,
      ...(session.clientId != null ? { clientId: session.clientId } : {}),
      trainingSessionId: session.id,
      payeurs: {
        create: session.opcoSubrogation
          ? [
              {
                payeurType: "opco_subroge",
                // Pas de garde de type ici : cette branche est déjà conditionnée
                // par `session.opcoSubrogation`, qui implique un financement OPCO.
                payeurNom: session.client?.opcoIdentifie
                  ? opcoLabel(session.client.opcoIdentifie)
                  : "OPCO",
                montantAttenduCents: priseEnCharge,
              },
              ...(resteACharge > 0
                ? [
                    {
                      payeurType: "entreprise" as const,
                      payeurNom: session.client?.raisonSociale ?? "Entreprise",
                      montantAttenduCents: resteACharge,
                    },
                  ]
                : []),
            ]
          : [
              {
                payeurType: "entreprise",
                payeurNom: session.client?.raisonSociale ?? "Entreprise",
                montantAttenduCents: session.montantHtCents,
              },
            ],
      },
    },
    select: { id: true },
  });
  return dossier;
}
