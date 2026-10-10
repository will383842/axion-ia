// Conformité RGPD (console) — les demandes d'accès et d'effacement, toutes sources, EN LECTURE.
//
// Recensement fait le 2026-10-10 :
// · `RgpdDemande` (portail stagiaire) est la SEULE file de demandes « à traiter » ;
//   on y répond depuis Qualiopi › Demandes RGPD.
// · Le libre-service public (/mes-donnees → /api/gdpr-export, /api/gdpr-erase) exécute
//   la demande sur-le-champ, candidatures et réseau d'apporteurs compris : il n'en reste
//   qu'une ligne du journal d'activité, sans adresse en clair. Déjà faites, donc.
// · Une demande écrite par e-mail n'est enregistrée nulle part : la page le dit.
//
// Rien ici ne traite une demande : chaque ligne renvoie vers l'outil qui le fait déjà.

import { prisma } from "@/lib/prisma";

export type OrigineDemande = "stagiaire" | "libre_service";

export interface DemandeRgpd {
  id: string;
  origine: OrigineDemande;
  type: "acces" | "effacement";
  personne: string;
  demandeLe: Date;
  aTraiter: boolean;
  faiteLe: Date | null;
  /** Chemin console (sans préfixe) de l'outil qui répond déjà à la demande. */
  outil: string;
}

export const LIBELLE_ORIGINE: Readonly<Record<OrigineDemande, string>> = {
  stagiaire: "Portail stagiaire",
  libre_service: "Site (libre-service)",
};

const ACTIONS_LIBRE_SERVICE = ["gdpr.export.delivered", "gdpr.erase.completed"] as const;

async function sansPanne<T>(lire: () => Promise<T[]>): Promise<T[]> {
  try {
    return (await lire()) ?? [];
  } catch {
    return [];
  }
}

/** Lecture stub-safe : au build (`stub.invalid`) ou sans base, la liste est vide. */
export async function listerDemandes(): Promise<DemandeRgpd[]> {
  const [stagiaires, libreService] = await Promise.all([
    sansPanne(() =>
      prisma.rgpdDemande.findMany({
        orderBy: { demandeAt: "desc" },
        take: 200,
        select: {
          id: true,
          type: true,
          statut: true,
          demandeAt: true,
          traiteeAt: true,
          trainee: { select: { prenom: true, nom: true } },
        },
      }),
    ),
    sansPanne(() =>
      prisma.activityLog.findMany({
        where: { action: { in: [...ACTIONS_LIBRE_SERVICE] } },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, action: true, createdAt: true },
      }),
    ),
  ]);

  const deStagiaires: DemandeRgpd[] = stagiaires.map((d) => ({
    id: d.id,
    origine: "stagiaire",
    type: d.type === "suppression" ? "effacement" : "acces",
    personne: d.trainee ? `${d.trainee.prenom} ${d.trainee.nom}` : "Stagiaire supprimé",
    demandeLe: d.demandeAt,
    aTraiter: d.statut === "demandee",
    faiteLe: d.traiteeAt,
    outil: "qualiopi/rgpd",
  }));

  const duSite: DemandeRgpd[] = libreService.map((l) => ({
    id: l.id,
    origine: "libre_service",
    type: l.action === "gdpr.erase.completed" ? "effacement" : "acces",
    personne: "Visiteur du site (adresse non conservée)",
    demandeLe: l.createdAt,
    aTraiter: false,
    faiteLe: l.createdAt,
    outil: `activity-logs?action=${l.action}`,
  }));

  // À traiter d'abord (la plus ancienne en tête : c'est elle qui presse), puis le reste.
  return [...deStagiaires, ...duSite].sort((a, b) =>
    a.aTraiter !== b.aTraiter
      ? a.aTraiter
        ? -1
        : 1
      : a.aTraiter
        ? a.demandeLe.getTime() - b.demandeLe.getTime()
        : b.demandeLe.getTime() - a.demandeLe.getTime(),
  );
}
