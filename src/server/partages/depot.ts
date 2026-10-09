import "server-only";

/**
 * FICHIERS PARTAGÉS — le DÉPÔT et la BIBLIOTHÈQUE (Candidatures unifiées, lot L4, ADR 0065).
 *
 * Le navigateur envoie les octets DIRECTEMENT dans R2, par morceaux de 64 Mio,
 * sur des adresses signées d'une heure ; le serveur ne voit passer aucun octet.
 * Ce module tient la ligne `fichiers_partages` et parle à R2 :
 *
 *   commencerDepot → signerMorceaux (par lots) → [navigateur : PUT] →
 *   terminerDepot (ListParts relu par le serveur, assemblage, taille revérifiée
 *   auprès du stockage) ; reprendreDepot rend les morceaux déjà reçus ;
 *   abandonnerDepot arrête l'envoi — la LIGNE reste (`abandonne`).
 *
 * 🔴 AUCUN EFFACEMENT (ordre de Will) : un fichier s'ARCHIVE et se RÉAFFICHE, il
 *    ne se supprime jamais — la base le refuse d'ailleurs (trigger AXP01). Ce
 *    module ne contient aucun `delete` et n'efface aucun objet R2.
 *
 * 🔴 ÉTEINT PAR DÉFAUT : sans configuration (`config.ts`), chaque fonction rend
 *    « pas encore activée » AVANT toute lecture ou écriture.
 *
 * Les DROITS ne sont pas ici : les actions (`src/features/bibliotheque-fichiers/actions.ts`)
 * vérifient le rôle et tracent chaque geste. Ce module reçoit l'auteur déjà vérifié.
 *
 * Antivirus : lancé depuis l'APPLICATION à la fin du dépôt, comme pour les
 * vidéos des candidats (écart au plan accepté : pas de tâche de worker). Un
 * fichier de l'équipe de plus de 200 Mo n'est pas analysé (décision 7 de Will).
 */

import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import {
  arreterEnvoiR2,
  assemblerEnvoiR2,
  fluxObjetR2,
  listerMorceauxR2,
  ouvrirEnvoiMorceauxR2,
  signerLectureR2,
  signerMorceauR2,
  tailleObjetR2,
  type CibleR2,
} from "@/lib/r2-storage";
import { analyserFlux } from "@/server/careers/clamav";

import { configPartages, raisonExtinction } from "./config";
import {
  CATEGORIES_DEPOT,
  CATEGORIES_LIEN,
  DUREE_SIGNATURE_MORCEAU_S,
  MORCEAUX_PAR_SIGNATURE,
  SEUIL_ANTIVIRUS_EQUIPE_OCTETS,
  TAILLE_MAX_EQUIPE_OCTETS,
  TAILLE_MORCEAU_OCTETS,
  cleR2Fichier,
  defautMorceaux,
  lienExterneValide,
  morceauxDejaRecus,
  nomAffichable,
  morceauHorsTaille,
  nombreMorceaux,
  tailleMorceau,
  titreParDefaut,
  typeMimeSur,
  type CategorieFichier,
} from "./regles";

export type Resultat<T> =
  { readonly ok: true; readonly valeur: T } | { readonly ok: false; readonly erreur: string };

export interface Auteur {
  readonly id: string;
  readonly nom: string;
}

/** Durée d'une adresse de téléchargement depuis la console : courte. */
export const DUREE_TELECHARGEMENT_CONSOLE_S = 5 * 60;

const refus = <T>(erreur: string): Resultat<T> => ({ ok: false, erreur });
const reussite = <T>(valeur: T): Resultat<T> => ({ ok: true, valeur });

/** La cible R2, ou la phrase qui dit pourquoi la bibliothèque est éteinte. */
function cible(): Resultat<CibleR2> {
  const c = configPartages();
  if (!c)
    return refus(
      `La bibliothèque n'est pas encore activée : ${raisonExtinction() ?? "configuration absente"}.`,
    );
  return reussite({
    accountId: c.accountId,
    bucket: c.bucket,
    accessKeyId: c.accessKeyId,
    secretAccessKey: c.secretAccessKey,
  });
}

const MSG_STOCKAGE =
  "Le stockage en ligne ne répond pas pour le moment. Réessayez dans quelques minutes.";
const MSG_INTROUVABLE = "Ce fichier est introuvable.";
const MSG_PAS_EN_COURS = "Cet envoi n'est plus en cours (terminé ou arrêté).";

// ── Commencer ───────────────────────────────────────────────────────────────

export interface DemandeDepot {
  readonly nom: string;
  readonly taille: number;
  readonly typeMime?: string | null | undefined;
  readonly categorie: string;
  readonly titre?: string | null | undefined;
  readonly dansBibliotheque?: boolean | undefined;
}

export interface DepotCommence {
  readonly fichierId: string;
  readonly tailleMorceau: number;
  readonly nombreMorceaux: number;
}

/** Contrôles purs d'une demande de dépôt (testés sans rien poser). */
export function verifierDemandeDepot(d: DemandeDepot):
  | {
      ok: true;
      nom: string;
      titre: string;
      categorie: CategorieFichier;
      taille: number;
      typeMime: string;
    }
  | { ok: false; erreur: string } {
  const nom = nomAffichable(d.nom ?? "");
  if (!nom) return { ok: false, erreur: "Le nom du fichier est vide." };
  if (!Number.isSafeInteger(d.taille) || d.taille < 1) {
    return { ok: false, erreur: "Ce fichier est vide." };
  }
  if (d.taille > TAILLE_MAX_EQUIPE_OCTETS) {
    return { ok: false, erreur: "Ce fichier dépasse 20 Go : il ne peut pas être déposé ici." };
  }
  if (!(CATEGORIES_DEPOT as ReadonlyArray<string>).includes(d.categorie)) {
    return { ok: false, erreur: "Cette catégorie ne se dépose pas depuis l'ordinateur." };
  }
  const titre = (d.titre ?? "").trim().slice(0, 200) || titreParDefaut(nom) || nom.slice(0, 200);
  return {
    ok: true,
    nom,
    titre,
    categorie: d.categorie as CategorieFichier,
    taille: d.taille,
    typeMime: typeMimeSur(d.typeMime),
  };
}

export async function commencerDepot(
  d: DemandeDepot,
  auteur: Auteur,
): Promise<Resultat<DepotCommence>> {
  const c = cible();
  if (!c.ok) return c;
  const v = verifierDemandeDepot(d);
  if (!v.ok) return refus(v.erreur);

  const id = randomUUID();
  const cle = cleR2Fichier(id, v.nom);
  let uploadId: string;
  try {
    uploadId = await ouvrirEnvoiMorceauxR2(c.valeur, cle, v.typeMime);
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "commencerDepot" } });
    return refus(MSG_STOCKAGE);
  }
  await prisma.fichierPartage.create({
    data: {
      id,
      titre: v.titre,
      nature: "fichier",
      origine: "equipe",
      categorie: v.categorie,
      dansBibliotheque: d.dansBibliotheque ?? true,
      nomFichier: v.nom,
      tailleOctets: BigInt(v.taille),
      typeMime: v.typeMime,
      r2Cle: cle,
      r2UploadId: uploadId,
      etatDepot: "en_cours",
      // Décision 7 : un fichier de l'équipe au-delà de 200 Mo n'est pas analysé.
      analyse: v.taille > SEUIL_ANTIVIRUS_EQUIPE_OCTETS ? "hors_limite" : "en_attente",
      deposeParId: auteur.id,
      deposeParNom: auteur.nom.slice(0, 200) || "Équipe",
    },
  });
  return reussite({
    fichierId: id,
    tailleMorceau: TAILLE_MORCEAU_OCTETS,
    nombreMorceaux: nombreMorceaux(v.taille),
  });
}

// ── Lire une ligne en cours ─────────────────────────────────────────────────

interface LigneEnCours {
  id: string;
  cle: string;
  uploadId: string;
  taille: number;
}

async function ligneEnCours(fichierId: string): Promise<Resultat<LigneEnCours>> {
  const f = await prisma.fichierPartage.findUnique({
    where: { id: fichierId },
    select: {
      id: true,
      nature: true,
      etatDepot: true,
      r2Cle: true,
      r2UploadId: true,
      tailleOctets: true,
    },
  });
  if (!f || f.nature !== "fichier") return refus(MSG_INTROUVABLE);
  if (f.etatDepot !== "en_cours" || !f.r2Cle || !f.r2UploadId || f.tailleOctets === null) {
    return refus(MSG_PAS_EN_COURS);
  }
  return reussite({
    id: f.id,
    cle: f.r2Cle,
    uploadId: f.r2UploadId,
    taille: Number(f.tailleOctets),
  });
}

// ── Signer des morceaux ─────────────────────────────────────────────────────

export interface MorceauSigne {
  readonly numero: number;
  readonly url: string;
}

export async function signerMorceaux(
  fichierId: string,
  numeros: ReadonlyArray<number>,
): Promise<Resultat<MorceauSigne[]>> {
  const c = cible();
  if (!c.ok) return c;
  const l = await ligneEnCours(fichierId);
  if (!l.ok) return l;
  const n = nombreMorceaux(l.valeur.taille);
  const uniques = [...new Set(numeros)];
  if (uniques.length === 0 || uniques.length > MORCEAUX_PAR_SIGNATURE) {
    return refus("Demande d'envoi invalide.");
  }
  if (uniques.some((x) => !Number.isInteger(x) || x < 1 || x > n)) {
    return refus("Demande d'envoi invalide.");
  }
  try {
    const out: MorceauSigne[] = [];
    for (const numero of uniques) {
      out.push({
        numero,
        url: await signerMorceauR2(
          c.valeur,
          l.valeur.cle,
          l.valeur.uploadId,
          numero,
          tailleMorceau(l.valeur.taille, numero),
          DUREE_SIGNATURE_MORCEAU_S,
        ),
      });
    }
    return reussite(out);
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "signerMorceaux" } });
    return refus(MSG_STOCKAGE);
  }
}

// ── Reprendre ───────────────────────────────────────────────────────────────

export interface EtatReprise {
  readonly fichierId: string;
  readonly taille: number;
  readonly tailleMorceau: number;
  readonly nombreMorceaux: number;
  /** Les morceaux déjà reçus et justes : le navigateur ne renvoie que les autres. */
  readonly recus: number[];
}

export async function reprendreDepot(fichierId: string): Promise<Resultat<EtatReprise>> {
  const c = cible();
  if (!c.ok) return c;
  const l = await ligneEnCours(fichierId);
  if (!l.ok) return l;
  try {
    const parts = await listerMorceauxR2(c.valeur, l.valeur.cle, l.valeur.uploadId);
    return reussite({
      fichierId,
      taille: l.valeur.taille,
      tailleMorceau: TAILLE_MORCEAU_OCTETS,
      nombreMorceaux: nombreMorceaux(l.valeur.taille),
      recus: morceauxDejaRecus(l.valeur.taille, parts),
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "reprendreDepot" } });
    return refus(MSG_STOCKAGE);
  }
}

// ── Terminer ────────────────────────────────────────────────────────────────

/**
 * Assemble l'envoi. Le serveur ne croit PAS le navigateur : il relit les
 * morceaux dans R2 (`ListParts`), refuse un trou ou un morceau de mauvaise
 * taille, assemble, puis REVÉRIFIE la taille de l'objet auprès du stockage.
 * Une taille différente de l'annonce → l'envoi est arrêté (`abandonne`) et
 * jamais servi.
 */
export async function terminerDepot(fichierId: string): Promise<Resultat<{ fichierId: string }>> {
  const c = cible();
  if (!c.ok) return c;
  const l = await ligneEnCours(fichierId);
  if (!l.ok) return l;
  const { cle, uploadId, taille } = l.valeur;

  let reelle: number | null;
  try {
    const parts = await listerMorceauxR2(c.valeur, cle, uploadId);
    const horsTaille = morceauHorsTaille(taille, parts);
    if (horsTaille !== null) return arreterMorceauHorsTaille(c.valeur, l.valeur, horsTaille);
    const defaut = defautMorceaux(taille, parts);
    if (defaut) return refus(`L'envoi n'est pas complet : ${defaut}. Reprenez-le.`);
    await assemblerEnvoiR2(c.valeur, cle, uploadId, parts);
    reelle = await tailleObjetR2(c.valeur, cle);
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "terminerDepot" } });
    return refus(MSG_STOCKAGE);
  }

  if (reelle !== taille) {
    await prisma.fichierPartage.update({
      where: { id: fichierId },
      data: { etatDepot: "abandonne" },
    });
    Sentry.captureMessage("[partages] taille assemblée différente de l'annonce", {
      level: "warning",
      tags: { fichierId },
    });
    return refus(
      "Le fichier reçu n'a pas la taille annoncée : l'envoi est arrêté. Recommencez-le.",
    );
  }

  await prisma.fichierPartage.update({
    where: { id: fichierId },
    data: { etatDepot: "disponible", disponibleLe: new Date() },
  });
  void analyserFichierPartage(fichierId);
  return reussite({ fichierId });
}

/**
 * Un morceau reçu n'a pas la taille attendue : chaque adresse étant signée à
 * la longueur exacte, c'est une anomalie, pas un incident de réseau. L'envoi
 * est ARRÊTÉ dans R2 et la ligne passe `abandonne` — elle reste en base,
 * rien n'est supprimé (relecture sécurité, 2026-10-08).
 */
async function arreterMorceauHorsTaille(
  c: CibleR2,
  l: LigneEnCours,
  numero: number,
): Promise<Resultat<{ fichierId: string }>> {
  try {
    await arreterEnvoiR2(c, l.cle, l.uploadId);
  } catch (e) {
    // R2 nettoie de toute façon les envois jamais terminés (règle du compartiment).
    Sentry.captureException(e, { tags: { action: "terminerDepot.horsTaille" } });
  }
  await prisma.fichierPartage.update({
    where: { id: l.id },
    data: { etatDepot: "abandonne" },
  });
  Sentry.captureMessage("[partages] morceau reçu de mauvaise taille : envoi arrêté", {
    level: "warning",
    tags: { fichierId: l.id, morceau: String(numero) },
  });
  return refus("Un morceau reçu n'a pas la taille attendue : l'envoi est arrêté. Recommencez-le.");
}

// ── Abandonner ──────────────────────────────────────────────────────────────

/**
 * Arrête un envoi. R2 libère les morceaux déjà reçus d'un fichier qui n'a
 * jamais existé en entier ; la LIGNE reste, à l'état `abandonne`.
 */
export async function abandonnerDepot(fichierId: string): Promise<Resultat<{ fichierId: string }>> {
  const c = cible();
  if (!c.ok) return c;
  const l = await ligneEnCours(fichierId);
  if (!l.ok) return l;
  try {
    await arreterEnvoiR2(c.valeur, l.valeur.cle, l.valeur.uploadId);
  } catch (e) {
    // R2 nettoie de toute façon les envois jamais terminés (règle du compartiment).
    Sentry.captureException(e, { tags: { action: "abandonnerDepot" } });
  }
  await prisma.fichierPartage.update({
    where: { id: fichierId },
    data: { etatDepot: "abandonne" },
  });
  return reussite({ fichierId });
}

// ── Lien externe ────────────────────────────────────────────────────────────

export interface DemandeLien {
  readonly url: string;
  readonly titre: string;
  readonly categorie: string;
  readonly dansBibliotheque?: boolean | undefined;
}

export async function ajouterLienExterne(
  d: DemandeLien,
  auteur: Auteur,
): Promise<Resultat<{ fichierId: string }>> {
  const c = cible();
  if (!c.ok) return c;
  const url = lienExterneValide(d.url ?? "");
  if (!url) return refus("Ce lien n'est pas accepté : il doit commencer par https://.");
  if (!(CATEGORIES_LIEN as ReadonlyArray<string>).includes(d.categorie)) {
    return refus("Catégorie inconnue.");
  }
  const titre = (d.titre ?? "").trim().slice(0, 200);
  if (!titre) return refus("Donnez un titre à ce lien.");
  const id = randomUUID();
  await prisma.fichierPartage.create({
    data: {
      id,
      titre,
      nature: "lien_externe",
      origine: "equipe",
      categorie: d.categorie as CategorieFichier,
      dansBibliotheque: d.dansBibliotheque ?? true,
      urlExterne: url,
      etatDepot: "disponible",
      disponibleLe: new Date(),
      deposeParId: auteur.id,
      deposeParNom: auteur.nom.slice(0, 200) || "Équipe",
    },
  });
  return reussite({ fichierId: id });
}

// ── Archiver / réafficher (jamais supprimer) ────────────────────────────────

export async function archiverFichier(
  fichierId: string,
  auteur: Auteur,
): Promise<Resultat<{ fichierId: string }>> {
  const c = cible();
  if (!c.ok) return c;
  const f = await prisma.fichierPartage.findUnique({
    where: { id: fichierId },
    select: { id: true, archiveLe: true },
  });
  if (!f) return refus(MSG_INTROUVABLE);
  if (f.archiveLe) return reussite({ fichierId });
  await prisma.fichierPartage.update({
    where: { id: fichierId },
    data: { archiveLe: new Date(), archiveParId: auteur.id },
  });
  return reussite({ fichierId });
}

export async function reafficherFichier(
  fichierId: string,
): Promise<Resultat<{ fichierId: string }>> {
  const c = cible();
  if (!c.ok) return c;
  const f = await prisma.fichierPartage.findUnique({
    where: { id: fichierId },
    select: { id: true, archiveLe: true, analyse: true },
  });
  if (!f) return refus(MSG_INTROUVABLE);
  if (f.analyse === "infecte") {
    return refus("L'antivirus a trouvé un risque dans ce fichier : il reste archivé.");
  }
  if (!f.archiveLe) return reussite({ fichierId });
  await prisma.fichierPartage.update({
    where: { id: fichierId },
    data: { archiveLe: null, archiveParId: null },
  });
  return reussite({ fichierId });
}

// ── Liste et volume ─────────────────────────────────────────────────────────

export interface FichierListe {
  readonly id: string;
  readonly titre: string;
  readonly nature: "fichier" | "lien_externe";
  readonly categorie: CategorieFichier;
  readonly nomFichier: string | null;
  readonly taille: number | null;
  readonly etatDepot: "en_cours" | "disponible" | "abandonne";
  readonly analyse: "en_attente" | "sain" | "infecte" | "hors_limite" | null;
  readonly urlExterne: string | null;
  readonly deposeParNom: string;
  readonly creeLe: Date;
  readonly archiveLe: Date | null;
}

export interface Bibliotheque {
  readonly fichiers: FichierListe[];
  /** Octets stockés dans R2 sous `partages/` (fichiers disponibles, archivés compris). */
  readonly volumeOctets: number;
  readonly nombreArchives: number;
}

/** Au plus, lignes affichées d'un coup. */
export const PLAFOND_LISTE = 500;

export async function listerBibliotheque(opts: { archives: boolean }): Promise<Bibliotheque> {
  const [lignes, volume, nombreArchives] = await Promise.all([
    prisma.fichierPartage.findMany({
      where: {
        dansBibliotheque: true,
        archiveLe: opts.archives ? { not: null } : null,
        // Un envoi arrêté n'a rien à montrer ; la ligne reste en base.
        etatDepot: { not: "abandonne" },
      },
      orderBy: { creeLe: "desc" },
      take: PLAFOND_LISTE,
      select: {
        id: true,
        titre: true,
        nature: true,
        categorie: true,
        nomFichier: true,
        tailleOctets: true,
        etatDepot: true,
        analyse: true,
        urlExterne: true,
        deposeParNom: true,
        creeLe: true,
        archiveLe: true,
      },
    }),
    prisma.fichierPartage.aggregate({
      where: { nature: "fichier", etatDepot: "disponible" },
      _sum: { tailleOctets: true },
    }),
    prisma.fichierPartage.count({
      where: { dansBibliotheque: true, archiveLe: { not: null }, etatDepot: { not: "abandonne" } },
    }),
  ]);
  return {
    fichiers: lignes.map((f) => ({
      id: f.id,
      titre: f.titre,
      nature: f.nature,
      categorie: f.categorie,
      nomFichier: f.nomFichier,
      taille: f.tailleOctets === null ? null : Number(f.tailleOctets),
      etatDepot: f.etatDepot,
      analyse: f.analyse,
      urlExterne: f.urlExterne,
      deposeParNom: f.deposeParNom,
      creeLe: f.creeLe,
      archiveLe: f.archiveLe,
    })),
    volumeOctets: Number(volume._sum.tailleOctets ?? BigInt(0)),
    nombreArchives,
  };
}

// ── Téléchargement depuis la console ────────────────────────────────────────

/** Un fichier se sert-il ? Disponible, et jamais sans verdict (sauf « hors limite » de l'équipe). */
export function fichierServable(f: {
  nature: string;
  etatDepot: string;
  analyse: string | null;
}): boolean {
  if (f.nature !== "fichier") return false;
  if (f.etatDepot !== "disponible") return false;
  return f.analyse === "sain" || f.analyse === "hors_limite";
}

/**
 * L'adresse où envoyer la personne : une URL R2 signée COURTE (5 min, en
 * téléchargement, au nom d'origine) pour un fichier ; l'adresse d'origine pour
 * un lien externe. `null` si rien ne se sert.
 */
export async function adresseTelechargement(
  fichierId: string,
): Promise<Resultat<{ url: string; nature: "fichier" | "lien_externe" }>> {
  const c = cible();
  if (!c.ok) return c;
  const f = await prisma.fichierPartage.findUnique({
    where: { id: fichierId },
    select: {
      nature: true,
      etatDepot: true,
      analyse: true,
      r2Cle: true,
      nomFichier: true,
      urlExterne: true,
    },
  });
  if (!f) return refus(MSG_INTROUVABLE);
  if (f.nature === "lien_externe") {
    return f.urlExterne
      ? reussite({ url: f.urlExterne, nature: "lien_externe" })
      : refus(MSG_INTROUVABLE);
  }
  if (f.analyse === "infecte") return refus("L'antivirus a trouvé un risque dans ce fichier.");
  if (f.etatDepot === "disponible" && f.analyse === "en_attente") {
    void analyserFichierPartage(fichierId);
    return refus("Ce fichier est en cours d'analyse antivirus. Réessayez dans quelques minutes.");
  }
  if (!fichierServable(f) || !f.r2Cle || !f.nomFichier)
    return refus("Ce fichier n'est pas disponible.");
  try {
    const url = await signerLectureR2(c.valeur, f.r2Cle, DUREE_TELECHARGEMENT_CONSOLE_S, {
      nom: f.nomFichier,
      disposition: "attachment",
    });
    return reussite({ url, nature: "fichier" });
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "adresseTelechargement" } });
    return refus(MSG_STOCKAGE);
  }
}

// ── Antivirus (lancé depuis l'application) ──────────────────────────────────

/** Analyses en cours dans CE processus — un fichier n'est jamais analysé deux fois en même temps. */
const analysesEnCours = new Set<string>();

/**
 * Passe un fichier disponible « en attente » à l'antivirus, en flux depuis R2
 * (rien sur le disque). Sain → `sain`. Infecté → `infecte` ET archivé, jamais
 * servi, jamais effacé. Antivirus indisponible → reste `en_attente` (jamais
 * servi sans verdict) ; `relancerAnalysesPartagesEnAttente` le reprendra.
 */
export async function analyserFichierPartage(fichierId: string): Promise<void> {
  if (analysesEnCours.has(fichierId)) return;
  analysesEnCours.add(fichierId);
  try {
    const c = cible();
    if (!c.ok) return;
    const f = await prisma.fichierPartage.findUnique({
      where: { id: fichierId },
      select: { id: true, etatDepot: true, analyse: true, r2Cle: true, tailleOctets: true },
    });
    if (!f || f.etatDepot !== "disponible" || f.analyse !== "en_attente" || !f.r2Cle) return;
    if (f.tailleOctets !== null && Number(f.tailleOctets) > SEUIL_ANTIVIRUS_EQUIPE_OCTETS) return;
    const flux = await fluxObjetR2(c.valeur, f.r2Cle);
    if (!flux) return;
    const verdict = await analyserFlux(flux);
    if (verdict.issue === "indisponible") {
      console.warn(
        `[partages] antivirus indisponible pour ${f.id} : ${verdict.raison} — reprise plus tard`,
      );
      return;
    }
    const maintenant = new Date();
    if (verdict.issue === "infecte") {
      await prisma.fichierPartage.update({
        where: { id: f.id },
        data: {
          analyse: "infecte",
          analyseLe: maintenant,
          analyseSignature: verdict.signature.slice(0, 200),
          // Archivé par la machine (sans auteur), jamais effacé.
          archiveLe: maintenant,
        },
      });
      Sentry.captureMessage(`[partages] fichier infecté archivé : ${verdict.signature}`, {
        level: "warning",
        tags: { fichierId: f.id },
      });
      return;
    }
    await prisma.fichierPartage.update({
      where: { id: f.id },
      data: { analyse: "sain", analyseLe: maintenant },
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "analyserFichierPartage" } });
  } finally {
    analysesEnCours.delete(fichierId);
  }
}

/**
 * Reprend les fichiers restés « en attente » plus de 2 minutes (redémarrage,
 * antivirus indisponible). Appelée à l'ouverture de la bibliothèque : pas de
 * tâche de fond, comme pour les vidéos des candidats.
 */
export async function relancerAnalysesPartagesEnAttente(): Promise<void> {
  if (!configPartages()) return;
  const attente = await prisma.fichierPartage
    .findMany({
      where: {
        nature: "fichier",
        etatDepot: "disponible",
        analyse: "en_attente",
        disponibleLe: { lt: new Date(Date.now() - 120_000) },
      },
      select: { id: true },
      take: 20,
    })
    .catch(() => [] as Array<{ id: string }>);
  for (const f of attente) void analyserFichierPartage(f.id);
}
