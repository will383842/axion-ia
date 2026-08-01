/**
 * Content-gen — Libellés FR centralisés pour l'admin (SSOT d'affichage).
 *
 * Objectif : ne JAMAIS afficher un slug/enum technique anglais à l'écran
 * (`needs_review`, `tier_1_indexable`, `promoted_t1`, `blog_from_rss`…). Toutes
 * les pages admin content-gen lisent leurs libellés ici.
 *
 * Fichier PUR (pas de "use server", pas d'I/O, pas de JSX) → importable par les
 * Server Components ET les tests vitest. L'exhaustivité par enum est garantie
 * à la compilation (`Record<EnumPrisma, string>` → tsc échoue si un libellé
 * manque) ET au runtime (`__tests__/admin-labels.test.ts` itère les vraies
 * valeurs `$Enums`).
 */

import type {
  ContentType,
  ContentGenJobStatus,
  IndexationTier,
  ReviewStatus,
} from "../../../../prisma/generated/client";
import { WIZARD_CONTENT_TYPE_LABELS } from "@/server/actions/content-gen/campaign-wizard-constants";

export type AdminTone = "success" | "warning" | "destructive" | "neutral";

// ─── Type de contenu (ContentType, 22 valeurs) ──────────────────────────────
// Réutilise le SSOT wizard (20 types) + complète les 2 hors-wizard.
export const CONTENT_TYPE_LABELS_FR: Record<ContentType, string> = {
  ...WIZARD_CONTENT_TYPE_LABELS,
  landing_ville: "Page ville",
  barometer_insight: "Analyse Observatoire IA",
};

/** Libellé FR d'un type de contenu, avec repli sûr sur le slug si inconnu. */
export function contentTypeLabelFr(type: string): string {
  return (CONTENT_TYPE_LABELS_FR as Record<string, string>)[type] ?? type;
}

// ─── Statut d'un job de génération (ContentGenJobStatus, 14 valeurs) ─────────
export const JOB_STATUS_LABELS_FR: Record<ContentGenJobStatus, string> = {
  queued: "En file d'attente",
  running: "En cours",
  generating_text: "Rédaction en cours",
  generating_image: "Image en cours",
  running_qa: "Contrôle qualité",
  quality_improving: "Amélioration qualité",
  needs_review: "À relire",
  approved: "Approuvé",
  publishing: "Publication en cours",
  published: "Publié",
  failed: "Échec",
  cancelled: "Annulé",
  quarantined_critical: "Bloqué (contrôle critique)",
  quarantined_factcheck: "Bloqué (vérification des faits)",
};

export const JOB_STATUS_TONE: Record<ContentGenJobStatus, AdminTone> = {
  queued: "warning",
  running: "warning",
  generating_text: "warning",
  generating_image: "warning",
  running_qa: "warning",
  quality_improving: "warning",
  needs_review: "warning",
  approved: "success",
  publishing: "warning",
  published: "success",
  failed: "destructive",
  cancelled: "neutral",
  quarantined_critical: "destructive",
  quarantined_factcheck: "destructive",
};

// ─── Statut de relecture (ReviewStatus, 5 valeurs) ───────────────────────────
export const REVIEW_STATUS_LABELS_FR: Record<ReviewStatus, string> = {
  pending: "En attente de relecture",
  approved: "Approuvé",
  rejected: "Refusé",
  needs_edits: "Modifications demandées",
  promoted_t1: "Publié (indexable)",
};

export const REVIEW_STATUS_TONE: Record<ReviewStatus, AdminTone> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  needs_edits: "warning",
  promoted_t1: "success",
};

// ─── Niveau d'indexation (IndexationTier, 3 valeurs) ─────────────────────────
export const INDEXATION_TIER_LABELS_FR: Record<IndexationTier, string> = {
  tier_1_indexable: "Visible sur Google",
  tier_2_noindex_follow: "Non indexé (liens suivis)",
  tier_3_noindex_nofollow: "Non indexé (liens non suivis)",
};

/** Explication longue (infobulle) de chaque niveau d'indexation. */
export const INDEXATION_TIER_HELP_FR: Record<IndexationTier, string> = {
  tier_1_indexable:
    "L'article est indexable : il peut apparaître dans les résultats de recherche Google.",
  tier_2_noindex_follow:
    "L'article n'est pas indexé par Google (invisible dans les résultats), mais ses liens sont suivis.",
  tier_3_noindex_nofollow:
    "L'article n'est pas indexé et ses liens ne sont pas suivis (contenu en réserve).",
};

// ─── Statut d'un article publié (champ texte Article.status, pas un enum) ─────
export const ARTICLE_STATUS_LABELS_FR: Record<string, string> = {
  published: "Publié",
  draft: "Brouillon",
  archived: "Archivé",
};

/** Libellé FR du statut d'un article, repli sûr sur la valeur brute. */
export function articleStatusLabelFr(status: string): string {
  return ARTICLE_STATUS_LABELS_FR[status] ?? status;
}

// ─── Badge « où en est ce contenu ? » (vue métier simple) ────────────────────
export interface PublicationBadge {
  readonly label: string;
  readonly tone: AdminTone;
}

/**
 * Traduit un statut d'article en badge métier limpide « En ligne / Brouillon /
 * Archivé ». Pour la question la plus fréquente : « est-ce publié ou pas ? »
 */
export function articlePublicationBadge(status: string): PublicationBadge {
  switch (status) {
    case "published":
      return { label: "🟢 En ligne", tone: "success" };
    case "archived":
      return { label: "🗄️ Archivé", tone: "neutral" };
    case "draft":
      return { label: "📝 Brouillon", tone: "warning" };
    default:
      return { label: articleStatusLabelFr(status), tone: "neutral" };
  }
}

// ─── Titre du contenu associé à un job (audit UX — listes sans titre) ────────
/**
 * Extrait le titre généré depuis `ContentGenJob.outputJsonRaw` (JSON libre
 * persisté par le worker de génération — `content-gen-worker.ts` construit
 * `persistedOutput = { ...output, … }` où `output.title` est le titre de
 * l'article/page produit). Tant qu'un job n'a pas terminé sa génération
 * (`queued`, `running`…), `outputJsonRaw` vaut encore `null` : on renvoie
 * `null` plutôt qu'une chaîne vide, à charge de l'UI d'afficher un repli
 * explicite (« Génération en cours… ») au lieu d'une case blanche muette.
 */
export function extractJobTitle(outputJsonRaw: unknown): string | null {
  if (outputJsonRaw === null || typeof outputJsonRaw !== "object") return null;
  const title = (outputJsonRaw as Record<string, unknown>)["title"];
  return typeof title === "string" && title.trim().length > 0 ? title : null;
}
