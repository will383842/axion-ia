// La colonne « Étape » de la liste des apporteurs — la LECTURE du dossier du
// réseau (2026-10-07). La règle vit dans `lib/commercial-application/
// etape-suivi-apporteur.ts` ; ici, seulement ce qu'il faut lire en base, en un
// nombre fixe de requêtes pour toute la page (jamais une par ligne).
//
// Ce module n'est PAS `"use server"` : c'est une lecture appelée par la liste,
// pas une action exposée au navigateur.

import { prisma } from "@/lib/prisma";
import { GABARIT_ISSUE_RETENU } from "@/features/admin-rendezvous/issue-apporteur";
import {
  motifSansLien,
  PREFIXE_RAPPEL_DOSSIER,
  type DossierApporteurResume,
  type MotifSansLien,
} from "@/lib/commercial-application/etape-suivi-apporteur";

/** Le gabarit du lien du dossier envoyé seul (`apporteurs-reseau/envois.ts`). */
const GABARIT_LIEN_DOSSIER = "apporteur-dossier-lien";

/**
 * Le dossier du réseau de chaque ligne affichée, s'il existe — rattaché par la
 * candidature d'origine (`submissionId`) OU par l'empreinte de l'adresse (une
 * personne a souvent plusieurs lignes : premier contact, dossier…).
 */
export async function lireDossiersApporteurListe(
  ids: readonly string[],
): Promise<Map<string, DossierApporteurResume>> {
  const resultat = new Map<string, DossierApporteurResume>();
  if (ids.length === 0) return resultat;

  const affichees = await prisma.submission.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, contactEmailHash: true },
  });
  const empreintes = [
    ...new Set(affichees.map((l) => l.contactEmailHash).filter((h): h is string => !!h)),
  ];
  const dossiers = await prisma.apporteurReseau.findMany({
    where: {
      OR: [
        { submissionId: { in: [...ids] } },
        ...(empreintes.length ? [{ emailHash: { in: empreintes } }] : []),
      ],
    },
    select: {
      id: true,
      statut: true,
      signeParSocieteAt: true,
      submissionId: true,
      emailHash: true,
    },
  });
  if (dossiers.length === 0) return resultat;

  // Les lignes de ces personnes : l'e-mail « Retenu » est journalisé sur la fiche
  // de l'échange, qui n'est pas forcément celle affichée.
  const hashesDossiers = [...new Set(dossiers.map((d) => d.emailHash))];
  const lignesPersonnes = await prisma.submission.findMany({
    where: { contactEmailHash: { in: hashesDossiers } },
    select: { id: true, contactEmailHash: true },
  });
  const fichesDuDossier = new Map<string, Set<string>>();
  for (const d of dossiers) {
    const fiches = new Set<string>(d.submissionId ? [d.submissionId] : []);
    for (const l of lignesPersonnes) if (l.contactEmailHash === d.emailHash) fiches.add(l.id);
    fichesDuDossier.set(d.id, fiches);
  }
  const toutesFiches = [...new Set([...fichesDuDossier.values()].flatMap((s) => [...s]))];

  const envois = await prisma.emailLog.findMany({
    where: {
      sentAt: { not: null },
      OR: [
        {
          template: GABARIT_LIEN_DOSSIER,
          entityType: "ApporteurReseau",
          entityId: { in: dossiers.map((d) => d.id) },
        },
        ...(toutesFiches.length
          ? [
              {
                template: GABARIT_ISSUE_RETENU,
                entityType: "Submission",
                entityId: { in: toutesFiches },
              },
            ]
          : []),
      ],
    },
    select: { template: true, entityType: true, entityId: true, sentAt: true, jobId: true },
  });

  const contratEnvoyeLe = new Map<string, Date>();
  for (const d of dossiers) {
    const fiches = fichesDuDossier.get(d.id) ?? new Set<string>();
    for (const e of envois) {
      if (!e.sentAt || !e.entityId) continue;
      // Un rappel automatique du lien n'est pas un nouvel envoi du contrat.
      if (e.jobId?.startsWith(PREFIXE_RAPPEL_DOSSIER)) continue;
      const concerne =
        (e.entityType === "ApporteurReseau" && e.entityId === d.id) ||
        (e.entityType === "Submission" && fiches.has(e.entityId));
      if (!concerne) continue;
      const avant = contratEnvoyeLe.get(d.id);
      if (!avant || e.sentAt > avant) contratEnvoyeLe.set(d.id, e.sentAt);
    }
  }

  for (const l of affichees) {
    const d =
      dossiers.find((x) => x.submissionId === l.id) ??
      (l.contactEmailHash ? dossiers.find((x) => x.emailHash === l.contactEmailHash) : undefined);
    if (!d) continue;
    resultat.set(l.id, {
      id: d.id,
      statut: d.statut,
      signeParSocieteAt: d.signeParSocieteAt,
      contratEnvoyeLe: contratEnvoyeLe.get(d.id) ?? null,
    });
  }
  return resultat;
}

/**
 * Pourquoi le lien de réservation n'est pas parti, pour chaque ligne qui n'a
 * PAS reçu d'invitation (2026-10-07, précision de Will). Deux lectures pour
 * toute la page : les fiches (leur `details`) et les oppositions (par empreinte).
 * Seulement des données existantes — une ligne sans raison connue n'en a pas.
 */
export async function lireMotifsSansLien(
  ids: readonly string[],
): Promise<Map<string, MotifSansLien>> {
  const resultat = new Map<string, MotifSansLien>();
  if (ids.length === 0) return resultat;
  const lignes = await prisma.submission.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, contactEmailHash: true, details: true },
  });
  const empreintes = [
    ...new Set(lignes.map((l) => l.contactEmailHash).filter((h): h is string => !!h)),
  ];
  const oppositions = empreintes.length
    ? await prisma.emailOpposition.findMany({
        where: { emailHash: { in: empreintes } },
        select: { emailHash: true },
      })
    : [];
  const opposees = new Set(oppositions.map((o) => o.emailHash));
  for (const l of lignes) {
    const motif = motifSansLien({
      details: l.details,
      opposee: l.contactEmailHash !== null && opposees.has(l.contactEmailHash),
    });
    if (motif) resultat.set(l.id, motif);
  }
  return resultat;
}
