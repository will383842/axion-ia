/**
 * Réseau d'apporteurs (démarrage manuel) — les COMMISSIONS.
 *
 * Elles naissent dans le passage quotidien (`passage-quotidien.ts`) ; la console les
 * qualifie (formation : choix du palier), les regroupe en relevé mensuel et les marque
 * versées. Montants en centimes, arrondis au centime inférieur (`regles.ts`).
 *
 * Autofacture : numéro de série `AXI-APP-AAAA-NNNN`, UN numéro par relevé (toutes les
 * lignes versées ensemble le partagent). Le PDF n'est PAS généré ici :
 * `genererPdfAutofactureTODO` est le point de branchement, et l'e-mail part sans pièce
 * jointe tant qu'il rend `null`.
 */

// ⚠️ Atteint par le WORKER (passage quotidien, tsx hors Next) : aucun `server-only` ici.

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import type { StatutCommissionApporteur } from "../../../prisma/generated/client";

import { envoyer, type ResultatEnvoi } from "./envois";
import { urlDossier } from "./jeton";
import {
  calculerCommission,
  etatVigilance,
  euros,
  PALIERS_FORMATION,
  PARRAINAGE_BPS,
  releveEmis,
} from "./regles";

// ── Vigilance ────────────────────────────────────────────────────────────

/** Statuts qui comptent dans le cumul de vigilance (contrat art. 5.4). */
export const STATUTS_CUMUL: readonly StatutCommissionApporteur[] = ["due", "versee", "en_attente_vigilance"];

/** Pièces courantes `vigilance` ET `immatriculation` conformes, l'attestation non expirée. */
export function piecesVigilanceConformes(
  pieces: ReadonlyArray<{ type: string; statut: string; expireAt: Date | null; remplaceeAt: Date | null }>,
  maintenant: Date,
): boolean {
  const courantes = pieces.filter((p) => p.remplaceeAt === null && p.statut === "conforme");
  const vigilance = courantes.some(
    (p) => p.type === "vigilance" && p.expireAt !== null && p.expireAt.getTime() > maintenant.getTime(),
  );
  const immatriculation = courantes.some((p) => p.type === "immatriculation");
  return vigilance && immatriculation;
}

export async function piecesVigilanceValides(apporteurId: string, maintenant: Date): Promise<boolean> {
  const pieces = await prisma.pieceApporteur.findMany({
    where: { apporteurId, type: { in: ["vigilance", "immatriculation"] }, remplaceeAt: null },
    select: { type: true, statut: true, expireAt: true, remplaceeAt: true },
  });
  return piecesVigilanceConformes(pieces, maintenant);
}

export async function cumulVigilanceCents(apporteurId: string, saufId?: string): Promise<number> {
  const r = await prisma.commissionApporteur.aggregate({
    where: { apporteurId, statut: { in: [...STATUTS_CUMUL] }, ...(saufId ? { id: { not: saufId } } : {}) },
    _sum: { montantCents: true },
  });
  return r._sum.montantCents ?? 0;
}

/** Un e-mail de la journée est-il déjà parti (ou en route) sous ce `jobId` ? */
export async function dejaEnvoye(jobId: string): Promise<boolean> {
  const n = await prisma.emailLog.count({ where: { jobId, status: { not: "failed" } } });
  return n > 0;
}

export type VarianteVigilance = "premiere" | "renouvellement";

/** Clé « une fois » de la demande de pièces. */
export function jobIdVigilance(apporteurId: string, variante: VarianteVigilance, echeance?: Date): string {
  return variante === "premiere"
    ? `apporteur-vigilance-premiere-${apporteurId}`
    : `apporteur-vigilance-renouvellement-${apporteurId}-${(echeance ?? new Date(0)).toISOString().slice(0, 10)}`;
}

/** Demande les pièces de vigilance, UNE fois par clé. */
export async function demanderVigilance(
  apporteurId: string,
  variante: VarianteVigilance,
  echeance?: Date,
): Promise<ResultatEnvoi | "deja"> {
  const jobId = jobIdVigilance(apporteurId, variante, echeance);
  if (await dejaEnvoye(jobId)) return "deja";
  const a = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { id: true, prenom: true, nom: true, email: true, versionLien: true },
  });
  if (!a) return "indisponible";
  const dossierUrl = urlDossier(a.id, a.versionLien);
  return envoyer({
    gabarit: "apporteur-vigilance",
    destinataire: decryptPii(a.email) ?? "",
    payload: {
      contactName: [decryptPii(a.prenom), decryptPii(a.nom)].filter(Boolean).join(" "),
      ...(dossierUrl ? { dossierUrl } : {}),
      variante,
    },
    entityType: "ApporteurReseau",
    entityId: a.id,
    jobId,
  });
}

/**
 * Statut d'une commission CALCULÉE au regard de la vigilance, et faut-il demander les pièces.
 */
export async function statutApresVigilance(
  apporteurId: string,
  montantCents: number,
  maintenant: Date,
  saufId?: string,
): Promise<{ statut: "due" | "en_attente_vigilance"; demander: boolean }> {
  const [cumul, valides] = await Promise.all([
    cumulVigilanceCents(apporteurId, saufId),
    piecesVigilanceValides(apporteurId, maintenant),
  ]);
  const v = etatVigilance({ cumulCents: cumul, nouvelleCents: montantCents, piecesValides: valides });
  return { statut: v.attendre ? "en_attente_vigilance" : "due", demander: v.demander };
}

// ── Qualifier une formation ──────────────────────────────────────────────

export async function qualifierCommission(
  id: string,
  palier: string,
  maintenant: Date = new Date(),
): Promise<{ ok: true; montantCents: number } | { ok: false; message: string }> {
  if (!PALIERS_FORMATION.some((p) => p.id === palier)) return { ok: false, message: "Palier inconnu." };
  const c = await prisma.commissionApporteur.findUnique({
    where: { id },
    select: { id: true, apporteurId: true, factureId: true, parrainage: true, activite: true, factureHtCents: true, statut: true },
  });
  if (!c) return { ok: false, message: "Commission introuvable." };
  if (c.statut !== "a_qualifier" || c.parrainage) return { ok: false, message: "Cette commission n'est pas à qualifier." };
  if (c.activite !== "formation") return { ok: false, message: "Seule une formation se qualifie par palier." };
  const calc = calculerCommission({ activite: "formation", factureHtCents: c.factureHtCents, palier });
  if (calc.statut !== "calculee") return { ok: false, message: "Calcul impossible pour ce palier." };
  const v = await statutApresVigilance(c.apporteurId, calc.montantCents, maintenant, c.id);
  const r = await prisma.commissionApporteur.updateMany({
    where: { id, statut: "a_qualifier" },
    data: { palier: calc.palier, prixPublicHtCents: calc.prixPublicCents, montantCents: calc.montantCents, statut: v.statut },
  });
  if (r.count !== 1) return { ok: false, message: "Cette commission vient d'être qualifiée." };
  if (v.demander) await demanderVigilance(c.apporteurId, "premiere");
  await qualifierPartParrainage(c.factureId, c.apporteurId, calc.montantCents, maintenant);
  return { ok: true, montantCents: calc.montantCents };
}

/** La part du parrain, restée « à qualifier » avec la commission du filleul. */
async function qualifierPartParrainage(
  factureId: string,
  filleulId: string,
  montantFilleulCents: number,
  maintenant: Date,
): Promise<void> {
  const filleul = await prisma.apporteurReseau.findUnique({
    where: { id: filleulId },
    select: { parrainId: true },
  });
  if (!filleul?.parrainId) return;
  const part = await prisma.commissionApporteur.findUnique({
    where: { factureId_apporteurId_parrainage: { factureId, apporteurId: filleul.parrainId, parrainage: true } },
    select: { id: true, statut: true, apporteurId: true },
  });
  if (!part || part.statut !== "a_qualifier") return;
  // La fenêtre de 6 mois a déjà été vérifiée à la création de la ligne.
  const montant = Math.floor((montantFilleulCents * PARRAINAGE_BPS) / 10_000);
  const v = await statutApresVigilance(part.apporteurId, montant, maintenant, part.id);
  await prisma.commissionApporteur.updateMany({
    where: { id: part.id, statut: "a_qualifier" },
    data: { montantCents: montant, statut: v.statut },
  });
  if (v.demander) await demanderVigilance(part.apporteurId, "premiere");
}

// ── Lecture pour la console ──────────────────────────────────────────────

export interface CommissionVue {
  id: string;
  apporteurId: string;
  apporteur: string;
  entreprise: string | null;
  factureNumero: string | null;
  parrainage: boolean;
  activite: string;
  palier: string | null;
  factureHtCents: number;
  montantCents: number | null;
  statut: StatutCommissionApporteur;
  releveMois: string | null;
  autofactureNumero: string | null;
  verseeAt: Date | null;
  creeAt: Date;
}

export async function lireCommissions(statut: StatutCommissionApporteur | null): Promise<CommissionVue[]> {
  const lignes = await prisma.commissionApporteur.findMany({
    where: statut ? { statut } : {},
    orderBy: { creeAt: "desc" },
    take: 500,
    include: {
      apporteur: { select: { prenom: true, nom: true } },
      presentation: { select: { denomination: true } },
    },
  });
  const factures = await prisma.factureFormation.findMany({
    where: { id: { in: [...new Set(lignes.map((l) => l.factureId))] } },
    select: { id: true, numero: true },
  });
  const numero = new Map(factures.map((f) => [f.id, f.numero]));
  return lignes.map((l) => ({
    id: l.id,
    apporteurId: l.apporteurId,
    apporteur: [decryptPii(l.apporteur.prenom), decryptPii(l.apporteur.nom)].filter(Boolean).join(" "),
    entreprise: l.presentation?.denomination ?? null,
    factureNumero: numero.get(l.factureId) ?? null,
    parrainage: l.parrainage,
    activite: l.activite,
    palier: l.palier,
    factureHtCents: l.factureHtCents,
    montantCents: l.montantCents,
    statut: l.statut,
    releveMois: l.releveMois,
    autofactureNumero: l.autofactureNumero,
    verseeAt: l.verseeAt,
    creeAt: l.creeAt,
  }));
}

export async function compterCommissions(): Promise<Record<StatutCommissionApporteur, number>> {
  const g = await prisma.commissionApporteur.groupBy({ by: ["statut"], _count: { _all: true } });
  const out: Record<StatutCommissionApporteur, number> = {
    a_qualifier: 0,
    due: 0,
    en_attente_vigilance: 0,
    versee: 0,
    reprise: 0,
  };
  for (const x of g) out[x.statut] = x._count._all;
  return out;
}

// ── Relevé du mois ───────────────────────────────────────────────────────

/** « 2026-10 » en heure de Paris. */
export function moisParis(d: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" }).format(d);
  return p.slice(0, 7);
}

/** « octobre 2026 ». */
export function libelleMois(mois: string): string {
  const [a, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(a!, (m ?? 1) - 1, 15)).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export interface ReleveApporteur {
  apporteurId: string;
  apporteur: string;
  soldeCents: number;
  lignes: number;
  emis: boolean;
  /** Pourquoi pas de relevé ce mois-ci. */
  raison: string | null;
}

/** Le relevé de chaque apporteur qui a des commissions dues. */
export async function relevesDuMois(maintenant: Date = new Date()): Promise<ReleveApporteur[]> {
  const g = await prisma.commissionApporteur.groupBy({
    by: ["apporteurId"],
    where: { statut: "due", montantCents: { not: null } },
    _sum: { montantCents: true },
    _count: { _all: true },
  });
  if (g.length === 0) return [];
  const apporteurs = await prisma.apporteurReseau.findMany({
    where: { id: { in: g.map((x) => x.apporteurId) } },
    select: { id: true, prenom: true, nom: true, statut: true },
  });
  const parId = new Map(apporteurs.map((a) => [a.id, a]));
  const mois = Number(moisParis(maintenant).slice(5, 7));
  return g
    .map((x) => {
      const a = parId.get(x.apporteurId);
      const solde = x._sum.montantCents ?? 0;
      const emis = releveEmis({ soldeCents: solde, mois, dernier: a?.statut === "resilie" });
      return {
        apporteurId: x.apporteurId,
        apporteur: a ? [decryptPii(a.prenom), decryptPii(a.nom)].filter(Boolean).join(" ") : "?",
        soldeCents: solde,
        lignes: x._count._all,
        emis,
        raison: emis ? null : `sous le seuil de ${euros(5_000)} : reporté au mois suivant`,
      };
    })
    .sort((a, b) => b.soldeCents - a.soldeCents);
}

// ── Autofacture et versement ─────────────────────────────────────────────

export const PREFIXE_AUTOFACTURE = "AXI-APP";

/** Séquence d'un numéro de la série de l'année, ou `null` s'il n'en est pas. */
export function sequenceAutofacture(numero: string, annee: number): number | null {
  const m = new RegExp(`^${PREFIXE_AUTOFACTURE}-${annee}-(\\d{4,})$`).exec(numero);
  return m ? Number(m[1]) : null;
}

export function formaterAutofacture(annee: number, seq: number): string {
  return `${PREFIXE_AUTOFACTURE}-${annee}-${String(seq).padStart(4, "0")}`;
}

/**
 * Prochain numéro `AXI-APP-AAAA-NNNN` : borne haute + 1 (jamais un comptage), en lisant
 * la table ET le registre des numéros émis s'il le connaît (lecture seule, tolérante).
 */
export async function allouerNumeroAutofacture(annee: number): Promise<string> {
  const prefixe = `${PREFIXE_AUTOFACTURE}-${annee}-`;
  const lignes = await prisma.commissionApporteur.findMany({
    where: { autofactureNumero: { startsWith: prefixe } },
    select: { autofactureNumero: true },
    distinct: ["autofactureNumero"],
  });
  let registre: Array<{ numero: string }> = [];
  try {
    registre = await prisma.numeroEmis.findMany({ where: { numero: { startsWith: prefixe } }, select: { numero: true } });
  } catch {
    registre = [];
  }
  let borne = 0;
  for (const n of [...lignes.map((l) => l.autofactureNumero), ...registre.map((r) => r.numero)]) {
    const s = n ? sequenceAutofacture(n, annee) : null;
    if (s !== null && s > borne) borne = s;
  }
  return formaterAutofacture(annee, borne + 1);
}

/**
 * TODO (branchement prévu) : générer le PDF de l'autofacture, le déposer sur R2 et
 * rendre sa clé. Tant qu'il rend `null`, l'e-mail de relevé part SANS pièce jointe.
 */
export async function genererPdfAutofactureTODO(_e: {
  apporteurId: string;
  numero: string;
  releveMois: string;
  commissionIds: readonly string[];
  totalCents: number;
}): Promise<{ r2Key: string; filename: string } | null> {
  return null;
}

/**
 * « Marquer versé » : toutes les commissions DUES de l'apporteur passent en `versee`
 * sous un même numéro d'autofacture, puis le relevé part.
 */
export async function marquerVerse(
  apporteurId: string,
  maintenant: Date = new Date(),
): Promise<{ ok: true; numero: string; totalCents: number; envoi: ResultatEnvoi } | { ok: false; message: string }> {
  const apporteur = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { id: true, prenom: true, nom: true, email: true, statut: true },
  });
  if (!apporteur) return { ok: false, message: "Apporteur introuvable." };
  const releveMois = moisParis(maintenant);
  const annee = Number(releveMois.slice(0, 4));

  const resultat = await prisma.$transaction(async (tx) => {
    const dues = await tx.commissionApporteur.findMany({
      where: { apporteurId, statut: "due", montantCents: { not: null } },
      select: { id: true, montantCents: true },
    });
    const total = dues.reduce((s, d) => s + (d.montantCents ?? 0), 0);
    if (!releveEmis({ soldeCents: total, mois: Number(releveMois.slice(5, 7)), dernier: apporteur.statut === "resilie" })) {
      return { ok: false as const, message: "Pas de relevé ce mois-ci (solde nul ou sous le seuil)." };
    }
    const numero = await allouerNumeroAutofacture(annee);
    const r = await tx.commissionApporteur.updateMany({
      where: { id: { in: dues.map((d) => d.id) }, statut: "due" },
      data: { statut: "versee", verseeAt: maintenant, releveMois, autofactureNumero: numero },
    });
    if (r.count !== dues.length) throw new Error("Les commissions ont changé pendant le versement : recommence.");
    return { ok: true as const, numero, total, ids: dues.map((d) => d.id) };
  });
  if (!resultat.ok) return resultat;

  const pdf = await genererPdfAutofactureTODO({
    apporteurId,
    numero: resultat.numero,
    releveMois,
    commissionIds: resultat.ids,
    totalCents: resultat.total,
  });
  const envoi = await envoyer({
    gabarit: "apporteur-releve",
    destinataire: decryptPii(apporteur.email) ?? "",
    payload: {
      contactName: [decryptPii(apporteur.prenom), decryptPii(apporteur.nom)].filter(Boolean).join(" "),
      mois: libelleMois(releveMois),
      montant: euros(resultat.total),
      numeroAutofacture: resultat.numero,
    },
    entityType: "ApporteurReseau",
    entityId: apporteurId,
    jobId: `apporteur-releve-${resultat.numero}`,
    ...(pdf ? { attachments: [{ filename: pdf.filename, r2Key: pdf.r2Key, contentType: "application/pdf" }] } : {}),
  });
  return { ok: true, numero: resultat.numero, totalCents: resultat.total, envoi };
}

// ── Export annuel (DAS2) ─────────────────────────────────────────────────

function champCsv(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function centimesCsv(c: number): string {
  return (c / 100).toFixed(2).replace(".", ",");
}

export interface LigneDas2 {
  denomination: string | null;
  siren: string | null;
  nom: string;
  adresse: string | null;
  totalCents: number;
  lignes: number;
}

export function construireCsvDas2(annee: number, lignes: readonly LigneDas2[]): string {
  const entete = ["annee", "beneficiaire", "denomination", "siren", "adresse", "montant_verse_eur", "nombre_commissions"];
  const corps = lignes.map((l) =>
    [annee, l.nom, l.denomination, l.siren, l.adresse, centimesCsv(l.totalCents), l.lignes].map(champCsv).join(";"),
  );
  return `﻿${[entete.join(";"), ...corps].join("\r\n")}\r\n`;
}

/** Commissions VERSÉES dans l'année civile (Paris approximée en UTC), par apporteur. */
export async function exportDas2(annee: number): Promise<string> {
  const g = await prisma.commissionApporteur.groupBy({
    by: ["apporteurId"],
    where: {
      statut: "versee",
      verseeAt: { gte: new Date(Date.UTC(annee, 0, 1) - 3_600_000), lt: new Date(Date.UTC(annee + 1, 0, 1) - 3_600_000) },
    },
    _sum: { montantCents: true },
    _count: { _all: true },
  });
  const apporteurs = await prisma.apporteurReseau.findMany({
    where: { id: { in: g.map((x) => x.apporteurId) } },
    select: { id: true, prenom: true, nom: true, denomination: true, siren: true, adresse: true },
  });
  const parId = new Map(apporteurs.map((a) => [a.id, a]));
  const lignes: LigneDas2[] = g.map((x) => {
    const a = parId.get(x.apporteurId);
    return {
      denomination: a?.denomination ?? null,
      siren: a?.siren ?? null,
      nom: a ? [decryptPii(a.prenom), decryptPii(a.nom)].filter(Boolean).join(" ") : "",
      adresse: a?.adresse ?? null,
      totalCents: x._sum.montantCents ?? 0,
      lignes: x._count._all,
    };
  });
  lignes.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  return construireCsvDas2(annee, lignes);
}
