/**
 * Réseau d'apporteurs — PRÉAVIS de résiliation (contrat 2.7, art. 11.1, 11.1 bis et 11.2).
 *
 * « Résilier » ne met plus fin au contrat le jour du clic : la console NOTIFIE la résiliation et
 * calcule la date de fin. Pendant le préavis le contrat continue (déclarations, commissions,
 * autofactures normales) ; le passage quotidien applique la fin à la date, avec les effets de
 * `resilierApporteur` (art. 12). La résiliation peut être annulée avant la date. La fin IMMÉDIATE
 * reste possible pour un manquement (art. 11.2) : distincte, et motivée.
 *
 * Préavis (art. 11.1) :
 *   · l'Apporteur résilie : 30 jours, quelle que soit la version ;
 *   · la Société résilie, contrat 2.7 ou après : 30 jours la 1re année, 60 la 2e, 90 ensuite, les
 *     années courant de la prise d'effet (contresignature, art. 10), l'ancienneté s'appréciant au
 *     jour de la notification ;
 *   · la Société résilie un contrat signé AVANT la 2.7 : 30 jours (texte de toutes les versions
 *     2 à 2.6, « moyennant un préavis de 30 jours »), sa version le régissant (art. 13.2).
 *
 * ⚠️ Module sans `server-only` : testable directement, appelé par la console et le worker.
 */

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";

import { dateFr, jourParis } from "./autofacture-donnees";
import { envoyer, type ResultatEnvoi } from "./envois";
import { ajouterMois } from "./regles";
import { resilierApporteur } from "./resiliation";
import { signalerErreurReseau } from "./signaler";

export type PartieQuiResilie = "societe" | "apporteur";

export const JOURS_PREAVIS_APPORTEUR = 30;
/** Préavis de la Société par année d'ancienneté (contrat 2.7) : 1re, 2e, 3e et suivantes. */
export const JOURS_PREAVIS_SOCIETE = [30, 60, 90] as const;
/** Préavis de toutes les versions antérieures à la 2.7, quelle que soit la partie. */
export const JOURS_PREAVIS_AVANT_27 = 30;
/** Motif d'une résiliation pour manquement (art. 11.2) : une décision motivée, pas un mot. */
export const MOTIF_MANQUEMENT_MIN = 10;

/**
 * Le contrat suit-il le préavis progressif de la 2.7 ? Comparaison PAR COMPOSANTE (« 2.10 » est
 * après « 2.7 »). Version inconnue : on applique le préavis le plus long (2.7), jamais un préavis
 * plus court que celui que le contrat pourrait prévoir.
 */
export function preavisProgressif(version: string | null | undefined): boolean {
  if (typeof version !== "string" || !version.trim()) return true;
  const [maj = 0, min = 0] = version.split(".").map((x) => Number.parseInt(x, 10) || 0);
  return maj > 2 || (maj === 2 && min >= 7);
}

/** La version enregistrée dans la preuve de signature de l'apporteur. */
export function versionDuContrat(signature: unknown): string | null {
  const v = (signature as { version?: unknown } | null)?.version;
  return typeof v === "string" ? v : null;
}

/** Durée du préavis, en jours (art. 11.1 de la version qui régit le contrat). */
export function preavisJours(e: {
  par: PartieQuiResilie;
  version: string | null;
  /** Prise d'effet du contrat (contresignature par la Société, art. 10). */
  priseEffet: Date | null;
  notifieeLe: Date;
}): number {
  if (e.par === "apporteur") return JOURS_PREAVIS_APPORTEUR;
  if (!preavisProgressif(e.version)) return JOURS_PREAVIS_AVANT_27;
  if (!e.priseEffet) return JOURS_PREAVIS_SOCIETE[0];
  const t = e.notifieeLe.getTime();
  if (t < ajouterMois(e.priseEffet, 12).getTime()) return JOURS_PREAVIS_SOCIETE[0];
  if (t < ajouterMois(e.priseEffet, 24).getTime()) return JOURS_PREAVIS_SOCIETE[1];
  return JOURS_PREAVIS_SOCIETE[2];
}

/** Fin du contrat : jour de Paris de la notification + préavis (rendue à midi UTC). */
export function finDuPreavis(notifieeLe: Date, jours: number): Date {
  const [a, m, j] = jourParis(notifieeLe).split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, j! + jours, 12));
}

/** Le jour de fin est-il arrivé (jours de Paris) ? */
export function preavisEchu(finAt: Date, maintenant: Date): boolean {
  return jourParis(finAt) <= jourParis(maintenant);
}

// ── Lecture ──────────────────────────────────────────────────────────────

export interface ResiliationNotifiee {
  par: string;
  notifieeAt: Date;
  preavisJours: number;
  finAt: Date;
  annuleeAt: Date | null;
  appliqueeAt: Date | null;
}

/** La table n'existe pas encore (migration pas jouée) : Prisma P2021. */
function tableAbsente(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: unknown }).code === "P2021";
}

/** La résiliation notifiée de cet apporteur (en cours, annulée ou appliquée), ou `null`. */
export async function lireResiliation(apporteurId: string): Promise<ResiliationNotifiee | null> {
  try {
    return await prisma.apporteurReseauResiliation.findUnique({
      where: { apporteurId },
      select: {
        par: true,
        notifieeAt: true,
        preavisJours: true,
        finAt: true,
        annuleeAt: true,
        appliqueeAt: true,
      },
    });
  } catch (err) {
    if (tableAbsente(err)) return null;
    throw err;
  }
}

/** Une résiliation EN COURS de préavis : ni annulée, ni appliquée. */
export function enPreavis(r: ResiliationNotifiee | null): r is ResiliationNotifiee {
  return !!r && r.annuleeAt === null && r.appliqueeAt === null;
}

// ── E-mail ───────────────────────────────────────────────────────────────

export type CasResiliation = PartieQuiResilie | "manquement" | "annulee";

async function avertirApporteur(
  apporteurId: string,
  cas: CasResiliation,
  e: { notifieeLe: Date; finAt: Date; preavisJours: number; motif?: string },
): Promise<ResultatEnvoi> {
  try {
    const a = await prisma.apporteurReseau.findUnique({
      where: { id: apporteurId },
      select: { prenom: true, nom: true, email: true },
    });
    const email = a ? decryptPii(a.email) : null;
    if (!a || !email) return "indisponible";
    return await envoyer({
      gabarit: "apporteur-resiliation",
      destinataire: email,
      entityType: "ApporteurReseau",
      entityId: apporteurId,
      jobId: `apporteur-resiliation-${apporteurId}-${cas}-${jourParis(e.notifieeLe)}`,
      payload: {
        contactName: [decryptPii(a.prenom), decryptPii(a.nom)].filter(Boolean).join(" "),
        cas,
        dateNotification: dateFr(e.notifieeLe),
        dateFin: dateFr(e.finAt),
        preavisJours: e.preavisJours,
        ...(e.motif ? { motifResiliation: e.motif } : {}),
      },
    });
  } catch (err) {
    signalerErreurReseau("e-mail de résiliation", err);
    return "indisponible";
  }
}

function suiteEnvoi(r: ResultatEnvoi): string {
  return r === "envoye"
    ? "L'apporteur en est averti par e-mail."
    : r === "en-validation"
      ? "L'e-mail à l'apporteur attend votre validation dans la boîte d'envoi."
      : "⚠️ L'e-mail à l'apporteur n'est pas parti : prévenez-le par écrit.";
}

async function ajouterNote(apporteurId: string, maintenant: Date, ligne: string): Promise<void> {
  const a = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { noteInterne: true },
  });
  const texte = `[${maintenant.toISOString().slice(0, 10)}] ${ligne}`;
  await prisma.apporteurReseau.update({
    where: { id: apporteurId },
    data: { noteInterne: [a?.noteInterne, texte].filter(Boolean).join("\n").slice(0, 5000) },
  });
}

// ── Notifier, annuler, manquement, fin à la date ─────────────────────────

type Resultat = { ok: true; message: string } | { ok: false; message: string };

/** Art. 11.1 : la résiliation est NOTIFIÉE ; le contrat prend fin à l'issue du préavis. */
export async function notifierResiliation(e: {
  apporteurId: string;
  par: PartieQuiResilie;
  /** Identifiant de l'administrateur. */
  auteur?: string | null;
  maintenant?: Date;
}): Promise<Resultat> {
  const maintenant = e.maintenant ?? new Date();
  const a = await prisma.apporteurReseau.findUnique({
    where: { id: e.apporteurId },
    select: { statut: true, signatureApporteur: true, signeParSocieteAt: true },
  });
  if (!a) return { ok: false, message: "Apporteur introuvable." };
  if (a.statut !== "signe")
    return { ok: false, message: "Seul un contrat signé peut être résilié." };
  const deja = await lireResiliation(e.apporteurId);
  if (enPreavis(deja))
    return {
      ok: false,
      message: `Une résiliation est déjà notifiée : fin du contrat le ${dateFr(deja.finAt)}.`,
    };
  const version = versionDuContrat(a.signatureApporteur);
  const jours = preavisJours({
    par: e.par,
    version,
    priseEffet: a.signeParSocieteAt,
    notifieeLe: maintenant,
  });
  const finAt = finDuPreavis(maintenant, jours);
  const donnees = {
    par: e.par,
    notifieeAt: maintenant,
    preavisJours: jours,
    finAt,
    notifieePar: e.auteur?.slice(0, 64) ?? null,
    annuleeAt: null,
    appliqueeAt: null,
  };
  await prisma.apporteurReseauResiliation.upsert({
    where: { apporteurId: e.apporteurId },
    create: { apporteurId: e.apporteurId, ...donnees },
    update: donnees,
  });
  const qui = e.par === "apporteur" ? "par l'apporteur" : "par la Société";
  await ajouterNote(
    e.apporteurId,
    maintenant,
    `Résiliation notifiée ${qui} (préavis de ${jours} jours, art. 11.1${version ? `, contrat ${version}` : ""}) : fin du contrat le ${dateFr(finAt)}.`,
  );
  const envoi = await avertirApporteur(e.apporteurId, e.par, {
    notifieeLe: maintenant,
    finAt,
    preavisJours: jours,
  });
  return {
    ok: true,
    message: `Résiliation notifiée le ${dateFr(maintenant)} (préavis de ${jours} jours) : le contrat prend fin le ${dateFr(finAt)}. D'ici là, il continue normalement. ${suiteEnvoi(envoi)}`,
  };
}

/** Annule une résiliation notifiée, AVANT la date de fin. */
export async function annulerResiliation(e: {
  apporteurId: string;
  maintenant?: Date;
}): Promise<Resultat> {
  const maintenant = e.maintenant ?? new Date();
  const r = await lireResiliation(e.apporteurId);
  if (!enPreavis(r)) return { ok: false, message: "Aucune résiliation en cours de préavis." };
  if (preavisEchu(r.finAt, maintenant))
    return {
      ok: false,
      message: "La date de fin est atteinte : la résiliation ne peut plus être annulée.",
    };
  const maj = await prisma.apporteurReseauResiliation.updateMany({
    where: { apporteurId: e.apporteurId, annuleeAt: null, appliqueeAt: null },
    data: { annuleeAt: maintenant },
  });
  if (maj.count !== 1) return { ok: false, message: "Cette résiliation vient d'être modifiée." };
  await ajouterNote(
    e.apporteurId,
    maintenant,
    `Résiliation notifiée le ${dateFr(r.notifieeAt)} annulée : le contrat continue.`,
  );
  const envoi = await avertirApporteur(e.apporteurId, "annulee", {
    notifieeLe: r.notifieeAt,
    finAt: r.finAt,
    preavisJours: r.preavisJours,
  });
  return { ok: true, message: `Résiliation annulée : le contrat continue. ${suiteEnvoi(envoi)}` };
}

/** Art. 11.2 : fin IMMÉDIATE pour manquement, par décision motivée (sans préavis). */
export async function resilierPourManquement(e: {
  apporteurId: string;
  motif: string;
  auteur?: string | null;
  maintenant?: Date;
}): Promise<Resultat> {
  const maintenant = e.maintenant ?? new Date();
  const motif = e.motif.trim().slice(0, 1000);
  if (motif.length < MOTIF_MANQUEMENT_MIN)
    return {
      ok: false,
      message: "Indiquez le motif : la résiliation pour manquement est une décision motivée.",
    };
  const r = await resilierApporteur(e.apporteurId, maintenant);
  if (!r.ok) return r;
  const donnees = {
    par: "manquement",
    notifieeAt: maintenant,
    preavisJours: 0,
    finAt: maintenant,
    notifieePar: e.auteur?.slice(0, 64) ?? null,
    annuleeAt: null,
    appliqueeAt: maintenant,
  };
  try {
    await prisma.apporteurReseauResiliation.upsert({
      where: { apporteurId: e.apporteurId },
      create: { apporteurId: e.apporteurId, ...donnees },
      update: donnees,
    });
  } catch (err) {
    // Le contrat est déjà résilié (statut) : la ligne n'est qu'une trace.
    if (!tableAbsente(err)) signalerErreurReseau("résiliation pour manquement : trace", err);
  }
  await ajouterNote(
    e.apporteurId,
    maintenant,
    `Résiliation sans préavis pour manquement (art. 11.2) : ${motif}`,
  );
  const envoi = await avertirApporteur(e.apporteurId, "manquement", {
    notifieeLe: maintenant,
    finAt: maintenant,
    preavisJours: 0,
    motif,
  });
  return { ok: true, message: `${r.message} ${suiteEnvoi(envoi)}` };
}

/**
 * Passage quotidien : applique la fin des préavis échus (effets de `resilierApporteur`, à la date
 * de fin). Un contrat déjà résilié autrement est seulement marqué appliqué. Rend le nombre de fins.
 */
export async function appliquerFinsDePreavis(maintenant: Date = new Date()): Promise<number> {
  let lignes: Array<{ apporteurId: string; finAt: Date }>;
  try {
    lignes = await prisma.apporteurReseauResiliation.findMany({
      where: {
        annuleeAt: null,
        appliqueeAt: null,
        // Large : le filtre exact se fait en jours de Paris ci-dessous.
        finAt: { lte: new Date(maintenant.getTime() + 86_400_000) },
      },
      select: { apporteurId: true, finAt: true },
    });
  } catch (err) {
    if (tableAbsente(err)) return 0;
    throw err;
  }
  let fins = 0;
  for (const l of lignes) {
    if (!preavisEchu(l.finAt, maintenant)) continue;
    // Les effets sont datés de la fin du préavis, jamais plus tard que maintenant.
    const fin = l.finAt.getTime() < maintenant.getTime() ? l.finAt : maintenant;
    const r = await resilierApporteur(l.apporteurId, fin);
    const maj = await prisma.apporteurReseauResiliation.updateMany({
      where: { apporteurId: l.apporteurId, annuleeAt: null, appliqueeAt: null },
      data: { appliqueeAt: maintenant },
    });
    if (r.ok && maj.count === 1) fins += 1;
  }
  return fins;
}
