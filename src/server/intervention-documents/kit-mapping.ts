/**
 * Mapping SSOT du kit de formation → bibliothèque documents-interventions.
 *
 * Convertit l'arborescence d'un kit (1 dossier/formation × Documents_DOCX +
 * Documents_PDF + 00_Presentation) vers (interventionSlug × slot × kind).
 * Module PUR (aucune I/O) → partagé par l'import worker ET le script CLI, et
 * testable sans base ni R2.
 */

/** Dossier de formation (dans le ZIP) → slug d'intervention (booking-catalog). */
export const FOLDER_TO_SLUG: Readonly<Record<string, string>> = {
  Formation_IA_Express: "ia-express",
  Art_du_Prompt: "art-du-prompt",
  IA_Bureau_Rapide: "ia-au-bureau",
  IA_Commercial: "ia-commercial",
  IA_Conformite: "ia-conformite",
  IA_Fondamentaux: "ia-fondamentaux",
  IA_Securite: "ia-securite",
};

export interface SlotConfig {
  slot: string;
  titre: string;
  categorie: "stagiaires" | "formateur" | "cadre" | "evaluation";
  visibilite: "stagiaire" | "formateur" | "commercial" | "interne";
}

/**
 * Préfixe de fichier numéroté (NN_) → slot catalogue.
 * Visibilité : `programme` = commercial (les commerciaux le voient) ; le reste
 * = formateur (les formateurs le voient dans l'espace ressources).
 * Les slots 08/09/10 (test/éval/satisfaction/attestation) sont EXCLUS : générés
 * par le Formation Engine (pas d'upload statique).
 */
export const FILE_TO_SLOT: Readonly<Record<string, SlotConfig>> = {
  "01": {
    slot: "livret_apprenant",
    titre: "Livret apprenant",
    categorie: "stagiaires",
    visibilite: "formateur",
  },
  "02": {
    slot: "guide_animation",
    titre: "Guide d'animation formateur",
    categorie: "formateur",
    visibilite: "formateur",
  },
  "03": {
    slot: "cahier_exercices",
    titre: "Cahier d'exercices / TP",
    categorie: "stagiaires",
    visibilite: "formateur",
  },
  "04": {
    slot: "corriges",
    titre: "Corrigés (formateur uniquement)",
    categorie: "formateur",
    visibilite: "formateur",
  },
  "05": {
    slot: "ressources",
    titre: "Ressources & aller plus loin",
    categorie: "stagiaires",
    visibilite: "formateur",
  },
  "06": {
    slot: "programme",
    titre: "Programme de formation détaillé",
    categorie: "cadre",
    visibilite: "commercial",
  },
  "07": {
    slot: "scenario_pedagogique",
    titre: "Scénario pédagogique / déroulé minuté",
    categorie: "formateur",
    visibilite: "formateur",
  },
};

/** Slot diaporama (depuis 00_Presentation : .pptx source + slides .pdf). */
export const DIAPORAMA_SLOT: SlotConfig = {
  slot: "diaporama",
  titre: "Diaporama formateur",
  categorie: "formateur",
  visibilite: "formateur",
};

export const SKIP_PREFIXES: ReadonlySet<string> = new Set(["08", "09", "10"]);

/** slugifie un nom de dossier en fallback (tolérance d'évolution du kit). */
export function slugifyFolder(folder: string): string {
  return folder
    .replace(/^Formation_/i, "")
    .replace(/_/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

/** Résout le slug d'intervention pour un dossier (map explicite, sinon slugify). */
export function resolveSlug(folder: string): string {
  return FOLDER_TO_SLUG[folder] ?? slugifyFolder(folder);
}

export interface ClassifiedEntry {
  slug: string;
  folder: string;
  slot: string;
  config: SlotConfig;
  kind: "source" | "pdf";
  ext: string;
}

/**
 * Classe un chemin de fichier (relatif au ZIP) vers (slug, slot, kind).
 * Retourne null si le fichier n'est pas un document importable (slot exclu,
 * dossier non reconnu, extension non pertinente…).
 *
 * Chemins attendus :
 *   <Formation>/Documents_DOCX/NN_*.docx      → source
 *   <Formation>/Documents_PDF/NN_*.pdf        → pdf
 *   <Formation>/00_Presentation/*.pptx        → diaporama source
 *   <Formation>/00_Presentation/*SLIDES*.pdf  → diaporama pdf
 */
export function classifyEntry(path: string): ClassifiedEntry | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 3) return null;
  const folder = parts[0]!;
  const sub = parts[1]!;
  const filename = parts[parts.length - 1]!;
  const lower = filename.toLowerCase();
  const ext = (lower.split(".").pop() ?? "").toLowerCase();
  const slug = resolveSlug(folder);

  // Diaporama
  if (sub === "00_Presentation") {
    if (ext === "pptx")
      return {
        slug,
        folder,
        slot: DIAPORAMA_SLOT.slot,
        config: DIAPORAMA_SLOT,
        kind: "source",
        ext,
      };
    if (ext === "pdf")
      return { slug, folder, slot: DIAPORAMA_SLOT.slot, config: DIAPORAMA_SLOT, kind: "pdf", ext };
    return null;
  }

  // Documents numérotés
  const m = filename.match(/^(\d{2})_/);
  if (!m) return null;
  const prefix = m[1]!;
  if (SKIP_PREFIXES.has(prefix)) return null;
  const config = FILE_TO_SLOT[prefix];
  if (!config) return null;

  if (sub === "Documents_DOCX" && ext === "docx")
    return { slug, folder, slot: config.slot, config, kind: "source", ext };
  if (sub === "Documents_PDF" && ext === "pdf")
    return { slug, folder, slot: config.slot, config, kind: "pdf", ext };
  return null;
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
