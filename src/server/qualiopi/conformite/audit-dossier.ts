/**
 * Qualiopi — Génération du manifeste d'audit (AGENT B — T12).
 *
 * genererManifesteAudit() : pour chaque indicateur des 32 RNQ V9, liste les
 *   preuves disponibles (types DocumentGenere présents, comptes) + état de
 *   couverture. Retourne JSON + Markdown. PAS de binaire ZIP.
 *
 * Stub-aware : early-exit si DATABASE_URL contient "stub.invalid".
 */

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { evaluerConformite } from "@/server/qualiopi/conformite/conformite-service";
import type { DocumentType } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types exportés
// ─────────────────────────────────────────────────────────────────────────────

export interface PreuveDocument {
  /** Type Prisma du document (DocumentType enum). */
  readonly type: DocumentType;
  /** Nombre de documents de ce type en base. */
  readonly count: number;
}

export interface IndicateurManifeste {
  readonly numero: number;
  readonly critere: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly libelle: string;
  readonly super: boolean;
  readonly statut: "couvert" | "a_completer" | "non_applicable";
  /** Preuves textuelles (depuis evaluerConformite). */
  readonly preuves: string[];
  /** Documents Prisma présents pertinents pour cet indicateur. */
  readonly documents: PreuveDocument[];
}

export interface ManifesteAuditPayload {
  readonly meta: {
    readonly genereAt: string;
    readonly version: string;
    readonly nbIndicateurs: number;
    readonly nbCouverts: number;
    readonly nbApplicables: number;
    readonly scorePct: number;
  };
  readonly indicateurs: IndicateurManifeste[];
}

export interface ManifesteAuditResult {
  readonly json: ManifesteAuditPayload;
  readonly markdown: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping indicateur → types de documents pertinents
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Associe chaque indicateur à la liste des DocumentType qui servent de preuve.
 * Seuls les types présents en base sont comptés (les 0 ne sont pas affichés).
 */
const INDICATEUR_DOCUMENT_TYPES: Partial<Record<number, DocumentType[]>> = {
  // C1 — Information public
  1: ["livret_accueil", "reglement_interieur"],
  2: ["satisfaction", "grille_evaluation"],
  3: ["certificat_realisation", "attestation"],

  // C2 — Objectifs
  4: ["positionnement"],
  5: ["convocation"],
  6: ["convention", "convention_tripartite"],
  7: ["convention", "lettre_mission"],
  8: ["positionnement"],

  // C3 — Accueil & suivi
  9: ["convocation", "livret_accueil"],
  10: ["convention"],
  11: ["grille_evaluation", "attestation"],
  12: ["emargement", "releve_connexion"],
  13: [],
  14: [],
  15: [],
  16: ["certificat_realisation", "attestation"],

  // C4 — Moyens
  17: ["lettre_mission"],
  18: ["convention_tripartite"],
  19: ["kit_opco", "kit_cpf", "kit_france_travail"],
  20: [],

  // C5 — Qualification
  21: ["lettre_mission"],
  22: [],

  // C6 — Environnement
  23: [],
  24: [],
  25: [],
  26: [],
  27: ["convention_tripartite"],
  28: [],
  29: [],

  // C7 — Amélioration
  30: ["satisfaction"],
  31: [],
  32: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// genererManifesteAudit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le manifeste d'audit Qualiopi.
 *
 * Pour chaque indicateur :
 *   1. Évaluation de conformité (via evaluerConformite).
 *   2. Comptage des DocumentGenere par type (preuves documentaires).
 * Résultat : JSON structuré + Markdown lisible par l'auditeur.
 */
export async function genererManifesteAudit(): Promise<ManifesteAuditResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return buildEmptyManifeste();
  }

  // Évaluation des 32 indicateurs
  const conformite = await evaluerConformite();

  // Comptage global des documents par type (une seule requête groupBy)
  const docCounts = await prisma.documentGenere.groupBy({
    by: ["type"],
    _count: { _all: true },
  });

  // ── Preuves enrichies pour le manifeste ──────────────────────────────────
  // off.23/24/25 : veille par type
  const [nbVeilleLegale, nbVeilleMetiers, nbVeillePedagogique] = await Promise.all([
    prisma.veille.count({ where: { type: "legale" } }),
    prisma.veille.count({ where: { type: "metiers" } }),
    prisma.veille.count({ where: { type: "pedagogique" } }),
  ]);

  // off.26 : nom du référent handicap
  const referentHandicapNom = await getQualiopiConfig("referent_handicap_nom").catch(() => "");

  // off.30 : appréciations multi-parties
  const nbAppreciations = await prisma.appreciation.count();

  // off.21 : formateurs actifs avec CV
  const trainersAvecCV = await prisma.trainer.findMany({
    where: { actif: true, cvUrl: { not: null } },
    select: { id: true, nom: true, prenom: true, cvUrl: true },
  });

  // Preuves supplémentaires par indicateur (complètent celles de conformite-service)
  const preuvesSuppMap = new Map<number, string[]>([
    [23, nbVeilleLegale > 0 ? [`${nbVeilleLegale} entrée(s) de veille légale/réglementaire`] : []],
    [24, nbVeilleMetiers > 0 ? [`${nbVeilleMetiers} entrée(s) de veille emplois/métiers`] : []],
    [
      25,
      nbVeillePedagogique > 0
        ? [`${nbVeillePedagogique} entrée(s) de veille pédagogique/technologique`]
        : [],
    ],
    [
      26,
      [
        ...(referentHandicapNom.trim().length > 0
          ? [`Référent handicap désigné : ${referentHandicapNom}`]
          : ["Référent handicap : non renseigné en config"]),
      ],
    ],
    [
      30,
      [
        `${nbAppreciations} appréciation(s) multi-parties (stagiaire/entreprise/financeur/formateur)`,
      ],
    ],
    [
      21,
      trainersAvecCV.length > 0
        ? [
            `${trainersAvecCV.length} formateur(s) avec CV téléversé`,
            ...trainersAvecCV.map((t) => `- ${t.prenom ?? ""} ${t.nom} (CV : ${t.cvUrl ?? "—"})`),
          ]
        : ["Aucun formateur avec CV téléversé"],
    ],
  ]);

  const countByType = new Map<DocumentType, number>(docCounts.map((d) => [d.type, d._count._all]));

  // Construction des entrées du manifeste
  const indicateurs: IndicateurManifeste[] = conformite.indicateurs.map((ind) => {
    const docTypes = INDICATEUR_DOCUMENT_TYPES[ind.numero] ?? [];
    const documents: PreuveDocument[] = docTypes
      .map((type) => ({ type, count: countByType.get(type) ?? 0 }))
      .filter((d) => d.count > 0);

    // Fusionner les preuves de conformite-service avec les preuves enrichies du manifeste
    const preuvesSupplémentaires = preuvesSuppMap.get(ind.numero) ?? [];
    const toutesPreuves = [
      ...ind.preuves,
      // Ajouter seulement les preuves supplémentaires non déjà présentes
      ...preuvesSupplémentaires.filter((p) => !ind.preuves.includes(p)),
    ];

    return {
      numero: ind.numero,
      critere: ind.critere,
      libelle: ind.libelle,
      super: ind.super,
      statut: ind.statut,
      preuves: toutesPreuves,
      documents,
    };
  });

  const json: ManifesteAuditPayload = {
    meta: {
      genereAt: new Date().toISOString(),
      version: "RNQ-V9",
      nbIndicateurs: indicateurs.length,
      nbCouverts: conformite.nbCouverts,
      nbApplicables: conformite.nbApplicables,
      scorePct: conformite.scorePct,
    },
    indicateurs,
  };

  const markdown = buildMarkdown(json);

  return { json, markdown };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildMarkdown(payload: ManifesteAuditPayload): string {
  const lignes: string[] = [];

  lignes.push("# Manifeste d'audit Qualiopi — Axion-IA SAS");
  lignes.push("");
  lignes.push(`**Généré le :** ${new Date(payload.meta.genereAt).toLocaleString("fr-FR")}`);
  lignes.push(`**Référentiel :** ${payload.meta.version}`);
  lignes.push(
    `**Score de couverture :** ${payload.meta.nbCouverts} / ${payload.meta.nbApplicables} indicateurs applicables (${payload.meta.scorePct} %)`,
  );
  lignes.push("");
  lignes.push("---");
  lignes.push("");

  const criteres = [1, 2, 3, 4, 5, 6, 7] as const;

  for (const critere of criteres) {
    const inds = payload.indicateurs.filter((i) => i.critere === critere);
    if (inds.length === 0) continue;

    lignes.push(`## Critère ${critere}`);
    lignes.push("");

    for (const ind of inds) {
      const emoji =
        ind.statut === "couvert"
          ? "[OK]"
          : ind.statut === "non_applicable"
            ? "[N/A]"
            : "[A COMPLETER]";
      const superLabel = ind.super ? " ⭐" : "";
      lignes.push(`### Ind. ${ind.numero}${superLabel} — ${ind.libelle} ${emoji}`);
      lignes.push("");

      if (ind.statut !== "non_applicable") {
        if (ind.preuves.length > 0) {
          lignes.push("**Preuves :**");
          for (const p of ind.preuves) {
            lignes.push(`- ${p}`);
          }
        }

        if (ind.documents.length > 0) {
          lignes.push("");
          lignes.push("**Documents :**");
          for (const d of ind.documents) {
            lignes.push(`- \`${d.type}\` : ${d.count} document(s)`);
          }
        }

        if (ind.preuves.length === 0 && ind.documents.length === 0) {
          lignes.push("*Aucune preuve disponible.*");
        }
      } else {
        lignes.push("*Non applicable au périmètre de l'OF.*");
      }

      lignes.push("");
    }
  }

  lignes.push("---");
  lignes.push("");
  lignes.push(
    "*Ce manifeste est généré automatiquement par le Formation Engine Axion-IA. Il constitue un état des lieux à date et ne remplace pas un audit externe.*",
  );

  return lignes.join("\n");
}

function buildEmptyManifeste(): ManifesteAuditResult {
  const json: ManifesteAuditPayload = {
    meta: {
      genereAt: new Date().toISOString(),
      version: "RNQ-V9",
      nbIndicateurs: 0,
      nbCouverts: 0,
      nbApplicables: 0,
      scorePct: 0,
    },
    indicateurs: [],
  };
  return {
    json,
    markdown: "# Manifeste d'audit Qualiopi\n\n*Mode build — données indisponibles.*",
  };
}
