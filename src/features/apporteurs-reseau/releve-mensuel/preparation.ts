/**
 * Relevé mensuel des apporteurs : PRÉPARATION, recalcul, écart (lot 3c). N'ENVOIE RIEN (D7).
 *
 *  - Les cibles viennent de `lireCiblesPeriode` (statistiques.ts) : la MÊME fonction que le contrôle
 *    de complétude de l'écran. Aucune définition parallèle (une cible oubliée serait un relevé perdu).
 *  - Aucun montant n'est recalculé ici : tout vient de `calculerReleve` (calcul.ts) ; ce module
 *    écrit des centimes entiers déjà calculés.
 *  - Une transaction courte par apporteur ; tranches de 25, reprenables (« reste N ») ; le PDF est
 *    rendu et stocké à la préparation (une ligne sans PDF est une anomalie bloquante, jamais un trou
 *    silencieux).
 * Sans `server-only` (le worker l'atteint par `tsx`).
 */
import { prisma } from "@/lib/prisma";

import { signalerErreurReseau } from "../signaler";
import { calculerReleve, totauxDenormalises } from "./calcul";
import { empreinteContenu } from "./empreinte";
import { lireEntreeReleve } from "./lecture";
import { creerReleveNumerote } from "./numerotation";
import { exigerPeriodeClose } from "./periode";
import { rendreEtStockerPdfReleve, type EnteteReleve } from "./pdf";
import {
  anomaliesDePeriode,
  lireCiblesPeriode,
  lireVuePeriode,
  type AnomalieEcran,
} from "./statistiques";
import type { ContenuReleveV1 } from "./types";

import type { Prisma } from "../../../../prisma/generated/client";

export const TAILLE_TRANCHE_PREPARATION = 25;

export interface ResultatTranche {
  periode: string;
  /** Apporteurs attendus (définition de `lireCiblesPeriode`). */
  cibles: number;
  crees: number;
  dejaPrepares: number;
  /** Cibles encore sans relevé après cette tranche. */
  reste: number;
  echecs: Array<{ apporteurId: string; message: string }>;
  /** Anomalies NON bloquantes du calcul (pièce sans totaux, règle inconnue…). */
  anomaliesCalcul: number;
}

export const cleR2Releve = (apporteurId: string, numero: string, empreinte: string): string =>
  `apporteurs/releves/${apporteurId}/${numero}-${empreinte.slice(0, 8)}.pdf`;

type Nom = { prenom: string; nom: string; denomination: string | null };
const nomDe = (a: Nom): string => a.denomination || `${a.prenom} ${a.nom}`.trim() || "Apporteur";

/** Contenu → colonnes de la ligne (centimes entiers lus sur `contenu`, via `totauxDenormalises`). */
export function colonnesDeContenu(contenu: ContenuReleveV1) {
  const t = totauxDenormalises(contenu);
  return {
    contenu: contenu as unknown as Prisma.InputJsonValue,
    empreinteSha256: empreinteContenu(contenu),
    nbLignes: t.nbLignes,
    facturesHtCents: t.facturesHtCents,
    avoirsHtCents: t.avoirsHtCents,
    viresTtcCents: t.viresTtcCents,
    enAttenteHtCents: t.enAttenteHtCents,
    cumulAnneeHtCents: t.cumulAnneeHtCents,
  };
}

export async function entetePdf(
  apporteurId: string,
  numero: string,
  rectifie?: EnteteReleve["rectifie"],
): Promise<EnteteReleve> {
  const a = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { prenom: true, nom: true, denomination: true },
  });
  return { numero, destinataire: a ? nomDe(a) : "Apporteur", ...(rectifie ? { rectifie } : {}) };
}

type Issue = "cree" | "deja_prepare";

async function preparerUn(
  apporteurId: string,
  periode: string,
  maintenant: Date,
): Promise<{ issue: Issue; anomalies: number }> {
  const entree = await lireEntreeReleve(apporteurId, periode, maintenant);
  const { contenu, anomalies } = calculerReleve(entree);
  const colonnes = colonnesDeContenu(contenu);
  const creation = await creerReleveNumerote(periode, {
    apporteurId,
    coupureAt: new Date(contenu.coupureAt),
    prepareAt: maintenant,
    ...colonnes,
  });
  if (creation.statut === "deja_prepare") return { issue: "deja_prepare", anomalies: 0 };
  // Le PDF est rendu À LA PRÉPARATION : l'écran de vérification montre celui qui partira.
  const entete = await entetePdf(apporteurId, creation.numero);
  const pdf = await rendreEtStockerPdfReleve(
    contenu,
    cleR2Releve(apporteurId, creation.numero, colonnes.empreinteSha256),
    entete,
  );
  await prisma.releveMensuelApporteur.updateMany({
    where: { id: creation.id, statut: "prepare" },
    data: { pdfR2Key: pdf.r2Key, pdfSha256: pdf.sha256 },
  });
  return { issue: "cree", anomalies: anomalies.length };
}

/**
 * Prépare UNE TRANCHE de relevés manquants de la période (close seulement). Reprenable : un nouvel
 * appel traite les cibles encore sans relevé et rend « reste N ».
 */
export async function preparerTranche(
  periode: string,
  maintenant: Date = new Date(),
  taille: number = TAILLE_TRANCHE_PREPARATION,
): Promise<ResultatTranche> {
  exigerPeriodeClose(periode, maintenant);
  // LA fonction de ciblage du contrôle de complétude : jamais une définition parallèle.
  const cibles = await lireCiblesPeriode(periode, false);
  const existants = await prisma.releveMensuelApporteur.findMany({
    where: { periode, rang: 0 },
    select: { apporteurId: true },
  });
  const deja = new Set(existants.map((r) => r.apporteurId));
  const manquantes = cibles.filter((c) => !deja.has(c.apporteurId));
  const tranche = manquantes.slice(0, taille);

  const r: ResultatTranche = {
    periode,
    cibles: cibles.length,
    crees: 0,
    dejaPrepares: cibles.length - manquantes.length,
    reste: 0,
    echecs: [],
    anomaliesCalcul: 0,
  };
  const echoues = new Set<string>();
  for (const c of tranche) {
    try {
      const u = await preparerUn(c.apporteurId, periode, maintenant);
      if (u.issue === "cree") r.crees += 1;
      else r.dejaPrepares += 1;
      r.anomaliesCalcul += u.anomalies;
    } catch (err) {
      // Une collision de numéro est une ANOMALIE : signalée, comptée, jamais ignorée.
      echoues.add(c.apporteurId);
      signalerErreurReseau("relevé mensuel : préparation", err);
      r.echecs.push({
        apporteurId: c.apporteurId,
        message: err instanceof Error ? err.message.slice(0, 200) : "préparation impossible",
      });
    }
  }
  r.reste = manquantes.length - tranche.length + echoues.size;
  return r;
}

/** Anomalies de COMPLÉTUDE : cible sans relevé d'origine, même fonction de ciblage que la préparation. */
export async function anomaliesDeCompletude(periode: string): Promise<AnomalieEcran[]> {
  const vue = await lireVuePeriode(periode, false);
  return anomaliesDePeriode(vue).filter((a) => a.code === "completude");
}

export type ResultatRecalcul = "recalcule" | "inchange" | "non_modifiable" | "introuvable";

/** Recalcul d'une ligne `prepare` (garde applicative ; le trigger SQL double la garde). */
export async function recalculerReleve(
  releveId: string,
  maintenant: Date = new Date(),
): Promise<ResultatRecalcul> {
  const ligne = await prisma.releveMensuelApporteur.findUnique({
    where: { id: releveId },
    select: {
      id: true,
      numero: true,
      apporteurId: true,
      periode: true,
      rang: true,
      statut: true,
      empreinteSha256: true,
      pdfR2Key: true,
      rectifieId: true,
    },
  });
  if (!ligne) return "introuvable";
  if (ligne.statut !== "prepare") return "non_modifiable";
  exigerPeriodeClose(ligne.periode, maintenant);
  const entree = await lireEntreeReleve(ligne.apporteurId, ligne.periode, maintenant);
  const { contenu } = calculerReleve(entree);
  const colonnes = colonnesDeContenu(contenu);
  const inchange = colonnes.empreinteSha256 === ligne.empreinteSha256 && ligne.pdfR2Key !== null;

  let pdf: { r2Key: string; sha256: string } | null = null;
  if (!inchange) {
    const rect = ligne.rang > 0 ? await enteteRectifie(ligne.rectifieId) : undefined;
    pdf = await rendreEtStockerPdfReleve(
      contenu,
      cleR2Releve(ligne.apporteurId, ligne.numero, colonnes.empreinteSha256),
      await entetePdf(ligne.apporteurId, ligne.numero, rect),
    );
  }
  const { count } = await prisma.releveMensuelApporteur.updateMany({
    where: { id: ligne.id, statut: "prepare" },
    data: {
      erreur: null,
      ...(inchange
        ? {}
        : { ...colonnes, pdfR2Key: pdf!.r2Key, pdfSha256: pdf!.sha256, prepareAt: maintenant }),
    },
  });
  if (count !== 1) return "non_modifiable";
  return inchange ? "inchange" : "recalcule";
}

/** « Rectifie le relevé n° … du … » : lu sur l'original. */
export async function enteteRectifie(
  rectifieId: string | null,
): Promise<EnteteReleve["rectifie"] | undefined> {
  if (!rectifieId) return undefined;
  const o = await prisma.releveMensuelApporteur.findUnique({
    where: { id: rectifieId },
    select: { numero: true, envoyeAt: true, prepareAt: true },
  });
  if (!o) return undefined;
  return { numero: o.numero, date: (o.envoyeAt ?? o.prepareAt).toISOString().slice(0, 10) };
}

export type ResultatEcart = "ecarte" | "refuse" | "motif_requis";

/** Écarte une ligne d'ORIGINE non partie (`prepare` ou `echec`), motif obligatoire. */
export async function ecarterReleve(releveId: string, motif: string): Promise<ResultatEcart> {
  const m = motif.trim().slice(0, 300);
  if (m.length < 3) return "motif_requis";
  const { count } = await prisma.releveMensuelApporteur.updateMany({
    where: { id: releveId, rang: 0, statut: { in: ["prepare", "echec"] } },
    data: { statut: "ecarte", motifEcart: m },
  });
  return count === 1 ? "ecarte" : "refuse";
}

/** Rétablit une ligne écartée (jamais partie : le trigger l'autorise). */
export async function retablirReleve(releveId: string): Promise<boolean> {
  const { count } = await prisma.releveMensuelApporteur.updateMany({
    where: { id: releveId, statut: "ecarte" },
    data: { statut: "prepare", motifEcart: null },
  });
  return count === 1;
}
