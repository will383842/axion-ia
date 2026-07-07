/**
 * Qualiopi — Service Supports de formation pédagogiques (T13 AGENT B).
 *
 * `genererSupport`  : génère (ou régénère) un support PDF pour une formation.
 *   - Lit la Formation, construit le contenu via support-builder (pur).
 *   - Enrichissement IA OPTIONNEL : si `enrichirIA` ET pas stub ET flag activé,
 *     enrichit via l'Anthropic provider. Désactivé par défaut (contenu builder pur).
 *   - Rend + stocke le PDF via renderSupportToStored.
 *   - Upsert SupportFormation (version incrémentée si existant).
 *
 * `listSupports`    : liste tous les supports d'une formation.
 * `supprimerSupport`: supprime un support par id.
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", mutations lèvent,
 * lectures retournent []. PDF non généré en mode stub.
 *
 * Enrichissement IA court-circuité si :
 *   - `enrichirIA` est false ou absent
 *   - DATABASE_URL contient "stub.invalid"
 *   - ANTHROPIC_API_KEY absent
 *   - Appel IA échoue → fallback silencieux sur contenu builder (fail-soft)
 */

import { prisma } from "@/lib/prisma";
import { readContenuDetaille } from "@/server/qualiopi/engine/content-schema";
import { construireSupport, titreSupport } from "./support-builder";
import { renderSupportToStored } from "./render-support";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import type { SupportType, SupportContenu, FormationInput } from "./types";
import type { SupportFormation } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/** Convertit une valeur JSON Prisma en string[]. */
function jsonToStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
    } catch {
      return [value];
    }
  }
  return [];
}

/** Mappe un record Formation Prisma vers FormationInput (builder). */
function toFormationInput(f: {
  titre: string;
  dureeHeures: number;
  modalite?: string | null;
  objectifsPedagogiques: unknown;
  programmeDetaille: unknown;
  methodesPedagogiques: string;
  moyensTechniques: string;
  ressourcesPedagogiques: unknown;
}): FormationInput {
  // programmeDetaille peut être :
  //  - un TABLEAU de modules (formations issues du catalogue), ou
  //  - un OBJET { modules:[...], persona, contenuDetaille, ... } (moteur IA).
  // On extrait le tableau de modules pour le fallback squelette dans les 2 cas.
  let raw: unknown = f.programmeDetaille;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      raw = null;
    }
  }
  let programmeDetaille: FormationInput["programmeDetaille"] = [];
  if (Array.isArray(raw)) {
    programmeDetaille = raw as FormationInput["programmeDetaille"];
  } else if (raw !== null && typeof raw === "object") {
    const modules = (raw as Record<string, unknown>)["modules"];
    if (Array.isArray(modules)) {
      programmeDetaille = modules as FormationInput["programmeDetaille"];
    }
  }

  // Contenu détaillé riche (chemin premium) — présent après l'étape « contenu »
  // du moteur. `readContenuDetaille` est défensif (retourne null si absent/invalide).
  const contenuDetaille = readContenuDetaille(f.programmeDetaille);

  // Fil rouge + livrables J0/J+7/J+30 — issus de la structure (objet programmeDetaille).
  const structObj =
    raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  const filRouge =
    typeof structObj?.["fil_rouge"] === "string" ? (structObj["fil_rouge"] as string) : "";
  const livrables = structObj
    ? {
        j0: jsonToStringArray(structObj["livrables_j0"]),
        j1: jsonToStringArray(structObj["livrables_j1"]),
        j30: jsonToStringArray(structObj["livrables_j30"]),
      }
    : { j0: [], j1: [], j30: [] };
  const hasLivrables = livrables.j0.length + livrables.j1.length + livrables.j30.length > 0;

  return {
    titre: f.titre,
    dureeHeures: f.dureeHeures,
    ...(f.modalite ? { modalite: f.modalite } : {}),
    objectifsPedagogiques: jsonToStringArray(f.objectifsPedagogiques),
    programmeDetaille,
    methodesPedagogiques: f.methodesPedagogiques ? [f.methodesPedagogiques] : [],
    moyensTechniques: f.moyensTechniques ? [f.moyensTechniques] : [],
    ressourcesPedagogiques: jsonToStringArray(f.ressourcesPedagogiques),
    ...(contenuDetaille ? { contenuDetaille } : {}),
    ...(filRouge ? { filRouge } : {}),
    ...(hasLivrables ? { livrables } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Enrichissement IA (OPTIONNEL — fail-soft)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tente d'enrichir un SupportContenu via l'Anthropic provider.
 * Court-circuité si stub, clé absente, ou appel échoue.
 * Retourne le contenu d'origine en cas d'échec (fail-soft).
 */
async function enrichirContenuIA(
  contenu: SupportContenu,
  type: SupportType,
  formationTitre: string,
): Promise<SupportContenu> {
  // Court-circuit explicite stub
  if (isStub()) return contenu;
  if (!process.env["ANTHROPIC_API_KEY"]) return contenu;

  try {
    // Import dynamique pour éviter l'initialisation du provider au build
    const { anthropicProvider } = await import("@/server/content-gen/providers/anthropic");

    const prompt = [
      `Tu enrichis un support pédagogique de type "${type}" pour la formation "${formationTitre}".`,
      `Voici son contenu structuré (JSON) :`,
      JSON.stringify(contenu),
      ``,
      `Enrichis UNIQUEMENT les blocs de type "paragraphe" et "liste" en améliorant leur clarté pédagogique.`,
      `Conserve STRICTEMENT la structure JSON (même clés, même types).`,
      `Réponds UNIQUEMENT avec le JSON enrichi, sans commentaire.`,
    ].join("\n");

    const response = await anthropicProvider.generate({
      jobId: `qualiopi-support-${type}`,
      contentType: "qualiopi_support",
      role: "text",
      systemPrompt:
        "Tu es un expert en ingénierie pédagogique. Tu enrichis des supports de formation professionnelle en français, en respectant strictement la structure JSON fournie.",
      userPrompt: prompt,
      maxTokens: 4096,
      temperature: 0.3,
    });

    const enriched = JSON.parse(response.output) as unknown;
    if (
      enriched !== null &&
      typeof enriched === "object" &&
      "sections" in enriched &&
      Array.isArray((enriched as { sections: unknown }).sections)
    ) {
      return enriched as SupportContenu;
    }
    return contenu;
  } catch {
    // Fail-soft : retourne le contenu builder pur
    return contenu;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// genererSupport
// ─────────────────────────────────────────────────────────────────────────────

export interface GenererSupportInput {
  formationId: string;
  type: SupportType;
  /** Enrichissement IA optionnel — désactivé par défaut. */
  enrichirIA?: boolean;
}

/**
 * Génère (ou régénère) un support de formation pédagogique.
 *
 * 1. Lit la Formation depuis la DB.
 * 2. Construit le SupportContenu via le builder pur.
 * 3. (Optionnel) Enrichit le contenu via l'IA Anthropic si `enrichirIA` + pas stub.
 * 4. Rend le PDF + stocke dans R2 (fail-soft).
 * 5. Upsert SupportFormation (version incrémentée si existant).
 *
 * @throws Error si stub.invalid (mutation interdite au build).
 * @throws Error si formation introuvable.
 */
export async function genererSupport(
  input: GenererSupportInput,
): Promise<{ id: string; pdfUrl: string | null }> {
  if (isStub()) {
    throw new Error("Génération de support impossible en mode stub (build).");
  }

  const { formationId, type, enrichirIA = false } = input;

  // 1. Lire la formation
  const formation = await prisma.formation.findUnique({
    where: { id: formationId },
    select: {
      id: true,
      titre: true,
      dureeHeures: true,
      modalite: true,
      objectifsPedagogiques: true,
      programmeDetaille: true,
      methodesPedagogiques: true,
      moyensTechniques: true,
      ressourcesPedagogiques: true,
    },
  });

  if (!formation) {
    throw new Error(`Formation introuvable : ${formationId}`);
  }

  // 2. Lire l'identité organisme
  const identite = await getOrganismeIdentite();

  // 3. Construire le contenu (pur)
  const formationInput = toFormationInput(formation);
  const titre = titreSupport(type, formation.titre);
  let contenu = construireSupport(type, formationInput);

  // 4. Enrichissement IA optionnel
  if (enrichirIA) {
    contenu = await enrichirContenuIA(contenu, type, formation.titre);
  }

  // 5. Vérifier si un support existant pour cet (formationId, type)
  const existing = await prisma.supportFormation.findFirst({
    where: { formationId, type },
    select: { id: true, version: true },
    orderBy: { version: "desc" },
  });

  const version = existing ? existing.version + 1 : 1;

  // 6. Rendre le PDF + stocker
  let pdfKey: string | null = null;
  let pdfUrl: string | null = null;
  let hashSha256 = "";
  let sizeBytes = 0;

  try {
    const rendered = await renderSupportToStored({
      type,
      titre,
      contenu,
      version,
      identite,
    });
    pdfKey = rendered.pdfKey;
    pdfUrl = rendered.pdfUrl;
    hashSha256 = rendered.hashSha256;
    sizeBytes = rendered.sizeBytes;
  } catch {
    // fail-soft PDF : on persiste quand même le contenu textuel
  }

  // 7. Upsert SupportFormation
  const contenuJson = contenu as unknown as Record<string, unknown>;

  if (existing) {
    // Mettre à jour l'existant (version incrémentée)
    const updated = await prisma.supportFormation.update({
      where: { id: existing.id },
      data: {
        titre,
        contenu: contenuJson as never,
        version,
        ...(pdfKey ? { pdfKey } : {}),
        ...(pdfUrl ? { pdfUrl } : {}),
        ...(hashSha256 ? { hashSha256 } : {}),
        sizeBytes,
        aiGenerated: enrichirIA,
        statut: "genere",
        generatedAt: new Date(),
      },
      select: { id: true, pdfUrl: true },
    });
    return { id: updated.id, pdfUrl: updated.pdfUrl };
  } else {
    // Créer
    const created = await prisma.supportFormation.create({
      data: {
        formationId,
        type,
        titre,
        contenu: contenuJson as never,
        version,
        ...(pdfKey ? { pdfKey } : {}),
        ...(pdfUrl ? { pdfUrl } : {}),
        ...(hashSha256 ? { hashSha256 } : {}),
        sizeBytes,
        aiGenerated: enrichirIA,
        statut: "genere",
        generatedAt: new Date(),
      },
      select: { id: true, pdfUrl: true },
    });
    return { id: created.id, pdfUrl: created.pdfUrl };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// regenererSupport
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Regénère un support existant par son id (relit formationId + type depuis la DB
 * et délègue à genererSupport).
 *
 * @throws Error si stub.invalid.
 * @throws Error si support introuvable.
 */
export async function regenererSupport(input: {
  id: string;
}): Promise<{ id: string; pdfUrl: string | null }> {
  if (isStub()) {
    throw new Error("Régénération impossible en mode stub (build).");
  }

  const existing = await prisma.supportFormation.findUnique({
    where: { id: input.id },
    select: { formationId: true, type: true },
  });

  if (!existing) {
    throw new Error(`Support introuvable : ${input.id}`);
  }

  return genererSupport({ formationId: existing.formationId, type: existing.type });
}

// ─────────────────────────────────────────────────────────────────────────────
// genererTousSupports — génération EN LOT des 7 supports d'une formation
// ─────────────────────────────────────────────────────────────────────────────

/** Les 7 types de supports produits pour une formation. */
export const TOUS_SUPPORT_TYPES: readonly SupportType[] = [
  "slides_formateur",
  "slides_stagiaire",
  "livret_stagiaire",
  "memo",
  "guide_animation",
  "exercices",
  "grille_eval",
];

export interface GenererTousSupportsResult {
  formationId: string;
  ok: Array<{ type: SupportType; id: string }>;
  echecs: Array<{ type: SupportType; erreur: string }>;
}

/**
 * Génère (ou régénère) les 7 supports d'une formation, séquentiellement.
 * Un échec sur un type n'interrompt pas les autres (chaque type est isolé).
 * Idéal pour un bouton « Générer tous les supports » ou un batch multi-formations.
 *
 * @throws Error si stub.invalid.
 */
export async function genererTousSupports(input: {
  formationId: string;
  enrichirIA?: boolean;
}): Promise<GenererTousSupportsResult> {
  if (isStub()) {
    throw new Error("Génération de supports impossible en mode stub (build).");
  }
  const ok: GenererTousSupportsResult["ok"] = [];
  const echecs: GenererTousSupportsResult["echecs"] = [];

  for (const type of TOUS_SUPPORT_TYPES) {
    try {
      const res = await genererSupport({
        formationId: input.formationId,
        type,
        ...(input.enrichirIA !== undefined ? { enrichirIA: input.enrichirIA } : {}),
      });
      ok.push({ type, id: res.id });
    } catch (err) {
      echecs.push({ type, erreur: err instanceof Error ? err.message : String(err) });
    }
  }

  return { formationId: input.formationId, ok, echecs };
}

// ─────────────────────────────────────────────────────────────────────────────
// listSupports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liste tous les supports d'une formation, triés par type puis version décroissante.
 * Retourne [] si stub.invalid.
 */
export async function listSupports(formationId: string): Promise<SupportFormation[]> {
  if (isStub()) return [];

  return prisma.supportFormation.findMany({
    where: { formationId },
    orderBy: [{ type: "asc" }, { version: "desc" }],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// supprimerSupport
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Supprime un support par id.
 *
 * @throws Error si stub.invalid (mutation interdite au build).
 * @throws Error si support introuvable.
 */
export async function supprimerSupport(id: string): Promise<void> {
  if (isStub()) {
    throw new Error("Suppression impossible en mode stub (build).");
  }

  await prisma.supportFormation.delete({ where: { id } });
}
