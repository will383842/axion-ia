/**
 * Qualiopi — Lecture des missions d'audit IA.
 *
 * Aucune règle métier : la rémunération vit dans `remuneration/`, le planning
 * dans `admin-planning/`. Ici on ne fait que présenter les audits.
 *
 * Stub-aware (try/catch → valeurs vides) : lisible au build SSG. Jamais de `*OrThrow`.
 */

import { prisma } from "@/lib/prisma";

export interface AuditMissionRow {
  id: string;
  numero: string;
  titre: string;
  clientNom: string | null;
  formateurNom: string | null;
  formateurId: string | null;
  dateDebut: Date;
  dateFin: Date;
  montantHtCents: number;
  statut: string;
  opcoStatut: string;
  acompteRecu: boolean;
}

/** Nom « Prénom Nom » d'un formateur, ou `null`. */
function nomComplet(t: { prenom: string; nom: string } | null): string | null {
  if (t === null) return null;
  const s = `${t.prenom} ${t.nom}`.trim();
  return s.length > 0 ? s : null;
}

/** Audits, les plus récents d'abord. Stub-safe → []. */
export async function listAuditMissions(): Promise<AuditMissionRow[]> {
  try {
    const rows = await prisma.auditMission.findMany({
      orderBy: { dateDebut: "desc" },
      take: 200,
      select: {
        id: true,
        numero: true,
        titre: true,
        dateDebut: true,
        dateFin: true,
        montantHtCents: true,
        statut: true,
        opcoStatut: true,
        acompteRecu: true,
        formateurId: true,
        formateur: { select: { nom: true, prenom: true } },
        client: { select: { raisonSociale: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      numero: r.numero,
      titre: r.titre,
      clientNom: r.client?.raisonSociale ?? null,
      formateurNom: nomComplet(r.formateur),
      formateurId: r.formateurId,
      dateDebut: r.dateDebut,
      dateFin: r.dateFin,
      montantHtCents: r.montantHtCents,
      statut: r.statut,
      opcoStatut: r.opcoStatut,
      acompteRecu: r.acompteRecu,
    }));
  } catch {
    return [];
  }
}

export interface AuditMissionDetail extends AuditMissionRow {
  dureeHeures: number | null;
  clientId: string | null;
  devisId: string | null;
  numeroDossierOpco: string | null;
  priseEnChargeMontantCents: number | null;
  acompteMontantCents: number | null;
  acompteDateVersement: Date | null;
  acompteMoyen: string | null;
  lieuVille: string | null;
}

/** Un audit avec tous ses champs, ou `null` s'il est introuvable / au build. */
export async function getAuditMission(id: string): Promise<AuditMissionDetail | null> {
  try {
    const r = await prisma.auditMission.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        titre: true,
        dateDebut: true,
        dateFin: true,
        dureeHeures: true,
        montantHtCents: true,
        statut: true,
        opcoStatut: true,
        numeroDossierOpco: true,
        priseEnChargeMontantCents: true,
        acompteRecu: true,
        acompteMontantCents: true,
        acompteDateVersement: true,
        acompteMoyen: true,
        lieuVille: true,
        clientId: true,
        devisId: true,
        formateurId: true,
        formateur: { select: { nom: true, prenom: true } },
        client: { select: { raisonSociale: true } },
      },
    });
    if (r === null) return null;
    return {
      id: r.id,
      numero: r.numero,
      titre: r.titre,
      clientNom: r.client?.raisonSociale ?? null,
      clientId: r.clientId,
      devisId: r.devisId,
      formateurNom: nomComplet(r.formateur),
      formateurId: r.formateurId,
      dateDebut: r.dateDebut,
      dateFin: r.dateFin,
      dureeHeures: r.dureeHeures,
      montantHtCents: r.montantHtCents,
      statut: r.statut,
      opcoStatut: r.opcoStatut,
      numeroDossierOpco: r.numeroDossierOpco,
      priseEnChargeMontantCents: r.priseEnChargeMontantCents,
      acompteRecu: r.acompteRecu,
      acompteMontantCents: r.acompteMontantCents,
      acompteDateVersement: r.acompteDateVersement,
      acompteMoyen: r.acompteMoyen,
      lieuVille: r.lieuVille,
    };
  } catch {
    return null;
  }
}

/** Clients actifs, pour le sélecteur de création d'un audit. */
export async function listClientOptions(): Promise<{ id: string; nom: string }[]> {
  try {
    const rows = await prisma.client.findMany({
      select: { id: true, raisonSociale: true },
      orderBy: { raisonSociale: "asc" },
      take: 500,
    });
    return rows.map((r) => ({ id: r.id, nom: r.raisonSociale }));
  } catch {
    return [];
  }
}
