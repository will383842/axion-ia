/**
 * Mapping SSOT d'un kit (ZIP) → bibliothèque documents-interventions.
 *
 * Convertit l'arborescence d'un kit vers (interventionSlug × slot × kind).
 * Module PUR (aucune I/O). Famille-aware :
 *   - `formation` : 1 dossier/formation × Documents_DOCX + Documents_PDF + 00_Presentation
 *     → 1 slug d'intervention (FOLDER_TO_SLUG, sinon slugify).
 *   - `un_a_un`   : dossiers `Dirigeant/` et `Collaborateur/` × Documents_DOCX (+ PDF)
 *     → PLUSIEURS slugs (la même trame couvre les formats 1 jour ET 2 jours).
 *
 * ⚠️ Ce module ne définit QUE la correspondance fichier→clé de slot. Le titre,
 * la catégorie et la VISIBILITÉ sont la propriété du catalogue SSOT
 * (intervention-documents-catalog.ts, via getSlot) — kit-import.ts les y lit
 * pour ne JAMAIS diverger de l'UI manuelle (déterminisme garanti).
 */

import type { InterventionFamille } from "@/content/intervention-documents-catalog";
import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";

// ============================ FORMATION ======================================

/**
 * ⚠️ LEGACY — kits produits avant la refonte AXION (PR #327, 2026-07-15).
 * Ces slugs n'existent PLUS dans le catalogue V2 : conservés uniquement pour
 * réimporter un ancien ZIP. Les kits AXION 2026 passent par
 * `resolveAxionSlug` (numéro de dossier → `numero` du catalogue V2).
 */
export const FOLDER_TO_SLUG: Readonly<Record<string, string>> = {
  Formation_IA_Express: "ia-express",
  Art_du_Prompt: "art-du-prompt",
  IA_Bureau_Rapide: "ia-au-bureau",
  IA_Commercial: "ia-commercial",
  IA_Conformite: "ia-conformite",
  IA_Fondamentaux: "ia-fondamentaux",
  IA_Securite: "ia-securite",
  // 10 formations catalogue V2 (kits produits 2026-06-14)
  IA_Sur_Le_Terrain: "ia-sur-le-terrain",
  Automatisations_Decouverte: "automatisations-decouverte",
  Claude_Decouverte: "claude-decouverte",
  IA_Integration_Metier: "ia-integration-metier",
  IA_Commercial_Avance: "ia-commercial-avance",
  Agents_Automatisations: "agents-automatisations",
  Claude_Createur: "claude-createur",
  IA_Transformation_Equipe: "ia-transformation-equipe",
  Agents_Automatisations_Avance: "agents-automatisations-avance",
  Claude_Architecte: "claude-architecte",
};

/**
 * Préfixe de fichier numéroté (NN_) → CLÉ de slot du catalogue (FORMATION).
 * Les slots 08/09/10 (test/éval/satisfaction/attestation) sont EXCLUS : générés
 * par le Formation Engine (pas d'upload statique).
 */
export const FILE_TO_SLOT: Readonly<Record<string, string>> = {
  "01": "livret_apprenant",
  "02": "guide_animation",
  "03": "cahier_exercices",
  "04": "corriges",
  "05": "ressources",
  "06": "programme",
  "07": "scenario_pedagogique",
  // Livrables participants (offre AXION 2026-07) — actifs partagés.
  "11": "memo_methode",
  "12": "charte_ia",
  "13": "bibliotheque_prompts",
  "14": "kits_assistants",
  "15": "guide_cas_usage",
};

/** Slot diaporama (depuis 00_Presentation : .pptx source + slides .pdf). FORMATION seule. */
export const DIAPORAMA_SLOT_KEY = "diaporama";

export const SKIP_PREFIXES: ReadonlySet<string> = new Set(["08", "09", "10"]);

// ==================== KIT AXION 2026 (arborescence par TYPE) =================
//
// Le catalogue AXION livré le 2026-07-17 n'utilise PAS les préfixes NN_ par slot
// (`FILE_TO_SLOT`) : un dossier par prestation, numéroté 01→15, et des fichiers
// nommés par TYPE. Exemple :
//
//   01_Formation_Bien_demarrer_avec_lIA_4h/
//     00_Programme/01_Bien_demarrer_avec_lIA_4h.docx   → programme
//     00_Programme/Methode_AXION.docx                  → ressources
//     01_Support_de_presentation/*.pptx                → diaporama
//     02_Documents_formateur/Guide_formateur_01.docx   → guide_animation
//     02_Documents_formateur/Conducteur_de_session_01.docx → scenario_pedagogique
//     02_Documents_formateur/Exercices_et_corriges_01.docx → corriges
//     02_Documents_formateur/Grille_evaluation_01.docx     → (ignoré : Formation Engine)
//     03_Documents_stagiaire/Livret_stagiaire_01_*.docx    → livret_apprenant
//     03_Documents_stagiaire/Memo_AXION.docx               → memo_methode
//
// Le lien dossier→formation passe par le NUMÉRO (`numero` du catalogue V2), pas
// par une table de noms : un dossier renommé continue de résoudre.

/** Sous-dossiers du kit AXION — leur présence signe l'arborescence 2026. */
const AXION_SUBFOLDERS: ReadonlySet<string> = new Set([
  "00_Programme",
  "00_Cadre",
  "01_Support_de_presentation",
  "01_Support_de_la_journee",
  "02_Documents_formateur",
  "03_Documents_stagiaire",
  "03_Documents_participant",
]);

/**
 * Nom de fichier (kit AXION) → clé de slot. Ordonné : le premier motif qui
 * matche gagne. `Exercices_et_corriges` contient les CORRIGÉS → slot formateur,
 * jamais un slot exposable au stagiaire.
 */
const AXION_NAME_TO_SLOT: ReadonlyArray<{ re: RegExp; slot: string }> = [
  // Non ancré : les fichiers sont tantôt nus (`Methode_AXION.docx`), tantôt
  // préfixés marque (`Axion-IA_Memo_AXION.docx`). « Methode » avant « Memo ».
  { re: /Methode_AXION\./i, slot: "ressources" },
  { re: /Memo_AXION\./i, slot: "memo_methode" },
  { re: /Guide_formateur/i, slot: "guide_animation" },
  { re: /Conducteur_de_session/i, slot: "scenario_pedagogique" },
  { re: /Exercices_et_corriges/i, slot: "corriges" },
  { re: /Animation_travaux_collectifs/i, slot: "cahier_exercices" },
  { re: /Livret_stagiaire|Carnet_participant/i, slot: "livret_apprenant" },
];

/**
 * Documents du kit AXION volontairement NON importés : le Formation Engine les
 * génère (le catalogue les marque `qualiopiDocType` / `generatedOnly`, et
 * `kit-import.ts` les refuserait de toute façon). Listés ici pour que le
 * classifieur les ignore en silence plutôt que de les signaler « non reconnus ».
 */
const AXION_SKIP_NAMES: ReadonlyArray<RegExp> = [/Grille_evaluation/i];

/** Numéro de dossier AXION (« 07_Formation_… » → 7) → slug du catalogue V2. */
export function resolveAxionSlug(folder: string): string | null {
  const m = folder.match(/^(\d{2})_/);
  if (!m) return null;
  const numero = Number.parseInt(m[1]!, 10);
  return FORMATIONS_V2.find((f) => f.numero === numero)?.slugFr ?? null;
}

// ============================ 1-TO-1 (un_a_un) ===============================

/**
 * Dossier 1-to-1 (public) → slugs d'intervention destinataires.
 * La MÊME trame couvre les formats 1 jour ET 2 jours → un dossier alimente les
 * deux prestations du public. Le slot `attestation_emargement` (préfixe 15) est
 * généré par le Formation Engine : absent de la table ci-dessous, donc ignoré.
 */
export const UN_A_UN_FOLDER_TO_SLUGS: Readonly<Record<string, ReadonlyArray<string>>> = {
  Dirigeant: ["dirigeant-vision-strategique", "dirigeant-vision-strategique-2j"],
  Collaborateur: ["coaching-decouverte", "coaching-optimisation-2j"],
};

/**
 * Préfixe de fichier numéroté (NN_) → CLÉ de slot du catalogue (UN_A_UN).
 *
 * ⚠️ EXCLUS volontairement (générés/agrégés par le Formation Engine, JAMAIS
 * dupliqués ici — cf. catalogue `qualiopiDocType` + schéma Prisma) :
 *   03 positionnement_individuel · 13 evaluation_progression · 14 satisfaction_1to1
 *   15 attestation_emargement (generatedOnly).
 * Même règle que les formations (dont l'import exclut test/éval/satisfaction/attestation).
 * Les `.docx` correspondants restent dans le kit comme MODÈLES de référence
 * (uploadables à la main), mais ne sont pas importés en masse.
 */
export const UN_A_UN_FILE_TO_SLOT: Readonly<Record<string, string>> = {
  "01": "cadrage_objectifs",
  "02": "analyse_activite",
  "04": "guide_coach",
  "05": "parcours_seances",
  "06": "fiches_exercices",
  "07": "ressources_perso",
  "08": "plan_optimisation",
  "09": "cr_seance",
  "10": "phase_reflexive",
  "11": "corriges_1to1",
  "12": "journal_progression",
};

// ============================ Helpers ========================================

/** slugifie un nom de dossier en fallback (tolérance d'évolution du kit). */
export function slugifyFolder(folder: string): string {
  return folder
    .replace(/^Formation_/i, "")
    .replace(/_/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
}

/** Résout le slug d'intervention pour un dossier de FORMATION (map explicite, sinon slugify). */
export function resolveSlug(folder: string): string {
  return FOLDER_TO_SLUG[folder] ?? slugifyFolder(folder);
}

/** Résout le(s) slug(s) d'intervention destinataires d'un dossier, selon la famille. */
export function resolveSlugs(folder: string, famille: InterventionFamille): ReadonlyArray<string> {
  if (famille === "formation") {
    const s = resolveSlug(folder);
    return s ? [s] : [];
  }
  if (famille === "un_a_un") {
    return UN_A_UN_FOLDER_TO_SLUGS[folder] ?? [];
  }
  return []; // `audit` : pas (encore) d'import de kit.
}

/** Table préfixe→slot selon la famille. */
function fileToSlotMap(famille: InterventionFamille): Readonly<Record<string, string>> {
  if (famille === "formation") return FILE_TO_SLOT;
  if (famille === "un_a_un") return UN_A_UN_FILE_TO_SLOT;
  return {};
}

/** Dossiers de premier niveau reconnus pour une famille (sert au signalement « non reconnus »). */
export function knownTopFolders(famille: InterventionFamille): ReadonlySet<string> {
  if (famille === "formation") return new Set(Object.keys(FOLDER_TO_SLUG));
  if (famille === "un_a_un") return new Set(Object.keys(UN_A_UN_FOLDER_TO_SLUGS));
  return new Set();
}

/**
 * Vrai si le dossier est reconnu. À préférer à `knownTopFolders` : les dossiers
 * du kit AXION sont résolus dynamiquement (par numéro), donc ils ne peuvent pas
 * figurer dans un Set figé — sans ça, un kit AXION correctement importé serait
 * quand même signalé « non reconnu ».
 */
export function isKnownTopFolder(folder: string, famille: InterventionFamille): boolean {
  if (famille === "formation") {
    return folder in FOLDER_TO_SLUG || resolveAxionSlug(folder) !== null;
  }
  return knownTopFolders(famille).has(folder);
}

export interface ClassifiedEntry {
  /** Slug(s) d'intervention destinataires (≥ 1 ; plusieurs pour les variantes 1j/2j en 1-to-1). */
  slugs: ReadonlyArray<string>;
  folder: string;
  /** Clé de slot du catalogue (le titre/catégorie/visibilité s'y lisent). */
  slot: string;
  kind: "source" | "pdf";
  ext: string;
}

/**
 * Classe un chemin de fichier (relatif au ZIP) vers (slugs, slot, kind), selon la famille.
 * Retourne null si le fichier n'est pas un document importable (slot exclu,
 * dossier non reconnu, extension non pertinente…).
 *
 * Chemins attendus :
 *   FORMATION : <Formation>/Documents_DOCX/NN_*.docx · /Documents_PDF/NN_*.pdf · /00_Presentation/*.pptx|*SLIDES*.pdf
 *   UN_A_UN   : <Dirigeant|Collaborateur>/Documents_DOCX/NN_*.docx · /Documents_PDF/NN_*.pdf
 */
export function classifyEntry(
  path: string,
  famille: InterventionFamille = "formation",
): ClassifiedEntry | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 3) return null;
  const folder = parts[0]!;
  const sub = parts[1]!;
  const filename = parts[parts.length - 1]!;
  const lower = filename.toLowerCase();
  const ext = (lower.split(".").pop() ?? "").toLowerCase();

  // Kit AXION 2026 (arborescence par TYPE) — reconnu au sous-dossier.
  if (famille === "formation" && AXION_SUBFOLDERS.has(sub)) {
    return classifyAxionEntry(folder, sub, filename, ext);
  }

  const slugs = resolveSlugs(folder, famille);
  if (slugs.length === 0) return null;

  // Diaporama : FORMATION uniquement.
  if (sub === "00_Presentation") {
    if (famille !== "formation") return null;
    if (ext === "pptx") return { slugs, folder, slot: DIAPORAMA_SLOT_KEY, kind: "source", ext };
    if (ext === "pdf") return { slugs, folder, slot: DIAPORAMA_SLOT_KEY, kind: "pdf", ext };
    return null;
  }

  // Documents numérotés (NN_).
  const m = filename.match(/^(\d{2})_/);
  if (!m) return null;
  const prefix = m[1]!;
  if (famille === "formation" && SKIP_PREFIXES.has(prefix)) return null;
  const slot = fileToSlotMap(famille)[prefix];
  if (!slot) return null;

  if (sub === "Documents_DOCX" && ext === "docx")
    return { slugs, folder, slot, kind: "source", ext };
  if (sub === "Documents_PDF" && ext === "pdf") return { slugs, folder, slot, kind: "pdf", ext };
  return null;
}

/**
 * Classe une entrée du kit AXION 2026. Le programme contractuel vit dans
 * `00_Programme` sous un nom numéroté (`01_Bien_demarrer….docx`) — d'où la règle
 * de repli : dans ce dossier, tout .docx non identifié par nom EST le programme.
 */
function classifyAxionEntry(
  folder: string,
  sub: string,
  filename: string,
  ext: string,
): ClassifiedEntry | null {
  const slug = resolveAxionSlug(folder);
  if (!slug) return null;
  const slugs = [slug];

  if (AXION_SKIP_NAMES.some((re) => re.test(filename))) return null;

  // Support projeté : .pptx = source éditable, .pdf = version projetable.
  if (sub === "01_Support_de_presentation" || sub === "01_Support_de_la_journee") {
    if (ext === "pptx") return { slugs, folder, slot: DIAPORAMA_SLOT_KEY, kind: "source", ext };
    if (ext === "pdf") return { slugs, folder, slot: DIAPORAMA_SLOT_KEY, kind: "pdf", ext };
    return null;
  }

  if (ext !== "docx" && ext !== "pdf") return null;
  const kind = ext === "pdf" ? "pdf" : "source";

  const named = AXION_NAME_TO_SLOT.find((r) => r.re.test(filename));
  if (named) return { slugs, folder, slot: named.slot, kind, ext };

  // Repli : le programme contractuel (« NN_Titre.docx » dans 00_Programme/00_Cadre).
  if ((sub === "00_Programme" || sub === "00_Cadre") && /^\d{2}_/.test(filename)) {
    return { slugs, folder, slot: "programme", kind, ext };
  }

  return null;
}

/** Vrai si le fichier 00_Presentation/*.pdf est bien le diaporama (préfère *SLIDES*). */
export function isDiaporamaSlidesPdf(filename: string): boolean {
  return /slides/i.test(filename) || filename.toLowerCase().endsWith(".pdf");
}

/** Clé R2 canonique (alignée sur keys.ts). */
export function buildKitR2Key(
  slug: string,
  slot: string,
  version: number,
  kind: "source" | "pdf",
  ext: string,
): string {
  const safe = (s: string) =>
    String(s)
      .replace(/[^a-z0-9._-]/gi, "")
      .toLowerCase();
  const cleanExt = safe(ext).replace(/^\.+/, "") || "bin";
  return `interventions/${safe(slug)}/${safe(slot)}/v${version}/${kind}.${cleanExt}`;
}
