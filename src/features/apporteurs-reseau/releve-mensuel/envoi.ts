/**
 * Relevé mensuel des apporteurs : ENVOI, sur CLIC du dirigeant seulement (lot 4a, D3 et D7).
 *
 * SEUL émetteur du gabarit `apporteur-releve-mensuel`, et seulement appelé par la Server Action du
 * bouton « Envoyer les relevés à tout le monde » (`actions-envoi.ts`). Ni le worker ni aucun passage
 * automatique ne l'importe (verrouillé par `aucun-envoi-automatique.spec.ts`).
 *
 * Idempotence : un seul lot vivant par période (index partiel en base) ; prise conditionnelle de la
 * ligne (`prepare|echec` → `envoi_en_cours`) ; `jobId` déterministe ; `dejaEnvoye` avant `envoyer()`.
 * Aucun montant recalculé ici : e-mail et contrôle lisent le contenu figé (`calcul.ts`).
 * Le lot ne fait QU'ENFILER (le PDF existe déjà, rendu à la préparation).
 */
import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";

import { DELAI_CONTESTATION_APPORTEUR_JOURS, libelleMois } from "../autofacture-donnees";
import { dejaEnvoye } from "../commissions";
import { envoyer } from "../envois";
import { euros } from "../regles";
import { signalerErreurReseau } from "../signaler";
import { calculerReleve, totauxDenormalises } from "./calcul";
import { empreinteControle } from "./empreinte";
import { lireEntreeReleve } from "./lecture";
import { exigerPeriodeClose } from "./periode";
import { anomaliesDeCompletude } from "./preparation";
import { abandonnerLotsMorts, jobIdReleveMensuel, reprendreEnvoisEnCours } from "./reprise";
import { PREFIXE_ERREUR_DONNEES_MODIFIEES } from "./statistiques";
import type { ContenuReleveV1 } from "./types";

import type { Prisma } from "../../../../prisma/generated/client";

export const TAILLE_TRANCHE_ENVOI = 50;
export type ModeLot = "tous" | "echecs" | "rectificatif";

export interface ResultatLot {
  ok: boolean;
  message: string;
  nbCibles: number;
  nbEnvoyes: number;
  nbDejaEnvoyes: number;
  nbEchecs: number;
  nbBloques: number;
}

const VIDE = { nbCibles: 0, nbEnvoyes: 0, nbDejaEnvoyes: 0, nbEchecs: 0, nbBloques: 0 } as const;

/** Charge de l'e-mail : tout est LU sur le contenu figé, formaté, jamais recalculé. */
export function payloadEmailReleve(
  contenu: ContenuReleveV1,
  e: { contactName: string; pdfR2Key: string },
): Record<string, unknown> {
  const t = totauxDenormalises(contenu);
  return {
    contactName: e.contactName,
    mois: libelleMois(contenu.periode),
    totalMois: `${euros(contenu.totaux.netHtCents)} HT`,
    nombreCommissions: t.nbLignes,
    ...(t.enAttenteHtCents > 0 ? { report: `${euros(t.enAttenteHtCents)} HT` } : {}),
    aucunMouvement: contenu.aucunMouvement,
    delaiForme: `${DELAI_CONTESTATION_APPORTEUR_JOURS} jours`,
    pdfR2Key: e.pdfR2Key,
  };
}

type Issue = "envoye" | "deja_envoye" | "bloque" | "echec" | "pris_ailleurs";

interface LigneAEnvoyer {
  id: string;
  numero: string;
  apporteurId: string;
  periode: string;
  rang: number;
  statut: string;
  contenu: unknown;
  pdfR2Key: string | null;
  apporteur: { prenom: string; email: string };
}

async function bloquer(ligne: LigneAEnvoyer, erreur: string): Promise<Issue> {
  await prisma.releveMensuelApporteur.updateMany({
    where: { id: ligne.id, statut: { in: ["prepare", "echec"] } },
    data: { erreur: erreur.slice(0, 300) },
  });
  return "bloque";
}

/**
 * Une ligne en erreur n'arrête JAMAIS le lot : toute exception (dont un refus du trigger SQL ou d'une
 * contrainte CHECK) est signalée et comptée en échec ; les autres lignes continuent.
 */
async function envoyerUn(
  ligne: LigneAEnvoyer,
  lotId: string,
  declenchePar: string,
  maintenant: Date,
): Promise<Issue> {
  try {
    return await envoyerUnSansGarde(ligne, lotId, declenchePar, maintenant);
  } catch (err) {
    signalerErreurReseau("relevé mensuel : ligne en erreur", err);
    return "echec";
  }
}

async function envoyerUnSansGarde(
  ligne: LigneAEnvoyer,
  lotId: string,
  declenchePar: string,
  maintenant: Date,
): Promise<Issue> {
  const jobId = jobIdReleveMensuel(ligne.periode, ligne.rang, ligne.apporteurId);
  const gardes = {
    id: ligne.id,
    statut: { in: ["prepare", "echec"] as Array<"prepare" | "echec"> },
  };

  // Déjà parti sous ce jobId (crash entre l'enfilage et l'écriture, ou autre chemin) : on constate.
  if (await dejaEnvoye(jobId)) {
    await prisma.releveMensuelApporteur.updateMany({
      where: gardes,
      data: {
        statut: "envoye",
        // CHECK `prise_tracee` : `envoye` exige `pris_at`. Une ligne `echec` en a déjà un (le trigger
        // interdit de le réécrire) ; une ligne `prepare` n'en a pas encore : on le pose ici.
        ...(ligne.statut === "prepare" ? { prisAt: maintenant } : {}),
        envoyeAt: maintenant,
        envoyePar: declenchePar,
        emailJobId: jobId,
        lotId,
        erreur: null,
      },
    });
    return "deja_envoye";
  }

  const destinataire = decryptPii(ligne.apporteur.email);
  if (!destinataire) return bloquer(ligne, "aucune adresse e-mail");
  if (!ligne.pdfR2Key) return bloquer(ligne, "PDF non stocké");

  // Contrôle juste avant d'enfiler : mêmes événements, bornés par la coupure FIXE (D3 hors empreinte).
  try {
    const stocke = ligne.contenu as ContenuReleveV1;
    const entree = await lireEntreeReleve(ligne.apporteurId, ligne.periode, maintenant);
    const { contenu: frais } = calculerReleve(entree);
    if (empreinteControle(frais) !== empreinteControle(stocke)) {
      return bloquer(ligne, `${PREFIXE_ERREUR_DONNEES_MODIFIEES} depuis la vérification`);
    }
  } catch (err) {
    signalerErreurReseau("relevé mensuel : contrôle avant envoi", err);
    return bloquer(ligne, "contrôle avant envoi impossible");
  }

  // Prise conditionnelle : un seul preneur par ligne. Le trigger interdit de modifier `pris_at` une
  // fois rempli : seule une ligne `prepare` le pose ; une ligne `echec` le garde tel quel.
  const prise = await prisma.releveMensuelApporteur.updateMany({
    where: { id: ligne.id, statut: ligne.statut === "echec" ? "echec" : "prepare" },
    data: {
      statut: "envoi_en_cours",
      ...(ligne.statut === "echec" ? {} : { prisAt: maintenant }),
      lotId,
      erreur: null,
    },
  });
  if (prise.count !== 1) return "pris_ailleurs";

  try {
    const resultat = await envoyer({
      gabarit: "apporteur-releve-mensuel",
      destinataire,
      entityType: "ApporteurReseau",
      entityId: ligne.apporteurId,
      jobId,
      payload: payloadEmailReleve(ligne.contenu as ContenuReleveV1, {
        contactName: decryptPii(ligne.apporteur.prenom) ?? "",
        pdfR2Key: ligne.pdfR2Key,
      }),
      attachments: [
        { filename: `${ligne.numero}.pdf`, r2Key: ligne.pdfR2Key, contentType: "application/pdf" },
      ],
    });
    if (resultat === "envoye") {
      await prisma.releveMensuelApporteur.updateMany({
        where: { id: ligne.id, statut: "envoi_en_cours" },
        data: {
          statut: "envoye",
          envoyeAt: maintenant,
          envoyePar: declenchePar,
          emailJobId: jobId,
        },
      });
      return "envoye";
    }
    await prisma.releveMensuelApporteur.updateMany({
      where: { id: ligne.id, statut: "envoi_en_cours" },
      data: { statut: "echec", erreur: `envoi non parti (${resultat})` },
    });
    signalerErreurReseau("relevé mensuel : envoi non parti", new Error(resultat));
    return "echec";
  } catch (err) {
    // La ligne reste `envoi_en_cours` si l'écriture échoue : la reprise tranche sur le journal et la file.
    signalerErreurReseau("relevé mensuel : envoi", err);
    return "echec";
  }
}

/** Critère de la tranche : le lot global ne vise que les relevés d'origine ; un rectificatif part seul. */
function critere(
  o: { periode: string; mode: ModeLot; releveId?: string },
  traitees: Set<string>,
): Prisma.ReleveMensuelApporteurWhereInput {
  if (o.mode === "rectificatif") {
    return {
      periode: o.periode,
      id: o.releveId ?? "",
      rang: { gt: 0 },
      statut: { in: ["prepare", "echec"] },
    };
  }
  return {
    periode: o.periode,
    rang: 0,
    statut: o.mode === "tous" ? "prepare" : "echec",
    ...(traitees.size ? { id: { notIn: [...traitees] } } : {}),
  };
}

function lotDejaVivant(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "P2002";
}

/**
 * Envoie les relevés d'une période, à tous en même temps (D2). `tous` : les lignes d'origine
 * `prepare` ; `echecs` : les lignes d'origine `echec` (un clic « Renvoyer les échecs »).
 */
export async function envoyerLot(o: {
  periode: string;
  declenchePar: string;
  mode: ModeLot;
  /** Mode `rectificatif` : la ligne `-Rk` (rang > 0) à envoyer, et elle seule. */
  releveId?: string;
  maintenant?: Date;
}): Promise<ResultatLot> {
  const maintenant = o.maintenant ?? new Date();
  exigerPeriodeClose(o.periode, maintenant);

  // Reprise des envois interrompus, PUIS lots morts : la reprise précède l'insertion du lot.
  await reprendreEnvoisEnCours(maintenant);
  await abandonnerLotsMorts(maintenant);

  if (o.mode === "rectificatif" && !o.releveId) {
    return { ok: false, message: "Relevé rectificatif inconnu.", ...VIDE };
  }
  if (o.mode === "tous") {
    const manquants = await anomaliesDeCompletude(o.periode);
    if (manquants.length > 0) {
      return {
        ok: false,
        message: `${manquants.length} apporteur(s) attendu(s) sans relevé : préparez-les avant d'envoyer.`,
        ...VIDE,
      };
    }
  }

  let lotId: string;
  try {
    const lot = await prisma.lotReleveMensuel.create({
      data: { periode: o.periode, declenchePar: o.declenchePar },
      select: { id: true },
    });
    lotId = lot.id;
  } catch (err) {
    if (lotDejaVivant(err)) {
      return { ok: false, message: "Un envoi est déjà en cours pour cette période.", ...VIDE };
    }
    throw err;
  }

  const r: ResultatLot = { ok: true, message: "", ...VIDE };
  try {
    const traitees = new Set<string>();
    for (;;) {
      if (o.mode === "rectificatif" && traitees.size > 0) break;
      const tranche = (await prisma.releveMensuelApporteur.findMany({
        where: critere(o, traitees),
        orderBy: { numero: "asc" },
        take: TAILLE_TRANCHE_ENVOI,
        select: {
          id: true,
          numero: true,
          apporteurId: true,
          periode: true,
          rang: true,
          statut: true,
          contenu: true,
          pdfR2Key: true,
          apporteur: { select: { prenom: true, email: true } },
        },
      })) as LigneAEnvoyer[];
      if (tranche.length === 0) break;
      for (const ligne of tranche) {
        traitees.add(ligne.id);
        r.nbCibles += 1;
        const issue = await envoyerUn(ligne, lotId, o.declenchePar, maintenant);
        if (issue === "envoye") r.nbEnvoyes += 1;
        else if (issue === "deja_envoye" || issue === "pris_ailleurs") r.nbDejaEnvoyes += 1;
        else if (issue === "bloque") r.nbBloques += 1;
        else r.nbEchecs += 1;
      }
    }
  } finally {
    // Le lot se ferme TOUJOURS : un lot sans `finAt` bloquerait la période jusqu'à sa mort (15 min).
    await prisma.lotReleveMensuel.update({
      where: { id: lotId },
      data: {
        finAt: new Date(),
        nbCibles: r.nbCibles,
        nbEnvoyes: r.nbEnvoyes,
        nbDejaEnvoyes: r.nbDejaEnvoyes,
        nbEchecs: r.nbEchecs,
        nbBloques: r.nbBloques,
      },
    });
  }
  r.message =
    `${r.nbEnvoyes} relevé(s) envoyé(s)` +
    (r.nbDejaEnvoyes ? `, ${r.nbDejaEnvoyes} déjà parti(s)` : "") +
    (r.nbEchecs ? `, ${r.nbEchecs} en échec` : "") +
    (r.nbBloques ? `, ${r.nbBloques} bloqué(s)` : "") +
    ".";
  return r;
}
