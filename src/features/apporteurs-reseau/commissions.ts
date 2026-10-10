/**
 * Réseau d'apporteurs (démarrage manuel) — les COMMISSIONS.
 *
 * Elles naissent dans le passage (`passage-quotidien.ts`) ; la console les qualifie
 * (formation : choix du palier). Dès qu'une commission est DUE, `facturation.ts` établit
 * l'autofacture et l'envoie ; « Virement fait » la marque versée. Montants en centimes,
 * arrondis au centime inférieur (`regles.ts`).
 *
 * Autofacture : numéro de série `AXI-APP-AAAA-NNNN`, UN numéro par apporteur et par passe
 * (toutes les lignes facturées ensemble le partagent). Le PDF est généré par
 * `genererPdfAutofacture` ; s'il rend `null`, rien n'est écrit (pas de facture sans pièce).
 */

// ⚠️ Atteint par le WORKER (passage quotidien, tsx hors Next) : aucun `server-only` ici.

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import type { StatutCommissionApporteur } from "../../../prisma/generated/client";

import {
  construireDonneesAutofacture,
  totalTtcPieceCents,
  type ApporteurPourAutofacture,
} from "./autofacture-donnees";
import { PREFIXE_PALIER_REPRISE } from "./resiliation";
import { siretDe, siretsDe } from "./siret-apporteur";
import { envoyer, type ResultatEnvoi } from "./envois";
import { urlDossier } from "./jeton";
import { signalerErreurReseau } from "./signaler";
import {
  calculerCommission,
  etatVigilance,
  euros,
  PALIER_CONFERENCE,
  PALIERS_FORMATION,
  PARRAINAGE_BPS,
} from "./regles";

type RegimeApporteur = ApporteurPourAutofacture["regimeTva"];

// ── Vigilance ────────────────────────────────────────────────────────────

/** Statuts qui comptent dans le cumul de vigilance (contrat art. 5.4). */
export const STATUTS_CUMUL: readonly StatutCommissionApporteur[] = [
  "due",
  "versee",
  "en_attente_vigilance",
];

/** Pièces courantes `vigilance` ET `immatriculation` conformes, l'attestation non expirée. */
export function piecesVigilanceConformes(
  pieces: ReadonlyArray<{
    type: string;
    statut: string;
    expireAt: Date | null;
    remplaceeAt: Date | null;
  }>,
  maintenant: Date,
): boolean {
  const courantes = pieces.filter((p) => p.remplaceeAt === null && p.statut === "conforme");
  const vigilance = courantes.some(
    (p) =>
      p.type === "vigilance" && p.expireAt !== null && p.expireAt.getTime() > maintenant.getTime(),
  );
  const immatriculation = courantes.some((p) => p.type === "immatriculation");
  return vigilance && immatriculation;
}

export async function piecesVigilanceValides(
  apporteurId: string,
  maintenant: Date,
): Promise<boolean> {
  const pieces = await prisma.pieceApporteur.findMany({
    where: { apporteurId, type: { in: ["vigilance", "immatriculation"] }, remplaceeAt: null },
    select: { type: true, statut: true, expireAt: true, remplaceeAt: true },
  });
  return piecesVigilanceConformes(pieces, maintenant);
}

/** Relances de la demande de pièces : une tous les 15 jours après le dernier envoi, trois au plus. */
export const RELANCE_VIGILANCE_JOURS = 15;
export const RELANCES_VIGILANCE_MAX = 3;

/**
 * Quelle relance envoyer maintenant ? `envoisAt` = dates d'envoi de la demande initiale puis
 * de chaque relance déjà partie (ordre chronologique). Rend le numéro de la relance (1 à 3), ou
 * `null` : rien n'est parti, le délai n'est pas écoulé, ou les trois relances sont faites. Pur.
 */
export function relanceVigilanceDue(envoisAt: readonly Date[], maintenant: Date): 1 | 2 | 3 | null {
  if (envoisAt.length === 0 || envoisAt.length > RELANCES_VIGILANCE_MAX) return null;
  const dernier = Math.max(...envoisAt.map((d) => d.getTime()));
  if (maintenant.getTime() < dernier + RELANCE_VIGILANCE_JOURS * 86_400_000) return null;
  return envoisAt.length as 1 | 2 | 3;
}

/** Clé « une fois » d'une relance : une par numéro. */
export function jobIdRelanceVigilance(apporteurId: string, numero: 1 | 2 | 3): string {
  return `apporteur-vigilance-relance-${apporteurId}-${numero}`;
}

/** Envoi de la demande initiale et des relances déjà parties, dans l'ordre. */
async function envoisDemandeVigilance(apporteurId: string): Promise<Date[]> {
  const l = await prisma.emailLog.findMany({
    where: {
      template: "apporteur-vigilance",
      entityType: "ApporteurReseau",
      entityId: apporteurId,
      sentAt: { not: null },
      status: { not: "failed" },
      OR: [
        { jobId: jobIdVigilance(apporteurId, "premiere") },
        { jobId: { startsWith: `apporteur-vigilance-relance-${apporteurId}-` } },
      ],
    },
    select: { sentAt: true },
    orderBy: { sentAt: "asc" },
  });
  return l.map((x) => x.sentAt).filter((d): d is Date => d instanceof Date);
}

/**
 * Relance la demande de pièces si elle est due (et qu'aucune pièce n'attend déjà la vérification
 * de Williams). Même gabarit que la demande initiale. Rend vrai si une relance est partie.
 */
export async function relancerVigilance(apporteurId: string, maintenant: Date): Promise<boolean> {
  const numero = relanceVigilanceDue(await envoisDemandeVigilance(apporteurId), maintenant);
  if (numero === null) return false;
  const enAttente = await prisma.pieceApporteur.count({
    where: {
      apporteurId,
      type: { in: ["vigilance", "immatriculation"] },
      statut: "deposee",
      remplaceeAt: null,
      purgeeAt: null,
    },
  });
  if (enAttente > 0) return false;
  const jobId = jobIdRelanceVigilance(apporteurId, numero);
  if (await dejaEnvoye(jobId)) return false;
  const a = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { id: true, prenom: true, nom: true, email: true, versionLien: true },
  });
  if (!a) return false;
  const dossierUrl = urlDossier(a.id, a.versionLien);
  const r = await envoyer({
    gabarit: "apporteur-vigilance",
    destinataire: decryptPii(a.email) ?? "",
    payload: {
      contactName: [decryptPii(a.prenom), decryptPii(a.nom)].filter(Boolean).join(" "),
      ...(dossierUrl ? { dossierUrl } : {}),
      variante: "premiere",
    },
    entityType: "ApporteurReseau",
    entityId: a.id,
    jobId,
  });
  return r === "envoye";
}

/**
 * Libère les commissions en attente dès que les pièces sont conformes — appelée au jugement de la
 * pièce par Williams, pas au passage du lendemain. Rend le nombre de commissions libérées.
 */
export async function libererSiPiecesValides(
  apporteurId: string,
  maintenant: Date = new Date(),
): Promise<number> {
  if (!(await piecesVigilanceValides(apporteurId, maintenant))) return 0;
  const r = await prisma.commissionApporteur.updateMany({
    where: { apporteurId, statut: "en_attente_vigilance" },
    data: { statut: "due" },
  });
  return r.count;
}

export async function cumulVigilanceCents(apporteurId: string, saufId?: string): Promise<number> {
  const r = await prisma.commissionApporteur.aggregate({
    where: {
      apporteurId,
      statut: { in: [...STATUTS_CUMUL] },
      ...(saufId ? { id: { not: saufId } } : {}),
    },
    _sum: { montantCents: true },
  });
  const ht = r._sum.montantCents ?? 0;
  // Art. 6.2 (analyse du 09/10) : la Société apprécie le cumul TOUTES TAXES COMPRISES, par
  // prudence. Un apporteur en franchise : TTC = HT. Régime illisible : le HT (comportement d'avant).
  try {
    const a = await prisma.apporteurReseau.findUnique({
      where: { id: apporteurId },
      select: { regimeTva: true },
    });
    return totalTtcPieceCents((a?.regimeTva ?? null) as RegimeApporteur, [ht]);
  } catch {
    return ht;
  }
}

/** Un e-mail de la journée est-il déjà parti (ou en route) sous ce `jobId` ? */
export async function dejaEnvoye(jobId: string): Promise<boolean> {
  const n = await prisma.emailLog.count({ where: { jobId, status: { not: "failed" } } });
  return n > 0;
}

export type VarianteVigilance = "premiere" | "renouvellement";

/** Clé « une fois » de la demande de pièces. */
export function jobIdVigilance(
  apporteurId: string,
  variante: VarianteVigilance,
  echeance?: Date,
): string {
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
  const v = etatVigilance({
    cumulCents: cumul,
    nouvelleCents: montantCents,
    piecesValides: valides,
  });
  return { statut: v.attendre ? "en_attente_vigilance" : "due", demander: v.demander };
}

// ── Qualifier une formation ──────────────────────────────────────────────

export async function qualifierCommission(
  id: string,
  palier: string,
  quantite: number = 1,
  maintenant: Date = new Date(),
): Promise<{ ok: true; montantCents: number } | { ok: false; message: string }> {
  if (palier !== PALIER_CONFERENCE && !PALIERS_FORMATION.some((p) => p.id === palier))
    return { ok: false, message: "Palier inconnu." };
  const c = await prisma.commissionApporteur.findUnique({
    where: { id },
    select: {
      id: true,
      apporteurId: true,
      factureId: true,
      parrainage: true,
      activite: true,
      factureHtCents: true,
      statut: true,
    },
  });
  if (!c) return { ok: false, message: "Commission introuvable." };
  if (c.statut !== "a_qualifier" || c.parrainage)
    return { ok: false, message: "Cette commission n'est pas à qualifier." };
  if (c.activite !== "formation" && c.activite !== "conference")
    return { ok: false, message: "Seule une formation se qualifie par palier." };
  const calc = calculerCommission({
    activite: palier === PALIER_CONFERENCE ? "conference" : "formation",
    factureHtCents: c.factureHtCents,
    palier,
    quantite,
  });
  if (calc.statut !== "calculee")
    return { ok: false, message: "Calcul impossible pour ce palier." };
  const v = await statutApresVigilance(c.apporteurId, calc.montantCents, maintenant, c.id);
  const r = await prisma.commissionApporteur.updateMany({
    where: { id, statut: "a_qualifier" },
    data: {
      // Une facture de conférence typée « formation » : la ligne devient une conférence.
      ...(palier === PALIER_CONFERENCE ? { activite: "conference" } : {}),
      palier: calc.palier,
      prixPublicHtCents: calc.prixPublicCents,
      montantCents: calc.montantCents,
      statut: v.statut,
    },
  });
  if (r.count !== 1) return { ok: false, message: "Cette commission vient d'être qualifiée." };
  if (v.demander) await demanderVigilance(c.apporteurId, "premiere");
  await qualifierPartParrainage(c.factureId, c.apporteurId, calc.montantCents, maintenant);
  return { ok: true, montantCents: calc.montantCents };
}

/** Activités qu'une ligne « à qualifier » peut recevoir quand la facture n'en portait pas. */
export const ACTIVITES_CLASSABLES = [
  "formation",
  "un_a_un",
  "audit",
  "implementation",
  "site_web",
  "conference",
] as const;
export type ActiviteClassable = (typeof ACTIVITES_CLASSABLES)[number];

/**
 * Une ligne « à qualifier » qui n'est pas une formation (activité de la facture inconnue) :
 * Williams la classe. 1-to-1, audit, intégration : la commission se calcule tout de suite sur le
 * HT facturé. Site web : aucune commission (annexe 1, A1.5), la ligne est close à 0 €. Formation :
 * l'activité est posée, le palier se choisit ensuite comme d'habitude.
 */
export async function classerActiviteCommission(
  id: string,
  activite: string,
  maintenant: Date = new Date(),
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  if (!(ACTIVITES_CLASSABLES as readonly string[]).includes(activite))
    return { ok: false, message: "Activité inconnue." };
  const c = await prisma.commissionApporteur.findUnique({
    where: { id },
    select: {
      id: true,
      apporteurId: true,
      factureId: true,
      parrainage: true,
      activite: true,
      factureHtCents: true,
      statut: true,
    },
  });
  if (!c) return { ok: false, message: "Commission introuvable." };
  if (c.statut !== "a_qualifier" || c.parrainage || c.activite === "formation")
    return { ok: false, message: "Cette commission n'est pas à classer." };
  const choisie = activite as ActiviteClassable;
  if (choisie === "formation") {
    const r = await prisma.commissionApporteur.updateMany({
      where: { id, statut: "a_qualifier" },
      data: { activite: "formation" },
    });
    return r.count === 1
      ? { ok: true, message: "Classée en formation : choisissez maintenant son palier." }
      : { ok: false, message: "Cette commission vient d'être modifiée." };
  }
  const calc = calculerCommission({ activite: choisie, factureHtCents: c.factureHtCents });
  if (calc.statut === "aucune") {
    const r = await prisma.commissionApporteur.updateMany({
      where: { id, statut: "a_qualifier" },
      data: {
        activite: choisie,
        palier: "aucune-commission",
        montantCents: 0,
        statut: "versee",
        verseeAt: maintenant,
      },
    });
    if (r.count !== 1) return { ok: false, message: "Cette commission vient d'être modifiée." };
    // La part du parrain suit la commission du filleul : aucune non plus.
    await clorePartParrainage(c.factureId, c.apporteurId, maintenant);
    return {
      ok: true,
      message: "Aucune commission pour ce type de prestation : ligne close à 0 €.",
    };
  }
  if (calc.statut !== "calculee") return { ok: false, message: "Calcul impossible." };
  const v = await statutApresVigilance(c.apporteurId, calc.montantCents, maintenant, c.id);
  const r = await prisma.commissionApporteur.updateMany({
    where: { id, statut: "a_qualifier" },
    data: {
      activite: choisie,
      ...(calc.palier ? { palier: calc.palier } : {}),
      montantCents: calc.montantCents,
      statut: v.statut,
    },
  });
  if (r.count !== 1) return { ok: false, message: "Cette commission vient d'être modifiée." };
  if (v.demander) await demanderVigilance(c.apporteurId, "premiere");
  await qualifierPartParrainage(c.factureId, c.apporteurId, calc.montantCents, maintenant);
  return { ok: true, message: `Qualifiée : ${euros(calc.montantCents)}.` };
}

/** Ferme à 0 € la part du parrain d'une commission sans commission. */
async function clorePartParrainage(
  factureId: string,
  filleulId: string,
  maintenant: Date,
): Promise<void> {
  const filleul = await prisma.apporteurReseau.findUnique({
    where: { id: filleulId },
    select: { parrainId: true },
  });
  if (!filleul?.parrainId) return;
  await prisma.commissionApporteur.updateMany({
    where: { factureId, apporteurId: filleul.parrainId, parrainage: true, statut: "a_qualifier" },
    data: { montantCents: 0, statut: "versee", verseeAt: maintenant, palier: "aucune-commission" },
  });
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
    where: {
      factureId_apporteurId_parrainage: {
        factureId,
        apporteurId: filleul.parrainId,
        parrainage: true,
      },
    },
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
  /** Reprise : numéro de son avoir d'autofacture. */
  avoirNumero: string | null;
  /** Autofacture impossible faute de donnée : ce qui manque, depuis quand. */
  autofactureAttenteMotif: string | null;
  /** Contestation écrite du client en cours (art. 4.2 bis) : depuis quand, et laquelle. */
  litigeDepuis: Date | null;
  litigeMotif: string | null;
  /** Prestation réalisée (art. 4.2) : date et source ; `null` = en attente de réalisation. */
  prestationRealiseeAt: Date | null;
  prestationRealiseePar: string | null;
  autofactureAttenteDepuis: Date | null;
  verseeAt: Date | null;
  creeAt: Date;
  /** Encaissement (paiement soldant la facture), repli : création de la ligne. */
  encaisseeAt: Date;
  /** Date d'émission de l'autofacture (`autofactureEmiseAt`, repli sur la dernière écriture). */
  emissionAt: Date;
}

/** Taille d'une page de la liste des commissions (précédent / suivant dans la console). */
export const COMMISSIONS_PAR_PAGE = 100;

export async function lireCommissions(
  statut: StatutCommissionApporteur | null,
  page = 1,
): Promise<CommissionVue[]> {
  const p = Math.max(1, Math.floor(page));
  const lignes = await prisma.commissionApporteur.findMany({
    where: statut ? { statut } : {},
    orderBy: [{ creeAt: "desc" }, { id: "asc" }],
    take: COMMISSIONS_PAR_PAGE,
    skip: (p - 1) * COMMISSIONS_PAR_PAGE,
    include: {
      apporteur: { select: { prenom: true, nom: true } },
      presentation: { select: { denomination: true } },
    },
  });
  const factures = await prisma.factureFormation.findMany({
    where: { id: { in: [...new Set(lignes.map((l) => l.factureId))] } },
    select: { id: true, numero: true, paidAt: true },
  });
  const numero = new Map(factures.map((f) => [f.id, f.numero]));
  const paye = new Map(factures.map((f) => [f.id, f.paidAt]));
  return lignes.map((l) => ({
    id: l.id,
    apporteurId: l.apporteurId,
    apporteur: [decryptPii(l.apporteur.prenom), decryptPii(l.apporteur.nom)]
      .filter(Boolean)
      .join(" "),
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
    avoirNumero: l.avoirNumero,
    autofactureAttenteMotif: l.autofactureAttenteMotif,
    litigeDepuis: l.litigeDepuis ?? null,
    litigeMotif: l.litigeMotif ?? null,
    prestationRealiseeAt: l.prestationRealiseeAt ?? null,
    prestationRealiseePar: l.prestationRealiseePar ?? null,
    autofactureAttenteDepuis: l.autofactureAttenteDepuis,
    verseeAt: l.verseeAt,
    creeAt: l.creeAt,
    encaisseeAt: paye.get(l.factureId) ?? l.creeAt,
    emissionAt: l.autofactureEmiseAt ?? l.majAt,
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
    annulee: 0,
    retenue: 0,
  };
  for (const x of g) out[x.statut] = x._count._all;
  return out;
}

// ── Dates ────────────────────────────────────────────────────────────────

/** « 2026-10 » en heure de Paris. */
export function moisParis(d: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
  }).format(d);
  return p.slice(0, 7);
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
 * la table (autofactures ET avoirs : une seule série) et le registre des numéros émis s'il le
 * connaît (lecture seule, tolérante).
 */
export async function allouerNumeroAutofacture(annee: number): Promise<string> {
  return (await allouerNumerosAutofacture(annee, 1))[0]!;
}

/** Activité de la ligne d'AVOIR qui neutralise une commission retenue (art. 4.5 bis). */
export const ACTIVITE_NEUTRALISATION = "neutralisation";

/**
 * Série des autofactures et avoirs : verrou consultatif de TRANSACTION, puis contrôle que les
 * numéros alloués sont encore libres (lignes et registre). À appeler dans la transaction qui
 * ÉCRIT les numéros : deux émissions concurrentes ne peuvent plus prendre le même numéro, et
 * rien n'est réservé à l'avance (une pièce qui échoue ne laisse pas de trou dans la série).
 */
export async function verrouillerSerieAutofacture(
  tx: Pick<typeof prisma, "$executeRaw" | "commissionApporteur" | "numeroEmis">,
  numeros: readonly string[],
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('serie-autofacture-apporteur'))`;
  const pris = await tx.commissionApporteur.count({
    where: {
      OR: [{ autofactureNumero: { in: [...numeros] } }, { avoirNumero: { in: [...numeros] } }],
    },
  });
  let registre = 0;
  try {
    registre = await tx.numeroEmis.count({ where: { numero: { in: [...numeros] } } });
  } catch {
    registre = 0;
  }
  if (pris + registre > 0) throw new Error("Numéro d'autofacture déjà émis : nouvel essai.");
}

/** `n` numéros consécutifs de la série (l'autofacture puis ses avoirs, dans cet ordre). */
export async function allouerNumerosAutofacture(annee: number, n: number): Promise<string[]> {
  const prefixe = `${PREFIXE_AUTOFACTURE}-${annee}-`;
  const [factures, avoirs] = await Promise.all([
    prisma.commissionApporteur.findMany({
      where: { autofactureNumero: { startsWith: prefixe } },
      select: { autofactureNumero: true },
      distinct: ["autofactureNumero"],
    }),
    prisma.commissionApporteur.findMany({
      where: { avoirNumero: { startsWith: prefixe } },
      select: { avoirNumero: true },
      distinct: ["avoirNumero"],
    }),
  ]);
  const lignes = [...factures.map((l) => l.autofactureNumero), ...avoirs.map((l) => l.avoirNumero)];
  let registre: Array<{ numero: string }> = [];
  try {
    registre = await prisma.numeroEmis.findMany({
      where: { numero: { startsWith: prefixe } },
      select: { numero: true },
    });
  } catch {
    registre = [];
  }
  let borne = 0;
  for (const x of [...lignes, ...registre.map((r) => r.numero)]) {
    const s = x ? sequenceAutofacture(x, annee) : null;
    if (s !== null && s > borne) borne = s;
  }
  return Array.from({ length: n }, (_, i) => formaterAutofacture(annee, borne + 1 + i));
}

/**
 * Pour chaque reprise, l'autofacture d'ORIGINE (numéro, mois et jour d'émission) : le renvoi de
 * l'avoir (art. 4.5). Clé = id de la ligne de reprise. Le jour vient de `autofactureEmiseAt`
 * (absent pour les autofactures émises avant cette colonne : seul le mois est alors connu).
 */
export async function originesDesReprises(
  reprises: ReadonlyArray<{ id: string; palier: string | null }>,
): Promise<Map<string, { numero: string | null; mois: string | null; emission?: Date | null }>> {
  const origineDe = new Map<string, string>();
  for (const r of reprises) {
    if (r.palier?.startsWith(PREFIXE_PALIER_REPRISE))
      origineDe.set(r.id, r.palier.slice(PREFIXE_PALIER_REPRISE.length));
  }
  const out = new Map<
    string,
    { numero: string | null; mois: string | null; emission?: Date | null }
  >();
  if (origineDe.size === 0) return out;
  const origines = await prisma.commissionApporteur.findMany({
    where: { id: { in: [...new Set(origineDe.values())] } },
    select: { id: true, autofactureNumero: true, releveMois: true, autofactureEmiseAt: true },
  });
  const parId = new Map(origines.map((o) => [o.id, o]));
  for (const [repriseId, origineId] of origineDe) {
    const o = parId.get(origineId);
    out.set(repriseId, {
      numero: o?.autofactureNumero ?? null,
      mois: o?.releveMois ?? null,
      emission: o?.autofactureEmiseAt ?? null,
    });
  }
  return out;
}

/**
 * Génère le PDF de l'autofacture (gabarit des formateurs, vendeur = l'apporteur), le dépose
 * sur R2 et rend sa clé. Rend `null` (log + Sentry) à la moindre difficulté : l'appelant
 * n'enregistre alors AUCUNE facturation.
 */
export async function genererPdfAutofacture(e: {
  apporteurId: string;
  numero: string;
  /** Période des prestations imprimée sur la pièce, ex. « commissions exigibles au 6 octobre 2026 ». */
  periodeLibelle: string;
  commissionIds: readonly string[];
  totalCents: number;
  maintenant?: Date;
  /** AVOIR : `commissionIds` = les reprises, `totalCents` = leur total POSITIF. */
  avoir?: { factureInitiale: string; dateFactureInitiale: string | null; imputation: string };
}): Promise<{ r2Key: string; filename: string; totalTtcCents: number } | null> {
  try {
    const [apporteur, commissions] = await Promise.all([
      prisma.apporteurReseau.findUnique({
        where: { id: e.apporteurId },
        select: {
          prenom: true,
          nom: true,
          email: true,
          denomination: true,
          siren: true,
          adresse: true,
          regimeTva: true,
          numeroTva: true,
        },
      }),
      prisma.commissionApporteur.findMany({
        where: { id: { in: [...e.commissionIds] } },
        select: {
          id: true,
          activite: true,
          palier: true,
          parrainage: true,
          montantCents: true,
          prixPublicHtCents: true,
          factureHtCents: true,
          statut: true,
        },
        orderBy: { creeAt: "asc" },
      }),
    ]);
    if (!apporteur) throw new Error("apporteur introuvable");
    const origines = await originesDesReprises(commissions);
    const [
      { getOrganismeIdentite },
      { renderPdfToBuffer, storeAndSignPdf },
      { AutofactureHonorairesPdf },
      React,
    ] = await Promise.all([
      import("@/server/qualiopi/documents/organisme"),
      import("@/server/qualiopi/documents/render"),
      import("@/server/qualiopi/documents/templates/autofacture-honoraires"),
      import("react"),
    ]);
    const construit = construireDonneesAutofacture({
      numero: e.numero,
      periodeLibelle: e.periodeLibelle,
      dateEmission: e.maintenant ?? new Date(),
      apporteur: {
        nom: [decryptPii(apporteur.prenom), decryptPii(apporteur.nom)].filter(Boolean).join(" "),
        denomination: apporteur.denomination,
        siren: apporteur.siren,
        siret: await siretDe(e.apporteurId),
        adresse: decryptPii(apporteur.adresse),
        regimeTva: apporteur.regimeTva,
        numeroTva: apporteur.numeroTva,
        email: decryptPii(apporteur.email) ?? null,
      },
      commissions: commissions.map((l) => ({
        ...l,
        origineNumero: origines.get(l.id)?.numero ?? null,
        origineMois: origines.get(l.id)?.mois ?? null,
      })),
      organisme: await getOrganismeIdentite(),
      totalAttenduCents: e.totalCents,
      ...(e.avoir ? { avoir: e.avoir } : {}),
    });
    if (!construit.ok) throw new Error(`autofacture non établie : ${construit.motif}`);
    const { buffer } = await renderPdfToBuffer(
      React.createElement(AutofactureHonorairesPdf, { data: construit.data }),
    );
    const r2Key = `apporteurs/autofactures/${e.apporteurId}/${e.numero}.pdf`;
    if ((await storeAndSignPdf(buffer, r2Key)) === null) throw new Error("R2 non configuré");
    return {
      r2Key,
      filename: `${e.numero}.pdf`,
      totalTtcCents: totalTtcPieceCents(
        apporteur.regimeTva,
        construit.data.lignes.map((l) => l.montantHtCents),
      ),
    };
  } catch (err) {
    console.error(`[reseau-apporteurs] autofacture ${e.numero} : PDF non généré :`, err);
    signalerErreurReseau("autofacture pdf", err);
    return null;
  }
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
  /** SIRET de l'établissement de l'apporteur, s'il est connu. */
  siret?: string | null;
  nom: string;
  adresse: string | null;
  totalCents: number;
  lignes: number;
}

/** Seuil de déclaration DAS 2 par bénéficiaire et par an (sommes versées depuis 2024). */
export const SEUIL_DAS2_CENTS = 240_000;

export function construireCsvDas2(annee: number, lignes: readonly LigneDas2[]): string {
  const entete = [
    "annee",
    "beneficiaire",
    "denomination",
    "siren",
    "siret",
    "adresse",
    "montant_verse_eur",
    "nombre_commissions",
    "a_declarer_seuil_2400",
  ];
  const corps = lignes.map((l) =>
    [
      annee,
      l.nom,
      l.denomination,
      l.siren,
      l.siret ?? null,
      l.adresse,
      centimesCsv(l.totalCents),
      l.lignes,
      // Seuil DAS 2 : 2 400 € par an et par bénéficiaire (BOFiP ACTU-2024-00154).
      l.totalCents > SEUIL_DAS2_CENTS ? "oui" : "non",
    ]
      .map(champCsv)
      .join(";"),
  );
  return `﻿${[entete.join(";"), ...corps].join("\r\n")}\r\n`;
}

/** Commissions VERSÉES dans l'année civile (Paris approximée en UTC), par apporteur. */
export async function exportDas2(annee: number): Promise<string> {
  const g = await prisma.commissionApporteur.groupBy({
    by: ["apporteurId"],
    where: {
      // Les reprises imputées à un relevé viennent en déduction du versé de l'année. L'avoir qui
      // NEUTRALISE une ligne retenue (art. 4.5 bis) n'en est pas une : la ligne n'a jamais été
      // versée, il n'y a rien à déduire.
      OR: [
        { statut: "versee" },
        {
          statut: "reprise",
          releveMois: { not: null },
          NOT: { activite: ACTIVITE_NEUTRALISATION },
        },
      ],
      verseeAt: {
        gte: new Date(Date.UTC(annee, 0, 1) - 3_600_000),
        lt: new Date(Date.UTC(annee + 1, 0, 1) - 3_600_000),
      },
    },
    _sum: { montantCents: true },
    _count: { _all: true },
  });
  const apporteurs = await prisma.apporteurReseau.findMany({
    where: { id: { in: g.map((x) => x.apporteurId) } },
    select: {
      id: true,
      prenom: true,
      nom: true,
      denomination: true,
      siren: true,
      adresse: true,
      regimeTva: true,
    },
  });
  const parId = new Map(apporteurs.map((a) => [a.id, a]));
  const sirets = await siretsDe(apporteurs.map((a) => a.id)).catch(() => new Map<string, string>());
  const lignes: LigneDas2[] = g.map((x) => {
    const a = parId.get(x.apporteurId);
    return {
      denomination: a?.denomination ?? null,
      siren: a?.siren ?? null,
      nom: a ? [decryptPii(a.prenom), decryptPii(a.nom)].filter(Boolean).join(" ") : "",
      siret: a ? (sirets.get(a.id) ?? null) : null,
      adresse: a?.adresse ?? null,
      // La DAS 2 se déclare TVA comprise (analyse du 09/10) : TTC pour un apporteur assujetti.
      totalCents: totalTtcPieceCents((a?.regimeTva ?? null) as RegimeApporteur, [
        x._sum.montantCents ?? 0,
      ]),
      lignes: x._count._all,
    };
  });
  lignes.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  return construireCsvDas2(annee, lignes);
}
