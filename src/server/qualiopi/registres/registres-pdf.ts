/**
 * Qualiopi — Exports PDF des registres (docs A3/A7/A8/A17/A18 — LOT 2).
 *
 * 6 exports d'ÉTAT à la volée (PAS des documents officiels : pas de
 * DocumentGenere, pas de numérotation, pas de rétention) rendus via le
 * template générique `templates/registre.tsx` :
 *   - reclamations   : registre des réclamations (ind. 31)
 *   - veille         : journal de veille (ind. 23/24/25)
 *   - revue_direction: revues de direction / plan d'amélioration (ind. 32)
 *   - partenariats   : registre des partenariats (ind. 26)
 *   - sous_traitants : registre des sous-traitants (ind. 27)
 *   - incidents      : registre des incidents + actions correctives (LOT 4)
 *
 * `renderRegistrePdfBuffer(type)` : sélectionne les données réelles (Prisma),
 * construit les lignes et rend le PDF (Buffer + filename). Consommé par la
 * Server Action d'export (base64) ET par le ZIP du dossier d'audit.
 *
 * Stub-aware : lève si DATABASE_URL contient "stub.invalid" (le dossier
 * d'audit gère son propre early-exit avant d'appeler ce module).
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { RegistrePdf, type RegistreData } from "@/server/qualiopi/documents/templates/registre";

// ─────────────────────────────────────────────────────────────────────────────
// Types exportés
// ─────────────────────────────────────────────────────────────────────────────

export const REGISTRE_TYPES = [
  "reclamations",
  "veille",
  "revue_direction",
  "partenariats",
  "sous_traitants",
  "incidents",
] as const;

export type RegistreType = (typeof REGISTRE_TYPES)[number];

export interface RegistrePdfBufferResult {
  readonly buffer: Buffer;
  /** Nom de fichier suggéré (avec extension .pdf). */
  readonly filename: string;
}

/** Plafond de lignes par export (aligné sur les listes admin les plus larges). */
const EXPORT_TAKE = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDateFr(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString("fr-FR") : "";
}

/** Résumé compact d'un champ Json tableau (participants, décisions, actions). */
function resumeJsonListe(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return "";
  const items = raw.map((x) => {
    if (typeof x === "string") return x;
    if (x !== null && typeof x === "object") {
      const o = x as Record<string, unknown>;
      const libelle = o["libelle"] ?? o["titre"] ?? o["action"] ?? o["nom"] ?? o["decision"];
      if (typeof libelle === "string" && libelle.trim()) return libelle;
    }
    return "";
  });
  return (
    items.filter((s) => s.trim().length > 0).join(" ; ") ||
    `${raw.length} entrée${raw.length > 1 ? "s" : ""}`
  );
}

const MENTION_EXPORT =
  "Export d'état généré depuis la console Axion-IA — reflète le registre à la date d'édition ; ne remplace pas les pièces originales.";

const VEILLE_TYPE_LABELS: Record<string, string> = {
  legale: "Légale / réglementaire",
  metiers: "Emplois / métiers",
  pedagogique: "Pédagogique / technologique",
  handicap: "Handicap",
};

const RECLAMATION_STATUT_LABELS: Record<string, string> = {
  nouvelle: "Nouvelle",
  en_cours: "En cours",
  resolue: "Résolue",
  cloturee: "Clôturée",
};

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  pedagogique: "Pédagogique",
  administratif: "Administratif",
  technique: "Technique",
  autre: "Autre",
};

const INCIDENT_GRAVITE_LABELS: Record<string, string> = {
  mineur: "Mineur",
  majeur: "Majeur",
  critique: "Critique",
};

const INCIDENT_STATUT_LABELS: Record<string, string> = {
  ouvert: "Ouvert",
  en_cours: "En cours",
  resolu: "Résolu",
};

// ─────────────────────────────────────────────────────────────────────────────
// Builders — un par registre (SELECT réel + mise en lignes)
// ─────────────────────────────────────────────────────────────────────────────

async function buildReclamations(): Promise<Omit<RegistreData, "dateEdition">> {
  const rows = await prisma.reclamation.findMany({
    select: {
      numero: true,
      dateReception: true,
      reclamantNom: true,
      objet: true,
      statut: true,
      dateReponse: true,
      actionsCorrectives: true,
    },
    orderBy: { dateReception: "desc" },
    take: EXPORT_TAKE,
  });
  return {
    titre: "Registre des réclamations",
    sousTitre:
      "Traitement des réclamations, difficultés et aléas (indicateur 31 du référentiel national qualité).",
    colonnes: [
      "N°",
      "Reçue le",
      "Réclamant",
      "Objet",
      "Statut",
      "Répondue le",
      "Actions correctives",
    ],
    lignes: rows.map((r) => [
      r.numero,
      formatDateFr(r.dateReception),
      r.reclamantNom,
      r.objet,
      RECLAMATION_STATUT_LABELS[r.statut] ?? r.statut,
      formatDateFr(r.dateReponse),
      r.actionsCorrectives ?? "",
    ]),
    mentionBasDePage: MENTION_EXPORT,
  };
}

async function buildVeille(): Promise<Omit<RegistreData, "dateEdition">> {
  const rows = await prisma.veille.findMany({
    select: {
      dateVeille: true,
      type: true,
      titre: true,
      source: true,
      impact: true,
      actionDecidee: true,
    },
    orderBy: { dateVeille: "desc" },
    take: EXPORT_TAKE,
  });
  return {
    titre: "Journal de veille",
    sousTitre:
      "Veille légale et réglementaire, emplois/métiers et pédagogique/technologique (indicateurs 23, 24 et 25).",
    colonnes: ["Date", "Type", "Titre", "Source", "Impact", "Action décidée"],
    lignes: rows.map((v) => [
      formatDateFr(v.dateVeille),
      VEILLE_TYPE_LABELS[v.type] ?? v.type,
      v.titre,
      v.source,
      v.impact ?? "",
      v.actionDecidee ?? "",
    ]),
    mentionBasDePage: MENTION_EXPORT,
  };
}

async function buildRevueDirection(): Promise<Omit<RegistreData, "dateEdition">> {
  const rows = await prisma.revueDirection.findMany({
    select: {
      annee: true,
      dateRevue: true,
      statut: true,
      participants: true,
      decisions: true,
      planActions: true,
    },
    orderBy: { annee: "desc" },
    take: EXPORT_TAKE,
  });
  return {
    titre: "Revues de direction et plan d'amélioration",
    sousTitre:
      "Mise en œuvre des mesures d'amélioration continue (indicateur 32) — revues annuelles, décisions et plan d'actions.",
    colonnes: ["Année", "Date", "Statut", "Participants", "Décisions", "Plan d'actions"],
    lignes: rows.map((r) => [
      String(r.annee),
      formatDateFr(r.dateRevue),
      // [P1] seule une revue « validée » couvre l'indicateur 32 : on marque
      //   explicitement les brouillons/archivées pour ne pas induire l'auditeur en erreur.
      r.statut === "validee" ? "Validée" : `${r.statut} (⚠ non validée — ne couvre pas l'ind. 32)`,
      resumeJsonListe(r.participants),
      resumeJsonListe(r.decisions),
      resumeJsonListe(r.planActions),
    ]),
    mentionBasDePage: MENTION_EXPORT,
  };
}

async function buildPartenariats(): Promise<Omit<RegistreData, "dateEdition">> {
  const rows = await prisma.partenariat.findMany({
    select: {
      nom: true,
      type: true,
      objet: true,
      dateDebut: true,
      dateFin: true,
      actif: true,
    },
    orderBy: { dateDebut: "desc" },
    take: EXPORT_TAKE,
  });
  return {
    titre: "Registre des partenariats",
    sousTitre:
      "Réseau de partenaires, dont réseau d'acteurs du handicap (indicateur 26 du référentiel national qualité).",
    colonnes: ["Nom", "Type", "Objet", "Début", "Fin", "Statut"],
    lignes: rows.map((p) => [
      p.nom,
      p.type,
      p.objet,
      formatDateFr(p.dateDebut),
      formatDateFr(p.dateFin),
      p.actif ? "Actif" : "Terminé",
    ]),
    mentionBasDePage: MENTION_EXPORT,
  };
}

async function buildSousTraitants(): Promise<Omit<RegistreData, "dateEdition">> {
  const rows = await prisma.sousTraitant.findMany({
    select: {
      nom: true,
      siret: true,
      nda: true,
      objetPrestation: true,
      verifieDataGouvAt: true,
      contratSigneAt: true,
      actif: true,
    },
    orderBy: { createdAt: "desc" },
    take: EXPORT_TAKE,
  });
  return {
    titre: "Registre des sous-traitants",
    sousTitre:
      "Dispositions en matière de sous-traitance et de co-traitance (indicateur 27 du référentiel national qualité).",
    colonnes: [
      "Nom",
      "SIRET",
      "NDA",
      "Objet de la prestation",
      "Consultation data.gouv attestée le",
      "Contrat signé",
      "Statut",
    ],
    lignes: rows.map((s) => [
      s.nom,
      s.siret ?? "",
      s.nda ?? "",
      s.objetPrestation,
      formatDateFr(s.verifieDataGouvAt),
      formatDateFr(s.contratSigneAt),
      s.actif ? "Actif" : "Inactif",
    ]),
    mentionBasDePage: MENTION_EXPORT,
  };
}

async function buildIncidents(): Promise<Omit<RegistreData, "dateEdition">> {
  const rows = await prisma.incident.findMany({
    select: {
      dateIncident: true,
      type: true,
      gravite: true,
      titre: true,
      statut: true,
      actionCorrective: true,
      resoluAt: true,
      session: { select: { numero: true } },
    },
    orderBy: { dateIncident: "desc" },
    take: EXPORT_TAKE,
  });
  return {
    titre: "Registre des incidents",
    sousTitre:
      "Incidents pédagogiques, administratifs et techniques + actions correctives (amélioration continue — indicateurs 31/32).",
    colonnes: [
      "Date",
      "Type",
      "Gravité",
      "Titre",
      "Session",
      "Statut",
      "Action corrective",
      "Résolu le",
    ],
    lignes: rows.map((i) => [
      formatDateFr(i.dateIncident),
      INCIDENT_TYPE_LABELS[i.type] ?? i.type,
      INCIDENT_GRAVITE_LABELS[i.gravite] ?? i.gravite,
      i.titre,
      i.session?.numero ?? "",
      INCIDENT_STATUT_LABELS[i.statut] ?? i.statut,
      i.actionCorrective,
      formatDateFr(i.resoluAt),
    ]),
    mentionBasDePage: MENTION_EXPORT,
  };
}

const BUILDERS: Record<RegistreType, () => Promise<Omit<RegistreData, "dateEdition">>> = {
  reclamations: buildReclamations,
  veille: buildVeille,
  revue_direction: buildRevueDirection,
  partenariats: buildPartenariats,
  sous_traitants: buildSousTraitants,
  incidents: buildIncidents,
};

const FILENAMES: Record<RegistreType, string> = {
  reclamations: "registre-reclamations",
  veille: "journal-veille",
  revue_direction: "revues-direction-plan-amelioration",
  partenariats: "registre-partenariats",
  sous_traitants: "registre-sous-traitants",
  incidents: "registre-incidents",
};

// ─────────────────────────────────────────────────────────────────────────────
// renderRegistrePdfBuffer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sélectionne les données réelles du registre `type` et rend le PDF d'état.
 * Retourne le Buffer + un nom de fichier horodaté.
 */
export async function renderRegistrePdfBuffer(
  type: RegistreType,
): Promise<RegistrePdfBufferResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("registres-pdf: export indisponible en mode stub.invalid");
  }

  const now = new Date();
  const [registre, identite] = await Promise.all([BUILDERS[type](), getOrganismeIdentite()]);

  const data: RegistreData = { ...registre, dateEdition: now.toLocaleDateString("fr-FR") };
  const { buffer } = await renderPdfToBuffer(React.createElement(RegistrePdf, { data, identite }));

  const horodatage = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return { buffer, filename: `${FILENAMES[type]}-${horodatage}.pdf` };
}
