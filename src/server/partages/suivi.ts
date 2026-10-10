import "server-only";

/**
 * LES FICHIERS ENVOYÉS À UN CANDIDAT — lecture et gestes de la console
 * (Candidatures unifiées L5, ADR 0065 D6).
 *
 *  - `lireFichiersEnvoyes` : les liens d'un dossier, leurs fichiers, « ouvert le… »
 *    et « téléchargé le… » (jamais « lu »), tirés du journal `liens_partage_acces` ;
 *  - `prolongerLien` : nouvelle date limite (30 jours, 7 avec des rushs) à partir
 *    d'aujourd'hui — ce qui ouvre aussi une nouvelle période pour le plafond ;
 *  - `retirerLien` / `retirerLiensCandidature` : pose `revoque_le` (un lien retiré
 *    le reste, trigger `liens_partage_reecriture_limitee`).
 *
 * ⛔ Aucune suppression : un lien se retire, il ne s'efface pas. Seule la
 * cascade d'un effacement MANUEL du dossier emporte ses liens ; le journal des
 * accès, sans clé étrangère, ne la bloque pas [B1].
 */

import { prisma } from "@/lib/prisma";

import { configPartages } from "./config";
import {
  MOTIF_RETRAIT,
  PLAFOND_TELECHARGEMENTS,
  debutPeriode,
  etatLien,
  expirationLien,
  type EtatLien,
} from "./liens";

export interface FichierEnvoye {
  readonly id: string;
  readonly titre: string;
  readonly nomFichier: string | null;
  readonly tailleOctets: number | null;
  readonly categorie: string;
  readonly nature: string;
  /** Premier téléchargement par une personne (navigateur). */
  readonly telechargeLe: Date | null;
  /** Seuls des aperçus automatiques (robots de messagerie) l'ont téléchargé. */
  readonly apercuSeulement: boolean;
  readonly telechargementsPeriode: number;
  readonly plafondAtteint: boolean;
}

export interface LienEnvoye {
  readonly id: string;
  readonly creeLe: Date;
  readonly creeParNom: string;
  readonly expireLe: Date;
  readonly revoqueLe: Date | null;
  readonly etat: EtatLien;
  /** Première ouverture de la page par une personne. */
  readonly ouvertLe: Date | null;
  readonly apercuSeulement: boolean;
  readonly fichiers: ReadonlyArray<FichierEnvoye>;
}

/** Plafond d'affichage : au-delà, la fiche le dit. */
export const LIENS_AFFICHES_MAX = 50;

export async function lireFichiersEnvoyes(applicationId: string): Promise<LienEnvoye[]> {
  if (configPartages() === null) return [];
  const liens = await prisma.lienPartage.findMany({
    where: { applicationId },
    orderBy: { creeLe: "desc" },
    take: LIENS_AFFICHES_MAX,
    select: {
      id: true,
      creeLe: true,
      creeParNom: true,
      expireLe: true,
      revoqueLe: true,
      fichiers: {
        select: {
          fichier: {
            select: {
              id: true,
              titre: true,
              nomFichier: true,
              tailleOctets: true,
              categorie: true,
              nature: true,
            },
          },
        },
      },
    },
  });
  if (liens.length === 0) return [];
  const acces = await prisma.lienPartageAcces.findMany({
    where: { lienId: { in: liens.map((l) => l.id) } },
    orderBy: { survenuLe: "asc" },
    select: { lienId: true, fichierId: true, type: true, origine: true, survenuLe: true },
  });
  const maintenant = new Date();
  return liens.map((l) => {
    const siens = acces.filter((a) => a.lienId === l.id);
    const categories = l.fichiers.map((x) => x.fichier.categorie);
    const debut = debutPeriode(l.expireLe, categories);
    const ouvertures = siens.filter((a) => a.type === "page_ouverte");
    const ouvertLe = ouvertures.find((a) => a.origine === "navigateur")?.survenuLe ?? null;
    return {
      id: l.id,
      creeLe: l.creeLe,
      creeParNom: l.creeParNom,
      expireLe: l.expireLe,
      revoqueLe: l.revoqueLe,
      etat: etatLien(l, maintenant),
      ouvertLe,
      apercuSeulement: ouvertLe === null && ouvertures.length > 0,
      fichiers: l.fichiers.map(({ fichier: f }) => {
        const dl = siens.filter((a) => a.type === "telechargement" && a.fichierId === f.id);
        const telechargeLe = dl.find((a) => a.origine === "navigateur")?.survenuLe ?? null;
        const periode = dl.filter((a) => a.survenuLe >= debut).length;
        return {
          id: f.id,
          titre: f.titre,
          nomFichier: f.nomFichier,
          tailleOctets: f.tailleOctets === null ? null : Number(f.tailleOctets),
          categorie: f.categorie,
          nature: f.nature,
          telechargeLe,
          apercuSeulement: telechargeLe === null && dl.length > 0,
          telechargementsPeriode: periode,
          plafondAtteint: periode >= PLAFOND_TELECHARGEMENTS,
        };
      }),
    };
  });
}

/** Combien de liens encore actifs pour ce dossier (proposition de retrait [I5]). */
export async function compterLiensActifs(applicationId: string): Promise<number> {
  if (configPartages() === null) return 0;
  return prisma.lienPartage.count({
    where: { applicationId, revoqueLe: null, expireLe: { gt: new Date() } },
  });
}

export type IssueGeste = { ok: true; applicationId: string } | { ok: false; erreur: string };

/** Prolonge un lien non retiré : nouvelle date limite à partir d'aujourd'hui. */
export async function prolongerLien(lienId: string): Promise<IssueGeste> {
  const l = await prisma.lienPartage.findUnique({
    where: { id: lienId },
    select: {
      applicationId: true,
      revoqueLe: true,
      fichiers: { select: { fichier: { select: { categorie: true } } } },
    },
  });
  if (!l || !l.applicationId) return { ok: false, erreur: "Lien introuvable." };
  if (l.revoqueLe !== null) {
    return {
      ok: false,
      erreur: "Ce lien a été retiré : envoyez un nouveau message avec les fichiers.",
    };
  }
  const expireLe = expirationLien(
    l.fichiers.map((x) => x.fichier.categorie),
    new Date(),
  );
  await prisma.lienPartage.update({ where: { id: lienId }, data: { expireLe } });
  return { ok: true, applicationId: l.applicationId };
}

/** Retire un lien (la page devient neutre). Sans effet sur un lien déjà retiré. */
export async function retirerLien(lienId: string): Promise<IssueGeste> {
  const l = await prisma.lienPartage.findUnique({
    where: { id: lienId },
    select: { applicationId: true, revoqueLe: true },
  });
  if (!l || !l.applicationId) return { ok: false, erreur: "Lien introuvable." };
  if (l.revoqueLe === null) {
    await prisma.lienPartage.updateMany({
      where: { id: lienId, revoqueLe: null },
      data: { revoqueLe: new Date(), motifRetrait: MOTIF_RETRAIT.manuel },
    });
  }
  return { ok: true, applicationId: l.applicationId };
}

/** Retire tous les liens encore ouverts d'un dossier ; rend leur nombre. */
export async function retirerLiensCandidature(
  applicationId: string,
  motif: string = MOTIF_RETRAIT.decision,
): Promise<number> {
  const r = await prisma.lienPartage.updateMany({
    where: { applicationId, revoqueLe: null },
    data: { revoqueLe: new Date(), motifRetrait: motif.slice(0, 200) },
  });
  return r.count;
}

/** Ce que « Depuis ma bibliothèque » propose : fichiers joignables du monde « emploi ». */
export async function fichiersPourComposeur(): Promise<
  Array<{
    id: string;
    titre: string;
    categorie: string;
    libelleCategorie: string;
    taille: number | null;
    tailleLisible: string | null;
    enAnalyse: boolean;
  }>
> {
  if (configPartages() === null) return [];
  const { listerBibliotheque } = await import("./depot");
  const { LIBELLE_CATEGORIE, categoriesProposees, tailleLisible } = await import("./regles");
  const permises = categoriesProposees("emploi") as ReadonlyArray<string>;
  const { fichiers } = await listerBibliotheque({ archives: false });
  return fichiers
    .filter(
      (f) =>
        permises.includes(f.categorie) && f.etatDepot === "disponible" && f.analyse !== "infecte",
    )
    .map((f) => ({
      id: f.id,
      titre: f.titre,
      categorie: f.categorie,
      libelleCategorie: LIBELLE_CATEGORIE[f.categorie],
      taille: f.taille,
      tailleLisible: f.taille === null ? null : tailleLisible(f.taille),
      enAnalyse: f.analyse === "en_attente",
    }));
}
