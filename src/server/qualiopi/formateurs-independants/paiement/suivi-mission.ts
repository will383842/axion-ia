/**
 * Formateurs indépendants — LE SUIVI QUOTIDIEN DU PAIEMENT PAR MISSION (lot D2, M22).
 *
 * Branche, à la suite du passage quotidien, les fonctions déjà écrites et restées
 * sans appelant :
 *   1. **rappel du brouillon mensuel** (`brouillonMensuelAPreparer`) : le 1er du
 *      mois, une alerte interne rappelle de lancer le calcul du mois écoulé.
 *      Rien n'est calculé seul : la décision 98 n'est pas arrêtée, et un calcul
 *      automatique changerait le circuit des salariés ;
 *   2. **relevé non validé** (`alerteReleveNonValide`) : à partir du 1er + N
 *      jours, une alerte interne s'il reste un relevé du mois écoulé à valider.
 *      Aucun relevé n'est validé seul (décision prise : la validation humaine de
 *      chaque relevé de mission est gardée) ;
 *   3. **trop-perçu** (`traiterTropPercu`, F54) : l'avoir d'une pièce PAYÉE
 *      s'impute sur le relevé de mission suivant encore recalculable, sous les
 *      verrous ; sans relevé suivant à 60 jours, la demande de remboursement est
 *      marquée et F54 part, une fois par avoir.
 *
 * 🔴 ÉTEINT : sans date `formateurs.passage_paiement`, rien ne se passe. Ne lève
 * jamais. Alertes et journaux : des compteurs et des numéros de pièce, aucun nom.
 */

import { prisma } from "@/lib/prisma";
import { resolveRibFacture } from "@/lib/legal-identity";
import { sendTelegram } from "@/lib/telegram";
import {
  DELAIS_TRANSACTION_SOUS_VERROU_REMUNERATION,
  prendreVerrousRemuneration,
} from "@/server/qualiopi/remuneration/verrou-remuneration";

import { totaliser } from "../argent/calcul-mission";
import { jourParis } from "../argent/dates";
import { PARAMETRES_ARGENT_FORMATEURS } from "../argent/parametres";
import { envoyer } from "../envois";
import { traiterTropPercu } from "./corrections-mission";
import { lireDateBascule } from "./lecture-passage";
import { alerteReleveNonValide, brouillonMensuelAPreparer } from "./releve-mensuel-auto";
import { montantEnTexte } from "./virement-fait-envoi";

const NOM_MOIS = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export interface BilanSuiviMission {
  readonly etat: "coupe" | "fait" | "echec";
  readonly rappelBrouillon: boolean;
  readonly alerteNonValides: number;
  readonly tropPercuImputeHtCents: number;
  readonly demandesRemboursement: number;
  readonly f54: number;
}

const VIDE = {
  rappelBrouillon: false,
  alerteNonValides: 0,
  tropPercuImputeHtCents: 0,
  demandesRemboursement: 0,
  f54: 0,
} as const;

async function alerter(body: string): Promise<void> {
  try {
    await sendTelegram({ tag: "AUTO", body });
  } catch {
    // Une alerte manquée ne défait rien.
  }
}

/** Le mois civil qui précède `maintenant` (heure de Paris). */
function moisEcoule(maintenant: Date): { year: number; month: number } {
  const [y, m] = jourParis(maintenant).split("-").map(Number) as [number, number];
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
}

/** 1 et 2 — rappels internes ; rien n'est calculé ni validé seul. */
async function rappelsMensuels(maintenant: Date): Promise<{ rappel: boolean; nonValides: number }> {
  let rappel = false;
  const brouillon = brouillonMensuelAPreparer(maintenant);
  if (brouillon !== null) {
    rappel = true;
    await alerter(
      `Relevés de ${NOM_MOIS.format(new Date(Date.UTC(brouillon.year, brouillon.month - 1, 1)))} : le mois est clos, lancez le calcul depuis « Honoraires ». Chaque relevé attend ensuite votre validation.`,
    );
  }
  const periode = moisEcoule(maintenant);
  const statuts = await prisma.trainerStatement.findMany({
    where: { periodeYear: periode.year, periodeMonth: periode.month },
    select: { statut: true },
  });
  const nonValides = statuts.filter(
    (s) => s.statut === "brouillon" || s.statut === "a_valider",
  ).length;
  if (
    alerteReleveNonValide(
      maintenant,
      statuts.map((s) => s.statut),
    )
  ) {
    await alerter(
      `${nonValides} relevé(s) de ${NOM_MOIS.format(new Date(Date.UTC(periode.year, periode.month - 1, 1)))} attendent encore votre validation (rien ne se valide seul).`,
    );
    return { rappel, nonValides };
  }
  return { rappel, nonValides: 0 };
}

/** 3 — trop-perçu, formateur par formateur, sous les verrous. */
async function tropPercus(
  maintenant: Date,
): Promise<{ imputeHtCents: number; demandes: number; f54: number }> {
  const ouverts = await prisma.trainerStatement.findMany({
    where: {
      origine: "passage_mission",
      avoirDeId: { not: null },
      statut: { not: "annule" },
      avoirDe: { statut: "paye" },
    },
    select: { trainerId: true },
    distinct: ["trainerId"],
    take: 100,
  });
  let imputeHtCents = 0;
  let demandes = 0;
  let f54 = 0;
  const aujourdhui = jourParis(maintenant);
  for (const { trainerId } of ouverts) {
    // Le relevé SUIVANT : un relevé de mission encore recalculable, le plus ancien.
    const suivant = await prisma.trainerStatement.findFirst({
      where: {
        trainerId,
        origine: "passage_mission",
        avoirDeId: null,
        statut: { in: ["brouillon", "a_valider"] },
      },
      orderBy: [{ periodeYear: "asc" }, { periodeMonth: "asc" }],
      select: { id: true, periodeYear: true, periodeMonth: true },
    });
    const b = await prisma.$transaction(async (tx) => {
      await prendreVerrousRemuneration(tx, {
        periodes: suivant ? [{ year: suivant.periodeYear, month: suivant.periodeMonth }] : [],
        trainerIds: [trainerId],
      });
      return traiterTropPercu(tx, trainerId, suivant?.id ?? null, aujourdhui, maintenant);
    }, DELAIS_TRANSACTION_SOUS_VERROU_REMUNERATION);
    imputeHtCents += b.imputeHtCents;
    demandes += b.demandesRemboursement;
    if (b.demandesRemboursement > 0)
      f54 += await envoyerDemandesRemboursement(trainerId, maintenant);
  }
  return { imputeHtCents, demandes, f54 };
}

/**
 * F54 — une fois par avoir, pour les demandes posées PAR CE PASSAGE (date égale).
 * Le reste dû est relu sur l'avoir et ses imputations ; le TTC vient de `totaliser`.
 * Les coordonnées bancaires sont celles d'AXION (celles de ses factures), jamais
 * celles d'un formateur ; elles ne vont dans aucun journal.
 */
async function envoyerDemandesRemboursement(trainerId: string, maintenant: Date): Promise<number> {
  const avoirs = await prisma.trainerStatement.findMany({
    where: { trainerId, avoirDeId: { not: null }, remboursementDemandeAt: maintenant },
    select: {
      id: true,
      numeroFacture: true,
      totalHtCents: true,
      tvaRegime: true,
      avoirDe: { select: { numeroFacture: true } },
      imputations: { where: { statut: { not: "annule" } }, select: { montantHtCents: true } },
      trainer: { select: { email: true, prenom: true } },
    },
  });
  const rib = await resolveRibFacture().catch(() => null);
  let n = 0;
  for (const a of avoirs) {
    const resteHtCents = Math.max(
      0,
      -a.totalHtCents + a.imputations.reduce((s, l) => s + l.montantHtCents, 0),
    );
    if (resteHtCents === 0) continue;
    const r = await envoyer({
      gabarit: "formateur-trop-percu",
      destinataire: a.trainer.email,
      entityType: "Trainer",
      entityId: trainerId,
      jobId: `formateur-trop-percu-${a.id}`,
      payload: {
        prenom: a.trainer.prenom,
        valeurs: {
          numéro: a.avoirDe?.numeroFacture ?? null,
          "numéro de l'avoir": a.numeroFacture,
          montant: montantEnTexte(
            totaliser([{ montantHtCents: resteHtCents }], a.tvaRegime).totalTtcCents,
          ),
          "coordonnées bancaires d'Axion":
            rib === null ? null : `${rib.titulaire} · IBAN ${rib.iban} · BIC ${rib.bic}`,
        },
      },
    }).catch(() => "indisponible" as const);
    if (r === "envoye") n += 1;
  }
  return n;
}

export async function passerSuiviMission(maintenant: Date): Promise<BilanSuiviMission> {
  try {
    const bascule = await lireDateBascule(prisma);
    if (bascule === null || jourParis(maintenant) < bascule) return { etat: "coupe", ...VIDE };
    const { rappel, nonValides } = await rappelsMensuels(maintenant);
    const t = await tropPercus(maintenant);
    return {
      etat: "fait",
      rappelBrouillon: rappel,
      alerteNonValides: nonValides,
      tropPercuImputeHtCents: t.imputeHtCents,
      demandesRemboursement: t.demandes,
      f54: t.f54,
    };
  } catch {
    return { etat: "echec", ...VIDE };
  }
}

/** Délai du rappel interne « relevé non validé », exposé pour l'écran et les tests. */
export const JOURS_ALERTE_RELEVE_NON_VALIDE = PARAMETRES_ARGENT_FORMATEURS.releveMensuelAlerteJours;
