// Conformité RGPD (console) — les demandes d'accès et d'effacement, toutes sources, EN LECTURE.
//
// Recensement fait le 2026-10-10 :
// · `RgpdDemande` (portail stagiaire) est la SEULE file de demandes « à traiter » ;
//   on y répond depuis Qualiopi › Demandes RGPD.
// · Le libre-service public (/mes-donnees → /api/gdpr-export) exécute l'export sur-le-champ :
//   il n'en reste qu'une ligne du journal d'activité, sans adresse en clair. Déjà fait, donc.
// · 🔴 Depuis le 11/11/2026 (décision de Williams), une demande d'EFFACEMENT (route publique
//   `/api/gdpr-erase` ou console Lettre) ne supprime plus rien : la personne est mise à l'écart
//   et la demande reste À TRAITER à la main (trace `gdpr.erase.requested`, alerte dans la
//   cloche, qui porte l'adresse). Les anciennes traces `gdpr.erase.completed` restent « faites ».
// · Une demande écrite par e-mail n'est enregistrée nulle part : la page le dit.
//
// Rien ici ne traite une demande : chaque ligne renvoie vers l'outil qui le fait déjà.

import { prisma } from "@/lib/prisma";
import {
  ACTION_DEMANDE_EFFACEMENT,
  CODE_ALERTE_EFFACEMENT,
  cibleIdAlerteDepuisEmpreinte,
} from "@/server/rgpd/constantes";

export type OrigineDemande =
  "stagiaire" | "libre_service" | "console_lettre" | "console_adresse" | "message_prive";

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
  console_lettre: "Console › Lettre d'information",
  console_adresse: "Console › Mise à l'écart d'une adresse",
  message_prive: "Message privé (réseau social)",
};

// Traces « faites » : coupées à 200, les plus récentes d'abord (elles ne cachent rien d'important).
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
  const [stagiaires, libreServiceFaites, effacementsDemandes, alertes] = await Promise.all([
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
        select: { id: true, action: true, createdAt: true, changes: true },
      }),
    ),
    // 🔴 Les demandes d'effacement peuvent être « à traiter » (délai d'un mois, art. 12.3) : lues
    // À PART et SANS limite. Coupées à 200 avec les exports, 200 exports plus récents (un robot
    // suffit) les feraient disparaître de la liste sans aucun signal.
    sansPanne(() =>
      prisma.activityLog.findMany({
        where: { action: ACTION_DEMANDE_EFFACEMENT },
        orderBy: { createdAt: "desc" },
        select: { id: true, action: true, createdAt: true, changes: true },
      }),
    ),
    // L'alerte « à traiter à la main » dit où en est la demande : tant qu'elle n'est pas
    // résolue, la demande reste à traiter ; sa résolution donne la date de traitement.
    sansPanne(() =>
      prisma.alerteSysteme.findMany({
        where: { code: CODE_ALERTE_EFFACEMENT },
        orderBy: { createdAt: "desc" },
        take: 500,
        select: { cibleId: true, resolue: true, resolueAt: true, metadata: true },
      }),
    ),
  ]);

  const alerteDe = (journalId: string, changes: unknown) => {
    const emailHash =
      changes && typeof changes === "object"
        ? (changes as Record<string, unknown>)["emailHash"]
        : undefined;
    const metaDe = (m: unknown) =>
      m && typeof m === "object" ? (m as Record<string, unknown>)["journalId"] : null;
    // Traces rattachées à une alerte déjà ouverte par une demande dédoublonnée.
    const idsDe = (m: unknown): unknown[] => {
      const v = m && typeof m === "object" ? (m as Record<string, unknown>)["journalIds"] : null;
      return Array.isArray(v) ? v : [];
    };
    // D'abord CETTE demande (journalId) ; l'empreinte ne sert qu'en repli, et seulement parmi
    // les alertes qui ne portent aucun journalId : une ancienne demande ne doit pas retrouver
    // l'alerte (plus récente) d'une seconde demande de la même personne.
    return (
      alertes.find(
        (a) => metaDe(a.metadata) === journalId || idsDe(a.metadata).includes(journalId),
      ) ??
      alertes.find(
        (a) =>
          typeof emailHash === "string" &&
          a.cibleId === cibleIdAlerteDepuisEmpreinte(emailHash) &&
          !metaDe(a.metadata),
      )
    );
  };

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

  const libreService = [...effacementsDemandes, ...libreServiceFaites];
  const duSite: DemandeRgpd[] = libreService.map((l) => {
    if (l.action === ACTION_DEMANDE_EFFACEMENT) {
      const alerte = alerteDe(l.id, l.changes);
      // Sans alerte retrouvée : on ne peut pas dire qu'elle est faite, elle reste à traiter.
      const faite = alerte?.resolue === true;
      const origineLue =
        l.changes && typeof l.changes === "object"
          ? (l.changes as Record<string, unknown>)["origine"]
          : undefined;
      return {
        id: l.id,
        origine:
          origineLue === "console-lettre"
            ? "console_lettre"
            : origineLue === "console"
              ? "console_adresse"
              : origineLue === "message-prive"
                ? "message_prive"
                : "libre_service",
        type: "effacement",
        // L'adresse n'est pas au journal (empreintes seulement) : elle est dans l'alerte.
        personne: "Voir l'alerte « Demande d'effacement RGPD à traiter à la main »",
        demandeLe: l.createdAt,
        aTraiter: !faite,
        faiteLe: faite ? (alerte?.resolueAt ?? null) : null,
        outil: "qualiopi/alertes",
      };
    }
    return {
      id: l.id,
      origine: "libre_service",
      type: l.action === "gdpr.erase.completed" ? "effacement" : "acces",
      personne: "Visiteur du site (adresse non conservée)",
      demandeLe: l.createdAt,
      aTraiter: false,
      faiteLe: l.createdAt,
      outil: `activity-logs?action=${l.action}`,
    };
  });

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
