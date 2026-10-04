/**
 * Régime de paiement OPCO d'une SESSION (chantier OPCO A3) : lit le client
 * (`Client.opco`, `Client.effectif`) et le dossier de financement OPCO ouvert,
 * puis délègue au module pur `regime-paiement-opco.ts`.
 *
 * Partagé par la page Financement (affichage) et `setFinancementSessionAction`
 * (garde) : les deux lisent le MÊME calcul.
 */

import { prisma } from "@/lib/prisma";
import { opcoDuClient } from "./opco-referentiel";
import {
  regimePaiementOpco,
  type EntreeRegimePaiement,
  type ResultatRegimePaiement,
} from "./regime-paiement-opco";

export type RegimeDeSession = ResultatRegimePaiement & {
  /** Dossier OPCO ouvert le plus récent, où s'écrit la confirmation. */
  dossierId: string | null;
  /** `DossierFinancement.subrogationConfirmeeParAccord` déjà posé. */
  confirmeParAccord: boolean;
};

type DossierLu = {
  id: string;
  type: "opco" | "france_travail" | "cpf" | "mixte";
  accordAt: Date | null;
  accordEcritLe: Date | null;
  depotFaitLe: Date | null;
  subrogationConfirmeeParAccord: boolean | null;
  payeurs: { payeurType: string }[];
};

type SessionLue = {
  client: { opco: string | null; opcoIdentifie?: string | null; effectif: number | null } | null;
  dossiersFinancement: DossierLu[];
};

/** Projection PURE de la session lue vers l'entrée du calcul. */
export function entreeRegimeDepuisSession(s: SessionLue): {
  entree: EntreeRegimePaiement;
  dossierId: string | null;
  confirmeParAccord: boolean;
} {
  const dossier = s.dossiersFinancement[0] ?? null;
  const payeursNonEntreprise =
    dossier?.payeurs.filter((p) => p.payeurType !== "entreprise").length ?? 0;
  return {
    entree: {
      opco: opcoDuClient(s.client),
      effectif: s.client?.effectif ?? null,
      cofinancement: dossier?.type === "mixte" || payeursNonEntreprise > 1,
      // Aucune donnée en base ne porte (encore) ces deux faits.
      versementVolontaire: false,
      adhesionOffreMobilites: null,
      // La date ÉCRITE sur l'accord fait foi ; à défaut, le clic en console.
      dateAccord: dossier?.accordEcritLe ?? dossier?.accordAt ?? null,
      dateDepot: dossier?.depotFaitLe ?? null,
    },
    dossierId: dossier?.id ?? null,
    confirmeParAccord: dossier?.subrogationConfirmeeParAccord === true,
  };
}

/**
 * Régime de la session. Lecture impossible → `inconnu` : la règle « inconnu =
 * avertissement, jamais blocage » s'applique, la saisie n'est pas perdue.
 */
export async function regimePaiementDeSession(sessionId: string): Promise<RegimeDeSession> {
  try {
    const s = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      select: {
        client: { select: { opco: true, opcoIdentifie: true, effectif: true } },
        dossiersFinancement: {
          where: { type: { in: ["opco", "mixte"] }, statut: { not: "clos" } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            type: true,
            accordAt: true,
            accordEcritLe: true,
            depotFaitLe: true,
            subrogationConfirmeeParAccord: true,
            payeurs: { select: { payeurType: true } },
          },
        },
      },
    });
    if (!s) throw new Error("session introuvable");
    const { entree, dossierId, confirmeParAccord } = entreeRegimeDepuisSession(s);
    return { ...regimePaiementOpco(entree), dossierId, confirmeParAccord };
  } catch {
    return {
      regime: "inconnu",
      motif: "régime non calculable (lecture du dossier impossible)",
      source: "",
      dossierId: null,
      confirmeParAccord: false,
    };
  }
}
