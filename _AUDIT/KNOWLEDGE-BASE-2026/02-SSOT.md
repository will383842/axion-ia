# 02 — SSOT CONTENU — Knowledge Base 2026 — Phase A

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` §Agent 2 (~ligne 230) + §12 (~ligne 1095)
> Agent : 2 — SSOT contenu (`src/content/knowledge-base.ts` + sous-modules)
> Date : 2026-05-13
> Statut : DRAFT (Phase A — AUDIT-ONLY, aucune écriture sous `src/content/`)
> Référence code : HEAD `main` (commit `95bba36`)
> Pré-lectures :
>
> - `_AUDIT/KNOWLEDGE-BASE-2026/00-REALITY-CHECK.md` (§1.5 SSOTs + §1.6 i18n + §9.2 Agent 2)
> - `src/content/pricing.ts` (727 lignes — SSOT canonique zero-hardcode)
> - `src/content/interventions-taxonomy.ts` (711 lignes — SSOT taxonomie extensible)
> - `src/content/interventions-taxonomy.test.ts` (199 lignes — pattern tests colocalisés)
> - `src/messages/fr.json` + `en.json` (243 lignes chacun, mono-fichier confirmé)
>   Doctrine :
> - `axionia_doctrine_code_ssot` — code = source de vérité
> - `axionia_pricing_zero_hardcode_2026-05-08` — pattern à reproduire
> - Anti-pattern §Agent 2 (prompt master ligne 238) : pas de libellés UI dans le SSOT (i18n only), pas de mélange config / runtime data, pas de duplication d'enums Prisma sans single source.

---

## 0. TL;DR

- **Architecture** : 1 fichier de façade `src/content/knowledge-base.ts` (re-export complet) + 11 sous-modules cohésifs sous `src/content/knowledge/*.ts`. Pattern aligné sur `pricing.ts` (helpers + types + arrays) et sur `interventions-taxonomy.ts` (catalogue extensible avec tests colocalisés).
- **Source unique pour les enums** : les **constantes TS** (`KB_TYPES`, `KB_DOMAINS`, ...) sont la SSOT. Les enums Prisma générés (`KbType`, `KbDomain`, ...) sont **dérivés** de ces constantes via un script `scripts/sync-kb-enums-to-prisma.ts` exécuté en pré-`prisma format`. Évite la duplication anti-DRY identifiée dans l'anti-pattern §Agent 2.
- **i18n** : recommandation **mono-fichier** (alignement reality check §1.6). Les labels FR/EN sont namespacés `knowledge.types.<id>.label` et `knowledge.types.<id>.description` dans `src/messages/fr.json` et `en.json` existants. **Aucun label UI** ne descend dans `src/content/knowledge/*.ts`.
- **Mapping JSON-LD** : `getJsonLdType(type)` retourne un schema.org type pour chaque `KbType` (cf §6).
- **Mapping rendering** : `getEntryRenderer(type)` retourne un composant React server (cf §7).
- **Mapping URL publique** : `getPublicRoute(type, locale, slug)` source de vérité (cf §8), aligné §12.4 master.
- **STOP & ASK ouverts** : 7 décisions Will (cf §13).

---

## 1. ARBORESCENCE CIBLE — `src/content/`

```
src/content/
├── knowledge-base.ts             ← façade : re-export complet (1 import par consommateur)
├── knowledge-base.test.ts        ← contrats globaux (invariants + intégrité)
└── knowledge/
    ├── types.ts                  ← KB_TYPES + KbType + helpers type
    ├── types.test.ts
    ├── domains.ts                ← KB_DOMAINS + KbDomain
    ├── audiences.ts              ← KB_AUDIENCES + KbAudience + isPublicAudience()
    ├── audiences.test.ts
    ├── confidentialities.ts      ← KB_CONFIDENTIALITIES + KbConfidentiality
    ├── statuses.ts               ← KB_STATUSES + KbStatus + state machine helpers
    ├── statuses.test.ts
    ├── relation-kinds.ts         ← KB_RELATION_KINDS + KbRelationKind
    ├── templates.ts              ← ENTRY_TEMPLATES (skeletons Tiptap JSON par type)
    ├── snippets.ts               ← ENTRY_SNIPPETS (slash-command snippets)
    ├── quality-thresholds.ts     ← QUALITY_THRESHOLDS_DEFAULTS + helpers
    ├── review-windows.ts         ← REVIEW_WINDOWS_DEFAULTS + helpers
    └── routes.ts                 ← KB_PUBLIC_ROUTES + KB_ADMIN_ROUTES + helpers URL
```

**Justification splitting** (vs un seul fichier monolithique) :

- `pricing.ts` (727 lignes) approche déjà la limite de lisibilité ; KB en aurait > 1500 → splitting cohésif obligatoire.
- Chaque sous-module a UNE responsabilité (enums + invariants + helpers locaux).
- Tests colocalisés (pattern `interventions-taxonomy.test.ts`).
- `knowledge-base.ts` agit en **façade** : les consommateurs (pages, server actions, JSON-LD builders) importent depuis `@/content/knowledge-base` uniquement → si on refactor la structure interne, l'API publique reste stable.

---

## 2. `src/content/knowledge-base.ts` — façade

**Rôle** : re-export typed + helpers de plus haut niveau qui combinent plusieurs sous-modules. **PAS de logique** propre — seulement de l'orchestration.

```ts
// SSOT Knowledge Base — Sprint KB-1 (2026-??).
//
// Façade unique du module knowledge. Tous les consommateurs importent depuis
// ICI (`@/content/knowledge-base`), JAMAIS depuis les sous-modules directement
// (sauf cas tests internes). Cela permet de réorganiser librement la structure
// `knowledge/*.ts` sans casser le reste du codebase.
//
// Pattern aligné sur `pricing.ts` et `interventions-taxonomy.ts`.
// Doctrine zero-hardcode : aucun label UI dans ce fichier — tout passe par
// i18n (cf §11 du prompt master + reality check §1.6).

export * from "./knowledge/types";
export * from "./knowledge/domains";
export * from "./knowledge/audiences";
export * from "./knowledge/confidentialities";
export * from "./knowledge/statuses";
export * from "./knowledge/relation-kinds";
export * from "./knowledge/templates";
export * from "./knowledge/snippets";
export * from "./knowledge/quality-thresholds";
export * from "./knowledge/review-windows";
export * from "./knowledge/routes";

// Helpers cross-modules (combinent plusieurs sous-modules ; ne peuvent pas
// vivre dans un seul fichier sans introduire de cycle d'import).

import type { KbType } from "./knowledge/types";
import type { KbAudience } from "./knowledge/audiences";
import type { KbConfidentiality } from "./knowledge/confidentialities";
import type { KbStatus } from "./knowledge/statuses";
import type { AdminRole } from "@prisma/client";
import { isPublicAudience } from "./knowledge/audiences";
import { getJsonLdType } from "./knowledge/types";
import { getEntryRenderer } from "./knowledge/types";
import { getPublicRoute } from "./knowledge/routes";
import { getReviewWindow } from "./knowledge/review-windows";
import { getQualityThreshold } from "./knowledge/quality-thresholds";

/**
 * Vérifie si un utilisateur (rôle admin) peut éditer une entrée. La logique
 * tient compte du rôle ET de l'audience/confidentiality (ex un `reader` ne
 * peut rien éditer, un `editor` ne peut pas éditer un `confidentiality='secret'`).
 *
 * Source de vérité unique pour la matrice RBAC KB. À utiliser systématiquement
 * côté server action ET côté UI (disabling buttons).
 */
export function canUserEditEntry(
  user: { role: AdminRole | null },
  entry: { audience: KbAudience; confidentiality: KbConfidentiality; status: KbStatus },
): boolean {
  if (!user.role) return false;
  if (user.role === "reader") return false;
  if (entry.status === "archived") return user.role === "owner";
  if (entry.confidentiality === "secret") return user.role === "owner";
  if (entry.confidentiality === "confidential") {
    return user.role === "owner" || user.role === "editor";
  }
  // public / internal :
  return ["owner", "editor", "reviewer"].includes(user.role);
}

/**
 * Vérifie si une entrée est visible publiquement (sans authentification).
 * Combine audience + status. Utilisé par les routes publiques pour 404 si non
 * publié, et par le sitemap pour inclure / exclure.
 */
export function isEntryPubliclyVisible(entry: { audience: KbAudience; status: KbStatus }): boolean {
  return isPublicAudience(entry.audience) && entry.status === "published";
}

/**
 * Vérifie si une entrée est visible côté client connecté (/mes-ressources).
 * Combine audience + status.
 */
export function isEntryClientVisible(entry: { audience: KbAudience; status: KbStatus }): boolean {
  if (entry.status !== "published") return false;
  return entry.audience === "public" || entry.audience === "client";
}

// Re-export des helpers spécifiques pour usage direct.
export {
  getJsonLdType,
  getEntryRenderer,
  getPublicRoute,
  getReviewWindow,
  getQualityThreshold,
  isPublicAudience,
};
```

---

## 3. `src/content/knowledge/types.ts`

```ts
// SSOT Knowledge Types — Sprint KB-1.
//
// 16 types alignés sur §12.1 du prompt master. Les valeurs string sont
// PERSISTANTES — figées en DB, jamais traduites, jamais renommées sans
// migration de données.
//
// La SSOT TS pilote la génération de l'enum Prisma `KbType` via le script
// `scripts/sync-kb-enums-to-prisma.ts` (Sprint KB-1). Cela garantit qu'il
// n'y a pas de drift entre la couche application et la couche DB.

export const KB_TYPES = [
  "article", // Blog
  "case_study", // Cas concret
  "help_article", // Centre d'aide
  "faq", // Question fréquente
  "glossary_term", // Terme glossaire
  "guide", // Guide IA long-form
  "methodology", // Méthodologie (interne ou publique)
  "doctrine", // Doctrine Axion-IA
  "adr", // Architecture Decision Record (interne)
  "prompt_template", // Template de prompt (interne)
  "sop", // Standard Operating Procedure (interne)
  "post_mortem", // Post-mortem (interne)
  "tool_card", // Fiche outil
  "competitor_card", // Fiche concurrent (interne)
  "commercial_doc", // Document commercial
  "onboarding_step", // Étape onboarding (client)
] as const;

export type KbType = (typeof KB_TYPES)[number];

/**
 * Mapping `type → JSON-LD type` (schema.org). Voir §6 pour les justifications.
 * `null` = pas de JSON-LD spécifique au type (fallback `Article` ou pas de
 * markup). Les types internes n'ont pas de surface publique → `null`.
 */
export const KB_JSON_LD_TYPE: Record<KbType, string | null> = {
  article: "Article",
  case_study: "Article", // pas de schema.org CaseStudy natif ; on customise via additionalType
  help_article: "Article", // sous-cas TechArticle si tag `technical`
  faq: "FAQPage",
  glossary_term: "DefinedTerm",
  guide: "HowTo", // si étapes structurées ; sinon TechArticle (cf getJsonLdType())
  methodology: "Article",
  doctrine: "Article",
  adr: null, // interne, pas de JSON-LD
  prompt_template: null,
  sop: null,
  post_mortem: null,
  tool_card: "Article", // pas de SoftwareApplication car pas vendu
  competitor_card: null,
  commercial_doc: null,
  onboarding_step: null,
};

/**
 * Helper avec fallback intelligent : pour `guide`, on retourne `HowTo` si
 * l'entrée a des étapes structurées (champ `entry.steps.length > 0`), sinon
 * `TechArticle`. Côté pages JSON-LD, on appelle ce helper avec la métadonnée
 * disponible.
 */
export function getJsonLdType(
  type: KbType,
  hints?: { hasSteps?: boolean; isTechnical?: boolean },
): string | null {
  if (type === "guide" && hints?.hasSteps === false) return "TechArticle";
  if (type === "help_article" && hints?.isTechnical) return "TechArticle";
  return KB_JSON_LD_TYPE[type];
}

/**
 * Mapping `type → composant de rendu`. Renvoie l'identifiant string du
 * composant ; le composant React lui-même vit dans
 * `src/components/knowledge/public/templates/<id>.tsx` et est résolu par
 * `EntryRenderer` (cf §7).
 *
 * On garde le mapping ICI (couche SSOT) et le résolveur React dans le
 * composant — séparation config / runtime conforme à l'anti-pattern §Agent 2.
 */
export const KB_RENDERER_ID: Record<KbType, string> = {
  article: "ArticleTemplate",
  case_study: "CaseStudyTemplate",
  help_article: "HelpArticleTemplate",
  faq: "FaqTemplate",
  glossary_term: "GlossaryTermTemplate",
  guide: "GuideTemplate",
  methodology: "MethodologyTemplate",
  doctrine: "DoctrineTemplate",
  adr: "AdrTemplate",
  prompt_template: "PromptTemplateTemplate",
  sop: "SopTemplate",
  post_mortem: "PostMortemTemplate",
  tool_card: "ToolCardTemplate",
  competitor_card: "CompetitorCardTemplate",
  commercial_doc: "CommercialDocTemplate",
  onboarding_step: "OnboardingStepTemplate",
};

export function getEntryRenderer(type: KbType): string {
  return KB_RENDERER_ID[type];
}

/**
 * Helper : valide qu'une valeur est bien un KbType. Utile pour parser les
 * params URL ou les entrées CSV d'import.
 */
export function isKbType(value: unknown): value is KbType {
  return typeof value === "string" && (KB_TYPES as ReadonlyArray<string>).includes(value);
}
```

---

## 4. `src/content/knowledge/domains.ts`

```ts
// SSOT Knowledge Domains — Sprint KB-1. Aligné §12.2 prompt master.
// 10 domaines stables. Persistés en DB. Labels FR/EN dans i18n.

export const KB_DOMAINS = [
  "commercial",
  "technical",
  "legal",
  "hr",
  "product",
  "client",
  "watch", // veille concurrentielle / sectorielle
  "internal",
  "editorial",
  "methodology",
] as const;

export type KbDomain = (typeof KB_DOMAINS)[number];

export function isKbDomain(value: unknown): value is KbDomain {
  return typeof value === "string" && (KB_DOMAINS as ReadonlyArray<string>).includes(value);
}
```

---

## 5. `src/content/knowledge/audiences.ts`

```ts
// SSOT Knowledge Audiences — Sprint KB-1. Aligné §12.3 prompt master.

export const KB_AUDIENCES = ["public", "client", "team", "will_only"] as const;
export type KbAudience = (typeof KB_AUDIENCES)[number];

/**
 * Vrai si l'audience est visible publiquement sans authentification.
 * Source de vérité unique — utilisé par sitemap, robots, RSS, JSON-LD,
 * surface publique, server actions.
 */
export function isPublicAudience(audience: KbAudience): boolean {
  return audience === "public";
}

/**
 * Vrai si un client connecté (session NextAuth) peut consulter cette audience.
 * Couvre `public` + `client`.
 */
export function isClientAudience(audience: KbAudience): boolean {
  return audience === "public" || audience === "client";
}

/**
 * Vrai si l'audience est strictement interne (équipe Axion-IA).
 */
export function isInternalAudience(audience: KbAudience): boolean {
  return audience === "team" || audience === "will_only";
}

export function isKbAudience(value: unknown): value is KbAudience {
  return typeof value === "string" && (KB_AUDIENCES as ReadonlyArray<string>).includes(value);
}

/**
 * Helper d'affichage : retourne la clé i18n du label localisé pour une
 * audience. Le SSOT NE STOCKE PAS le label — on retourne la clé i18n.
 * Anti-pattern §Agent 2 respecté : aucun label UI dans ce module.
 *
 * Usage côté composant React :
 *   const t = useTranslations();
 *   const label = t(formatAudienceLabel(entry.audience));
 *
 * Le SSR pur peut faire :
 *   const messages = await getMessages();
 *   const label = get(messages, formatAudienceLabel(entry.audience));
 */
export function formatAudienceLabel(audience: KbAudience): string {
  return `knowledge.audiences.${audience}.label`;
}

export function formatAudienceBadge(audience: KbAudience): string {
  return `knowledge.audiences.${audience}.badge`;
}
```

---

## 6. `src/content/knowledge/confidentialities.ts`

```ts
// SSOT Knowledge Confidentialities — Sprint KB-1.

export const KB_CONFIDENTIALITIES = ["public", "internal", "confidential", "secret"] as const;
export type KbConfidentiality = (typeof KB_CONFIDENTIALITIES)[number];

/**
 * Vrai si la confidentialité interdit toute exfiltration vers un tiers
 * (Anthropic embeddings, OpenAI, etc.). Utilisé par le worker
 * `knowledge-embed.ts` (Sprint KB-21) pour refus dur.
 *
 * Anti-pattern §Agent 10 (prompt master) : envoi de `secret` vers API externe.
 */
export function isExternalSafeConfidentiality(c: KbConfidentiality): boolean {
  return c === "public" || c === "internal";
}

/**
 * Ordre canonique pour comparaison « est-ce que X est au moins aussi
 * confidentiel que Y ». Utile pour les helpers de filtrage.
 */
export const KB_CONFIDENTIALITY_ORDER: Record<KbConfidentiality, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  secret: 3,
};

export function isMoreConfidentialThan(a: KbConfidentiality, b: KbConfidentiality): boolean {
  return KB_CONFIDENTIALITY_ORDER[a] > KB_CONFIDENTIALITY_ORDER[b];
}

export function isKbConfidentiality(value: unknown): value is KbConfidentiality {
  return (
    typeof value === "string" && (KB_CONFIDENTIALITIES as ReadonlyArray<string>).includes(value)
  );
}
```

---

## 7. `src/content/knowledge/statuses.ts`

```ts
// SSOT Knowledge Statuses — Sprint KB-1.
//
// Reality check §1.2 / §10 décision 6 : on crée un enum dédié `KbStatus`
// plutôt que d'étendre `PublishStatus` global pour éviter la pollution
// cross-domaine (booking, etc.).

export const KB_STATUSES = [
  "draft",
  "review",
  "scheduled",
  "published",
  "deprecated", // publié mais remplacé par une entrée plus récente (canonical → newer)
  "archived",
] as const;
export type KbStatus = (typeof KB_STATUSES)[number];

/**
 * State machine — transitions autorisées. Source de vérité unique pour les
 * server actions `publish`, `unpublish`, `archive`, `restore`, `submitForReview`.
 *
 * Pattern aligné sur `booking-state-machine.ts` (Sprint X.4 Booking V1).
 */
export const KB_TRANSITIONS: Record<KbStatus, ReadonlyArray<KbStatus>> = {
  draft: ["review", "scheduled", "published", "archived"],
  review: ["draft", "published", "scheduled", "archived"],
  scheduled: ["draft", "review", "published", "archived"],
  published: ["draft", "deprecated", "archived"],
  deprecated: ["draft", "published", "archived"],
  archived: ["draft"],
};

export function isAllowedTransition(from: KbStatus, to: KbStatus): boolean {
  return KB_TRANSITIONS[from].includes(to);
}

/**
 * Vrai si l'entrée est dans un état qui doit apparaître dans le sitemap,
 * les feeds RSS et l'index FTS.
 */
export function isIndexableStatus(status: KbStatus): boolean {
  return status === "published" || status === "deprecated";
}

/**
 * Vrai si l'entrée doit envoyer un ping IndexNow lors du changement vers
 * ce status.
 */
export function shouldPingIndexNow(prev: KbStatus, next: KbStatus): boolean {
  // Nouvelle publication.
  if (prev !== "published" && next === "published") return true;
  // Dépublication (URL devient 410 ou 404).
  if (prev === "published" && (next === "archived" || next === "draft")) return true;
  return false;
}

export function isKbStatus(value: unknown): value is KbStatus {
  return typeof value === "string" && (KB_STATUSES as ReadonlyArray<string>).includes(value);
}
```

---

## 8. `src/content/knowledge/relation-kinds.ts`

```ts
// SSOT Knowledge Relation Kinds — Sprint KB-1.
// Types de relations entre entrées (cross-référencement). Cf §Agent 1.

export const KB_RELATION_KINDS = [
  "related", // « voir aussi » générique
  "prerequisite", // entrée à lire avant celle-ci
  "follow_up", // entrée à lire après
  "supersedes", // remplace une entrée antérieure
  "superseded_by", // inverse de supersedes (auto-géré)
  "translation_of", // traduction d'une entrée (V1 = relation paire FR↔EN)
  "answers", // FAQ répond à un guide / cas
  "answered_by", // inverse
  "cites", // cite une entrée (utile pour AEO citations)
  "cited_by", // inverse
  "part_of", // entrée enfant d'une série/collection
] as const;
export type KbRelationKind = (typeof KB_RELATION_KINDS)[number];

/**
 * Mapping relations inverses (auto-géré côté server action `addRelation`).
 * Quand on ajoute `A supersedes B`, on auto-ajoute `B superseded_by A`.
 */
export const KB_RELATION_INVERSE: Partial<Record<KbRelationKind, KbRelationKind>> = {
  supersedes: "superseded_by",
  superseded_by: "supersedes",
  answers: "answered_by",
  answered_by: "answers",
  cites: "cited_by",
  cited_by: "cites",
  // related, prerequisite, follow_up, translation_of, part_of : pas d'inverse
  // automatique (relation orientée OU symétrique gérée côté UI).
};

export function getInverseRelation(kind: KbRelationKind): KbRelationKind | null {
  return KB_RELATION_INVERSE[kind] ?? null;
}

export function isKbRelationKind(value: unknown): value is KbRelationKind {
  return typeof value === "string" && (KB_RELATION_KINDS as ReadonlyArray<string>).includes(value);
}
```

---

## 9. `src/content/knowledge/templates.ts`

```ts
// SSOT Knowledge Entry Templates — Sprint KB-16.
//
// Squelettes Tiptap JSON pré-remplis pour chaque type. Affichés au moment
// de la création d'une entrée (`/connaissances/nouvelle`). Le rédacteur
// part d'une trame structurée plutôt que d'un body vide.
//
// Pattern : on n'embarque PAS les textes localisés ici — le template
// contient des marqueurs `[[i18n:knowledge.templates.<type>.<section>]]`
// que l'éditeur résout via `useTranslations()` au moment du rendu initial.
// Cela évite la duplication FR/EN et garde l'anti-pattern §Agent 2 (pas de
// texte UI dans le SSOT).

import type { KbType } from "./types";

/**
 * Structure Tiptap JSON minimale. On reste agnostique de la version Tiptap
 * (compat extensions ajoutées Sprint KB-3 : Link / Image / Callout).
 */
export interface TiptapDoc {
  type: "doc";
  content: ReadonlyArray<TiptapNode>;
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ReadonlyArray<TiptapNode>;
  text?: string;
  marks?: ReadonlyArray<{ type: string; attrs?: Record<string, unknown> }>;
}

export const ENTRY_TEMPLATES: Record<KbType, TiptapDoc> = {
  article: {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "[[i18n:knowledge.templates.article.intro]]" }],
      },
      { type: "paragraph", content: [] },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "[[i18n:knowledge.templates.article.body]]" }],
      },
      { type: "paragraph", content: [] },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "[[i18n:knowledge.templates.article.conclusion]]" }],
      },
    ],
  },
  case_study: {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "[[i18n:knowledge.templates.case_study.context]]" }],
      },
      { type: "paragraph", content: [] },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "[[i18n:knowledge.templates.case_study.problem]]" }],
      },
      { type: "paragraph", content: [] },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "[[i18n:knowledge.templates.case_study.solution]]" }],
      },
      { type: "paragraph", content: [] },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "[[i18n:knowledge.templates.case_study.results]]" }],
      },
      { type: "paragraph", content: [] },
    ],
  },
  help_article: {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "[[i18n:knowledge.templates.help_article.symptom]]" }],
      },
      { type: "paragraph", content: [] },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "[[i18n:knowledge.templates.help_article.steps]]" }],
      },
      {
        type: "orderedList",
        content: [{ type: "listItem", content: [{ type: "paragraph", content: [] }] }],
      },
    ],
  },
  faq: {
    type: "doc",
    content: [{ type: "paragraph", content: [] }],
  },
  glossary_term: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "[[i18n:knowledge.templates.glossary_term.definition]]" }],
      },
    ],
  },
  guide: {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "[[i18n:knowledge.templates.guide.objective]]" }],
      },
      { type: "paragraph", content: [] },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "[[i18n:knowledge.templates.guide.steps]]" }],
      },
      {
        type: "orderedList",
        content: [{ type: "listItem", content: [{ type: "paragraph", content: [] }] }],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "[[i18n:knowledge.templates.guide.summary]]" }],
      },
      { type: "paragraph", content: [] },
    ],
  },
  methodology: { type: "doc", content: [{ type: "paragraph", content: [] }] },
  doctrine: { type: "doc", content: [{ type: "paragraph", content: [] }] },
  adr: {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "[[i18n:knowledge.templates.adr.context]]" }],
      },
      { type: "paragraph", content: [] },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "[[i18n:knowledge.templates.adr.decision]]" }],
      },
      { type: "paragraph", content: [] },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "[[i18n:knowledge.templates.adr.consequences]]" }],
      },
      { type: "paragraph", content: [] },
    ],
  },
  prompt_template: {
    type: "doc",
    content: [{ type: "codeBlock", attrs: { language: "markdown" }, content: [] }],
  },
  sop: {
    type: "doc",
    content: [
      {
        type: "orderedList",
        content: [{ type: "listItem", content: [{ type: "paragraph", content: [] }] }],
      },
    ],
  },
  post_mortem: {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "[[i18n:knowledge.templates.post_mortem.summary]]" }],
      },
      { type: "paragraph", content: [] },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "[[i18n:knowledge.templates.post_mortem.timeline]]" }],
      },
      { type: "paragraph", content: [] },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "[[i18n:knowledge.templates.post_mortem.lessons]]" }],
      },
      { type: "paragraph", content: [] },
    ],
  },
  tool_card: { type: "doc", content: [{ type: "paragraph", content: [] }] },
  competitor_card: { type: "doc", content: [{ type: "paragraph", content: [] }] },
  commercial_doc: { type: "doc", content: [{ type: "paragraph", content: [] }] },
  onboarding_step: { type: "doc", content: [{ type: "paragraph", content: [] }] },
};

export function getEntryTemplate(type: KbType): TiptapDoc {
  return ENTRY_TEMPLATES[type];
}
```

---

## 10. `src/content/knowledge/snippets.ts`

```ts
// SSOT Knowledge Snippets — slash-command éditeur (Sprint KB-16).
//
// Snippets insérables via la slash-command Tiptap (`/citation`, `/callout`,
// `/cta`, etc.). Chaque snippet contient un fragment Tiptap insérable.
// Labels affichés dans le menu = clés i18n (anti-pattern §Agent 2 respecté).

import type { TiptapNode } from "./templates";

export interface KbSnippet {
  /** Identifiant stable + clé URL slash-command. */
  id: string;
  /** Clé i18n du label menu. Résolue côté composant. */
  labelKey: string;
  /** Clé i18n de la description. */
  descriptionKey: string;
  /** Catégorie pour grouper dans le menu. */
  category: "callout" | "media" | "cta" | "structure" | "reference";
  /** Fragment Tiptap inséré au curseur. */
  fragment: TiptapNode;
}

export const ENTRY_SNIPPETS: ReadonlyArray<KbSnippet> = [
  {
    id: "callout-info",
    labelKey: "knowledge.snippets.callout_info.label",
    descriptionKey: "knowledge.snippets.callout_info.description",
    category: "callout",
    fragment: {
      type: "callout",
      attrs: { variant: "info" },
      content: [{ type: "paragraph", content: [] }],
    },
  },
  {
    id: "callout-warning",
    labelKey: "knowledge.snippets.callout_warning.label",
    descriptionKey: "knowledge.snippets.callout_warning.description",
    category: "callout",
    fragment: {
      type: "callout",
      attrs: { variant: "warning" },
      content: [{ type: "paragraph", content: [] }],
    },
  },
  {
    id: "cta-booking",
    labelKey: "knowledge.snippets.cta_booking.label",
    descriptionKey: "knowledge.snippets.cta_booking.description",
    category: "cta",
    fragment: {
      type: "ctaBlock",
      attrs: { variant: "booking", href: "/reserver" },
      content: [],
    },
  },
  {
    id: "internal-link",
    labelKey: "knowledge.snippets.internal_link.label",
    descriptionKey: "knowledge.snippets.internal_link.description",
    category: "reference",
    fragment: {
      type: "internalLink",
      attrs: { entryId: null },
      content: [],
    },
  },
  // ...etc — extensible Sprint KB-16
];

export function getSnippetById(id: string): KbSnippet | undefined {
  return ENTRY_SNIPPETS.find((s) => s.id === id);
}

export function getSnippetsByCategory(category: KbSnippet["category"]): ReadonlyArray<KbSnippet> {
  return ENTRY_SNIPPETS.filter((s) => s.category === category);
}
```

---

## 11. `src/content/knowledge/quality-thresholds.ts`

```ts
// SSOT Knowledge Quality Thresholds — Sprint KB-13.
//
// Seuils par type — bloquent la publication si non atteints. Override possible
// via `Setting` table (reality check §1.2) en runtime, mais les défauts
// canoniques vivent ICI.
//
// Pattern : V1 = constantes TS. V2 = vue Setting (clé `kb.quality.<type>.<champ>`).
// L'API publique (`getQualityThreshold`) reste stable → bascule sans casse.

import type { KbType } from "./types";

export interface QualityThreshold {
  /** Longueur minimale du body en caractères (text plain, pas HTML). */
  minBodyChars: number;
  /** Nombre minimum d'images (0 = pas d'exigence). */
  minImages: number;
  /** Alt-text obligatoire sur toute image (bloque publish si vide). */
  altTextRequired: boolean;
  /** Headings H2 minimum requis. */
  minHeadings: number;
  /** Readability score minimum (Flesch-Kincaid FR / Flesch EN, V1.5). */
  minReadability?: number;
  /** Présence obligatoire d'au moins une relation `related` ou `cites`. */
  relationsRequired: boolean;
}

export const QUALITY_THRESHOLDS_DEFAULTS: Record<KbType, QualityThreshold> = {
  article: {
    minBodyChars: 1500,
    minImages: 1,
    altTextRequired: true,
    minHeadings: 3,
    relationsRequired: true,
  },
  case_study: {
    minBodyChars: 2000,
    minImages: 1,
    altTextRequired: true,
    minHeadings: 4,
    relationsRequired: true,
  },
  help_article: {
    minBodyChars: 300,
    minImages: 0,
    altTextRequired: true,
    minHeadings: 1,
    relationsRequired: false,
  },
  faq: {
    minBodyChars: 80,
    minImages: 0,
    altTextRequired: true,
    minHeadings: 0,
    relationsRequired: false,
  },
  glossary_term: {
    minBodyChars: 120,
    minImages: 0,
    altTextRequired: true,
    minHeadings: 0,
    relationsRequired: false,
  },
  guide: {
    minBodyChars: 3000,
    minImages: 2,
    altTextRequired: true,
    minHeadings: 5,
    relationsRequired: true,
  },
  methodology: {
    minBodyChars: 1000,
    minImages: 0,
    altTextRequired: true,
    minHeadings: 2,
    relationsRequired: false,
  },
  doctrine: {
    minBodyChars: 500,
    minImages: 0,
    altTextRequired: true,
    minHeadings: 1,
    relationsRequired: false,
  },
  adr: {
    minBodyChars: 600,
    minImages: 0,
    altTextRequired: true,
    minHeadings: 3,
    relationsRequired: false,
  },
  prompt_template: {
    minBodyChars: 200,
    minImages: 0,
    altTextRequired: true,
    minHeadings: 0,
    relationsRequired: false,
  },
  sop: {
    minBodyChars: 400,
    minImages: 0,
    altTextRequired: true,
    minHeadings: 1,
    relationsRequired: false,
  },
  post_mortem: {
    minBodyChars: 800,
    minImages: 0,
    altTextRequired: true,
    minHeadings: 3,
    relationsRequired: false,
  },
  tool_card: {
    minBodyChars: 250,
    minImages: 1,
    altTextRequired: true,
    minHeadings: 0,
    relationsRequired: false,
  },
  competitor_card: {
    minBodyChars: 300,
    minImages: 0,
    altTextRequired: true,
    minHeadings: 0,
    relationsRequired: false,
  },
  commercial_doc: {
    minBodyChars: 200,
    minImages: 0,
    altTextRequired: true,
    minHeadings: 0,
    relationsRequired: false,
  },
  onboarding_step: {
    minBodyChars: 200,
    minImages: 0,
    altTextRequired: true,
    minHeadings: 0,
    relationsRequired: false,
  },
};

/**
 * Lookup défaut. Override Sprint KB-13 :
 *   getQualityThreshold('article') → vérifie Setting `kb.quality.article` en DB
 *   en runtime, fallback sur QUALITY_THRESHOLDS_DEFAULTS.
 * En V1, retourne directement la constante (pas d'I/O DB côté SSOT).
 */
export function getQualityThreshold(type: KbType): QualityThreshold {
  return QUALITY_THRESHOLDS_DEFAULTS[type];
}
```

---

## 12. `src/content/knowledge/review-windows.ts`

```ts
// SSOT Knowledge Review Windows — Sprint KB-13.
//
// Fenêtre de revue par type (en jours). Au-delà, l'entrée passe en
// `reviewDueAt < now` et apparaît dans `/connaissances/files-attente-revue`.

import type { KbType } from "./types";

export interface ReviewWindow {
  /** Durée de validité avant revue obligatoire (en jours). */
  defaultDays: number;
  /** Délai d'escalade reviewer → owner (en jours après expiration). */
  escalationDays: number;
}

export const REVIEW_WINDOWS_DEFAULTS: Record<KbType, ReviewWindow> = {
  article: { defaultDays: 365, escalationDays: 30 },
  case_study: { defaultDays: 540, escalationDays: 60 }, // les cas vieillissent lentement
  help_article: { defaultDays: 180, escalationDays: 14 }, // produit bouge → revue plus serrée
  faq: { defaultDays: 180, escalationDays: 14 },
  glossary_term: { defaultDays: 730, escalationDays: 60 }, // terme stable
  guide: { defaultDays: 365, escalationDays: 30 },
  methodology: { defaultDays: 540, escalationDays: 30 },
  doctrine: { defaultDays: 730, escalationDays: 60 },
  adr: { defaultDays: 1825, escalationDays: 90 }, // ADR immutables (revue tous les 5 ans)
  prompt_template: { defaultDays: 90, escalationDays: 14 }, // modèles IA bougent vite
  sop: { defaultDays: 365, escalationDays: 30 },
  post_mortem: { defaultDays: 1825, escalationDays: 90 },
  tool_card: { defaultDays: 180, escalationDays: 14 },
  competitor_card: { defaultDays: 180, escalationDays: 14 },
  commercial_doc: { defaultDays: 365, escalationDays: 30 },
  onboarding_step: { defaultDays: 180, escalationDays: 30 },
};

export function getReviewWindow(type: KbType): ReviewWindow {
  return REVIEW_WINDOWS_DEFAULTS[type];
}

/**
 * Calcule la date `reviewDueAt` cible à partir d'un type et d'une date
 * `publishedAt`. Utilisé par la server action `publish.ts` (KB-3).
 */
export function computeReviewDueAt(type: KbType, publishedAt: Date): Date {
  const window = getReviewWindow(type);
  const due = new Date(publishedAt);
  due.setDate(due.getDate() + window.defaultDays);
  return due;
}
```

---

## 13. `src/content/knowledge/routes.ts`

```ts
// SSOT Knowledge Routes — Sprint KB-1. Aligné §12.4 et §12.5 prompt master.
//
// Source de vérité unique des URLs publiques ET admin. Tout le reste du
// codebase importe depuis ICI (jamais hardcodé).
//
// Convention :
//   - URLs publiques par type : `KB_PUBLIC_ROUTES[type] = { fr, en }`.
//   - Types internes → `null` (pas de route publique dédiée, fallback hub `/ressources/`).
//   - URLs admin → en FR cohérent (mémoire `axionia_naming_brand_vs_project`).

import type { Locale } from "@/i18n/routing";
import type { KbType } from "./types";

/** Mapping type → racine URL publique (préserve les routes legacy existantes). */
export const KB_PUBLIC_ROUTES: Record<KbType, { fr: string; en: string } | null> = {
  article: { fr: "/blog", en: "/blog" },
  case_study: { fr: "/cas-concrets", en: "/case-studies" },
  help_article: { fr: "/centre-aide", en: "/help-center" },
  faq: { fr: "/faq", en: "/faq" },
  glossary_term: { fr: "/glossaire", en: "/glossary" },
  guide: { fr: "/guide-ia", en: "/ai-guide" },
  methodology: null,
  doctrine: null,
  adr: null,
  prompt_template: null,
  sop: null,
  post_mortem: null,
  tool_card: null,
  competitor_card: null,
  commercial_doc: null,
  onboarding_step: null,
};

/**
 * URL canonique d'une entrée. Si `type` a une route publique dédiée
 * (article → /blog), retourne `/blog/<slug>`. Sinon (interne ou public sans
 * route dédiée), fallback hub `/ressources/<id>/<slug>` (cf §10 décision Will).
 *
 * Source de vérité — utilisée par sitemap, RSS, JSON-LD `mainEntityOfPage`,
 * preview links admin, copy-link button, etc.
 */
export function getPublicRoute(
  type: KbType,
  locale: Locale,
  slug: string,
  fallbackId?: string,
): string | null {
  const root = KB_PUBLIC_ROUTES[type];
  if (root) {
    return locale === "fr" ? `${root.fr}/${slug}` : `${root.en}/${slug}`;
  }
  // Pas de route dédiée → hub /ressources/ (V1) si fallbackId fourni.
  if (!fallbackId) return null;
  const hub = locale === "fr" ? "/ressources" : "/resources";
  return `${hub}/${fallbackId}/${slug}`;
}

/**
 * Racine du hub par type (pour les pages liste). `null` si pas d'URL dédiée.
 */
export function getTypeHubRoute(type: KbType, locale: Locale): string | null {
  const root = KB_PUBLIC_ROUTES[type];
  if (!root) return null;
  return locale === "fr" ? root.fr : root.en;
}

// ============================================================================
// Routes admin (FR cohérent) — §12.5 prompt master
// ============================================================================

/**
 * Préfixe admin dynamique. Source d'env `ADMIN_URL_PREFIX` (mémoire
 * `axionia_infra_tokens_pointer`). On NE hardcode jamais le prefix.
 */
export function getAdminPrefix(): string {
  const p = process.env.ADMIN_URL_PREFIX;
  if (!p) throw new Error("[knowledge/routes] ADMIN_URL_PREFIX manquant — refus de fallback.");
  return p;
}

export const KB_ADMIN_PATHS = {
  list: "connaissances",
  create: "connaissances/nouvelle",
  edit: (id: string) => `connaissances/${id}`,
  preview: (id: string) => `connaissances/${id}/apercu`,
  calendar: "connaissances/calendrier",
  health: "connaissances/sante",
  media: "connaissances/medias",
  imports: "connaissances/imports",
  tags: "connaissances/etiquettes",
  authors: "connaissances/auteurs",
  reviewQueue: "connaissances/files-attente-revue",
  settings: "connaissances/parametres",
} as const;

/** Helper qui produit l'URL admin complète (`/fr/<prefix>/connaissances`). */
export function getAdminUrl(locale: Locale, path: string): string {
  return `/${locale}/${getAdminPrefix()}/${path}`;
}
```

---

## 14. Mapping `type → JSON-LD` — table de référence

| `KbType`          | schema.org primary                                                   | Conditions de fallback                                   | Justification                                                                                           |
| ----------------- | -------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `article`         | `Article`                                                            | —                                                        | Standard blog. `BlogPosting` envisagé mais moins universel pour LLM crawlers.                           |
| `case_study`      | `Article` + `additionalType: "https://schema.org/Article#CaseStudy"` | —                                                        | schema.org n'a pas de `CaseStudy` natif. On marque via `additionalType`. AEO compatible.                |
| `help_article`    | `Article`                                                            | → `TechArticle` si tag `technical`                       | `TechArticle` pour les contenus dev / API ; sinon `Article` standard.                                   |
| `faq`             | `FAQPage`                                                            | —                                                        | Standard AEO mature. Hub `/faq` = `FAQPage` avec `mainEntity` array ; détail `/faq/[slug]` = `QAPage`.  |
| `glossary_term`   | `DefinedTerm`                                                        | —                                                        | Idéal pour glossaire. À inclure dans `DefinedTermSet` au niveau hub.                                    |
| `guide`           | `HowTo`                                                              | → `TechArticle` si pas d'étapes                          | `HowTo` impose `step` array. Si l'entrée n'a pas de structure procédurale, on bascule en `TechArticle`. |
| `methodology`     | `Article`                                                            | —                                                        | Aucun type sémantique natif. `Article` + `keywords: "methodology"`.                                     |
| `doctrine`        | `Article`                                                            | —                                                        | Idem. Interne en V1 mais possible `audience='public'`.                                                  |
| `adr`             | _aucun_                                                              | —                                                        | Interne strict. Pas de surface publique.                                                                |
| `prompt_template` | _aucun_                                                              | —                                                        | Interne.                                                                                                |
| `sop`             | _aucun_                                                              | —                                                        | Interne.                                                                                                |
| `post_mortem`     | _aucun_                                                              | —                                                        | Interne strict.                                                                                         |
| `tool_card`       | `Article`                                                            | (V2 → `SoftwareApplication` si évaluation/note ajoutées) | V1 = `Article`. V2 si on ajoute des ratings on bascule sur `SoftwareApplication`.                       |
| `competitor_card` | _aucun_                                                              | —                                                        | Interne.                                                                                                |
| `commercial_doc`  | _aucun_                                                              | —                                                        | Interne / client.                                                                                       |
| `onboarding_step` | _aucun_                                                              | —                                                        | Client connecté (`/mes-ressources`). Pas crawlable.                                                     |

**Schemas additionnels systématiques** sur toute page publique d'entrée (hors interne) :

- `BreadcrumbList` (hub → type → entrée).
- `Person` (auteur) — Manon canonique (mémoire `axionia_naming_cabinet`, Author SSOT existant).
- `Organization` (publisher) — déjà SSOT dans `src/lib/schema/organization.ts`.
- `WebPage` enveloppant le `mainEntity` typé.

**Anti-pattern** : ne JAMAIS exposer plusieurs JSON-LD contradictoires sur la même page (Agent 6 §284 prompt master). `getJsonLdType()` retourne **un seul** type primary, les autres sont des wrappers (`BreadcrumbList` etc.).

---

## 15. Mapping `type → composant React`

Chaque type a un `<TypeName>Template.tsx` server component. Tous résolus via `<EntryRenderer entry={entry} />` :

```
src/components/knowledge/public/templates/
├── EntryRenderer.tsx              ← switch sur entry.type → composant
├── ArticleTemplate.tsx
├── CaseStudyTemplate.tsx
├── HelpArticleTemplate.tsx
├── FaqTemplate.tsx
├── GlossaryTermTemplate.tsx
├── GuideTemplate.tsx
├── MethodologyTemplate.tsx
├── DoctrineTemplate.tsx
├── ToolCardTemplate.tsx
└── shared/
    ├── EntryHeader.tsx            ← title + author + dates + breadcrumb
    ├── EntryBody.tsx              ← renderTiptapToReact()
    ├── EntryFooter.tsx            ← related + helpful buttons
    ├── EntryToc.tsx               ← sticky TOC (Sprint KB-16)
    ├── FactCheckedBadge.tsx       ← E-E-A-T (Sprint KB-10)
    └── AuthorByline.tsx
```

Pour les types **internes** (`adr`, `prompt_template`, `sop`, `post_mortem`, `competitor_card`, `commercial_doc`, `onboarding_step`) — pas de template public. Les pages admin / client utilisent leurs propres composants (`AdminEntryDetail.tsx`, `ClientEntryDetail.tsx`).

`EntryRenderer` :

```tsx
// EntryRenderer.tsx — server component pur
import { getEntryRenderer } from "@/content/knowledge-base";
import dynamic from "next/dynamic";

const TEMPLATES = {
  ArticleTemplate: dynamic(() => import("./ArticleTemplate")),
  CaseStudyTemplate: dynamic(() => import("./CaseStudyTemplate")),
  // ...
} as const;

export function EntryRenderer({ entry }: { entry: KnowledgeEntry }) {
  const rendererId = getEntryRenderer(entry.type);
  const Template = TEMPLATES[rendererId as keyof typeof TEMPLATES];
  if (!Template) return null;
  return <Template entry={entry} />;
}
```

**Anti-pattern évité** : ne PAS embarquer la résolution composant dans le SSOT (`src/content/`). Le SSOT retourne un **string identifier** (`"ArticleTemplate"`), le composant React vit dans `src/components/` et fait le mapping string → JSX dynamic. Séparation config / runtime stricte.

---

## 16. Helpers exposés — récapitulatif (API publique du module)

| Helper                                                                                                 | Source                  | Signature résumée                                      | Usage                                  |
| ------------------------------------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------ | -------------------------------------- |
| `isPublicAudience`                                                                                     | `audiences.ts`          | `(KbAudience) → boolean`                               | sitemap, RSS, JSON-LD, filtres serveur |
| `isClientAudience`                                                                                     | `audiences.ts`          | `(KbAudience) → boolean`                               | `/mes-ressources/` filter              |
| `isInternalAudience`                                                                                   | `audiences.ts`          | `(KbAudience) → boolean`                               | filtre admin                           |
| `formatAudienceLabel`                                                                                  | `audiences.ts`          | `(KbAudience) → i18nKey`                               | UI badges                              |
| `formatAudienceBadge`                                                                                  | `audiences.ts`          | `(KbAudience) → i18nKey`                               | UI badges courts                       |
| `isExternalSafeConfidentiality`                                                                        | `confidentialities.ts`  | `(KbConfidentiality) → boolean`                        | worker embeddings KB-21                |
| `isMoreConfidentialThan`                                                                               | `confidentialities.ts`  | `(KbConfidentiality, KbConfidentiality) → boolean`     | tri/compare                            |
| `isAllowedTransition`                                                                                  | `statuses.ts`           | `(KbStatus, KbStatus) → boolean`                       | server actions workflow                |
| `isIndexableStatus`                                                                                    | `statuses.ts`           | `(KbStatus) → boolean`                                 | sitemap/FTS                            |
| `shouldPingIndexNow`                                                                                   | `statuses.ts`           | `(KbStatus, KbStatus) → boolean`                       | hook post-publish                      |
| `getInverseRelation`                                                                                   | `relation-kinds.ts`     | `(KbRelationKind) → KbRelationKind \| null`            | `addRelation` action                   |
| `getJsonLdType`                                                                                        | `types.ts`              | `(KbType, hints?) → string \| null`                    | builders JSON-LD                       |
| `getEntryRenderer`                                                                                     | `types.ts`              | `(KbType) → string`                                    | EntryRenderer switch                   |
| `getEntryTemplate`                                                                                     | `templates.ts`          | `(KbType) → TiptapDoc`                                 | création entrée                        |
| `getSnippetById`                                                                                       | `snippets.ts`           | `(string) → KbSnippet \| undefined`                    | slash-command                          |
| `getSnippetsByCategory`                                                                                | `snippets.ts`           | `(category) → KbSnippet[]`                             | menu slash                             |
| `getQualityThreshold`                                                                                  | `quality-thresholds.ts` | `(KbType) → QualityThreshold`                          | gate publish                           |
| `getReviewWindow`                                                                                      | `review-windows.ts`     | `(KbType) → ReviewWindow`                              | cron `knowledge-review-expiry.ts`      |
| `computeReviewDueAt`                                                                                   | `review-windows.ts`     | `(KbType, Date) → Date`                                | publish action                         |
| `getPublicRoute`                                                                                       | `routes.ts`             | `(KbType, Locale, slug, fallbackId?) → string \| null` | sitemap, links, redirects              |
| `getTypeHubRoute`                                                                                      | `routes.ts`             | `(KbType, Locale) → string \| null`                    | hub pages                              |
| `getAdminPrefix`                                                                                       | `routes.ts`             | `() → string`                                          | env-driven admin URL                   |
| `getAdminUrl`                                                                                          | `routes.ts`             | `(Locale, path) → string`                              | admin links                            |
| `canUserEditEntry`                                                                                     | `knowledge-base.ts`     | `(user, entry) → boolean`                              | server actions + UI                    |
| `isEntryPubliclyVisible`                                                                               | `knowledge-base.ts`     | `(entry) → boolean`                                    | server actions + sitemap               |
| `isEntryClientVisible`                                                                                 | `knowledge-base.ts`     | `(entry) → boolean`                                    | server actions client                  |
| `isKbType` / `isKbDomain` / `isKbAudience` / `isKbConfidentiality` / `isKbStatus` / `isKbRelationKind` | divers                  | `(unknown) → boolean`                                  | parse params/CSV                       |

**Convention** :

- Les **predicates** (`isXxx`) retournent toujours `boolean`.
- Les **formatters** retournent une **clé i18n** string (jamais le label localisé directement). Le composant React appelle `t(formatXxx())`.
- Les **lookups** (`getXxx`) lancent une erreur si l'input est invalide (pattern `getTierById` dans `pricing.ts` — fail-fast).

---

## 17. Décision i18n — mono-fichier vs multi-fichiers

### Contexte

Reality check §1.6 confirme : `src/messages/fr.json` (243 lignes) + `en.json` (243 lignes) sont **mono-fichiers**. Le prompt master §11.1 propose `src/messages/fr/knowledge.json` (multi-fichiers).

### Décision recommandée : **mono-fichier**, namespacing strict `knowledge.*`

**Pour** :

1. Alignement zéro-effort avec l'existant (`pnpm i18n:check` continue de fonctionner sans refonte).
2. Pas de risque de casse `getMessages()` config next-intl (`src/i18n/request.ts`).
3. Volume KB estimé : ~150-300 clés (types/domaines/audiences labels + descriptions courtes + templates markers + snippets labels + status/relation labels + admin UI). Ce volume est gérable dans le mono-fichier (qui passerait de 243 → ~450 lignes — encore lisible).
4. **Code = SSOT** (doctrine) : le code identifie déjà l'entrée par sa **clé string** ; la migration en multi-fichiers serait purement organisationnelle, sans bénéfice fonctionnel.
5. `pnpm i18n:check` actuel valide la parité FR/EN clé-par-clé — recrée la même garantie qu'un éclatement.

**Contre** :

- Si KB grossit > 800 clés, le mono-fichier devient pénible à reviewer.
- Mitigation : V2 (au moment de dépasser ~600 clés), on migre EN BLOC `messages/fr.json` → `messages/fr/{index,knowledge,booking,common}.json`. Faisable en 1 sprint dédié sans toucher au code applicatif.

### Décision opposée (multi-fichiers) — non recommandée mais documentée

Si Will tranche pour multi-fichiers en Phase B, prévoir Sprint pré-KB-1 dédié :

1. Refactor `src/i18n/request.ts` pour merger plusieurs JSON via `deepmerge`.
2. Découper `fr.json` → `fr/common.json` + `fr/nav.json` + `fr/home.json` + ... + `fr/knowledge.json`.
3. Mettre à jour `pnpm i18n:check` pour parser multi-fichiers.
4. Valider que Sentry/Tiptap/Plausible n'ont pas d'attente sur le format `messages/{locale}.json`.

**Effort multi-fichiers** : +2 dj de plus que mono-fichier — non justifié en V1.

---

## 18. Recommandation namespacing i18n

Pattern proposé pour `src/messages/fr.json` (et `en.json` mirror) :

```json
{
  "knowledge": {
    "types": {
      "article": {
        "label": "Article",
        "description": "Article de blog éditorial Axion-IA",
        "pluralLabel": "Articles",
        "hubTitle": "Le blog Axion-IA"
      },
      "case_study": {
        "label": "Cas concret",
        "description": "Étude de cas client réelle",
        "pluralLabel": "Cas concrets",
        "hubTitle": "Cas concrets clients"
      },
      "help_article": { "label": "Article d'aide", "...": "..." },
      "faq": { "label": "Question fréquente", "...": "..." },
      "glossary_term": { "label": "Terme du glossaire", "...": "..." }
    },
    "domains": {
      "commercial": { "label": "Commercial" },
      "technical": { "label": "Technique" },
      "legal": { "label": "Juridique" }
    },
    "audiences": {
      "public": {
        "label": "Public",
        "badge": "Public",
        "description": "Visible sans authentification"
      },
      "client": {
        "label": "Client",
        "badge": "Client",
        "description": "Visible aux clients connectés"
      },
      "team": {
        "label": "Équipe",
        "badge": "Interne",
        "description": "Visible à l'équipe Axion-IA"
      },
      "will_only": {
        "label": "Will uniquement",
        "badge": "Privé",
        "description": "Visible à Will uniquement"
      }
    },
    "confidentialities": {
      "public": { "label": "Public" },
      "internal": { "label": "Interne" },
      "confidential": { "label": "Confidentiel" },
      "secret": { "label": "Secret" }
    },
    "statuses": {
      "draft": { "label": "Brouillon", "badge": "Brouillon" },
      "review": { "label": "En revue", "badge": "Revue" },
      "scheduled": { "label": "Planifié", "badge": "Planifié" },
      "published": { "label": "Publié", "badge": "En ligne" },
      "deprecated": { "label": "Obsolète", "badge": "Obsolète" },
      "archived": { "label": "Archivé", "badge": "Archivé" }
    },
    "relations": {
      "related": { "label": "Voir aussi" },
      "prerequisite": { "label": "Prérequis" },
      "follow_up": { "label": "Pour aller plus loin" },
      "supersedes": { "label": "Remplace" },
      "superseded_by": { "label": "Remplacé par" }
    },
    "templates": {
      "article": {
        "intro": "Introduction",
        "body": "Développement",
        "conclusion": "Pour conclure"
      },
      "case_study": {
        "context": "Contexte client",
        "problem": "Problème initial",
        "solution": "Solution Axion-IA",
        "results": "Résultats mesurés"
      },
      "help_article": { "symptom": "Symptôme", "steps": "Étapes de résolution" },
      "guide": { "objective": "Objectif", "steps": "Étapes", "summary": "Récapitulatif" },
      "adr": { "context": "Contexte", "decision": "Décision", "consequences": "Conséquences" },
      "post_mortem": {
        "summary": "Résumé",
        "timeline": "Chronologie",
        "lessons": "Leçons apprises"
      }
    },
    "snippets": {
      "callout_info": { "label": "Encadré info", "description": "Bloc d'information neutre" },
      "callout_warning": {
        "label": "Encadré avertissement",
        "description": "Bloc d'avertissement"
      },
      "cta_booking": {
        "label": "CTA réservation",
        "description": "Bouton réserver une intervention"
      },
      "internal_link": { "label": "Lien interne", "description": "Lien vers une autre entrée KB" }
    },
    "admin": {
      "listTitle": "Connaissances",
      "newEntry": "Nouvelle entrée",
      "saveDraft": "Enregistrer brouillon",
      "submitForReview": "Soumettre à la revue",
      "publish": "Publier",
      "autosaveSaved": "Enregistré",
      "autosaveSaving": "Enregistrement…"
    },
    "public": {
      "hubTitle": "Ressources Axion-IA",
      "hubDescription": "Articles, cas concrets, guides IA et centre d'aide",
      "noResults": "Aucun résultat",
      "helpfulQuestion": "Cette ressource vous a été utile ?",
      "helpfulYes": "Oui",
      "helpfulNo": "Non",
      "lastReviewedAt": "Dernière revue : {date}",
      "updatedAt": "Mis à jour le {date}"
    },
    "client": {
      "myResources": "Mes ressources",
      "bookmark": "Ajouter aux favoris",
      "removeBookmark": "Retirer des favoris"
    }
  }
}
```

### Conventions de naming i18n

- `knowledge.<section>.<id>.<champ>` — pattern strict.
- `<id>` = valeur DB stable (jamais traduite : `case_study`, pas `casConcret`).
- `<champ>` standard : `label` (court), `description` (1 phrase), `pluralLabel` (liste), `badge` (très court UI), `hubTitle` (titre page liste).
- Interpolation next-intl : `{date}`, `{count}`, `{name}` — paramétrer dans le composant via `t('xxx', { date: formattedDate })`.

### Sync FR/EN

`pnpm i18n:check` existant valide déjà la parité clé-par-clé. Sprint KB-1 doit s'assurer que **toutes** les clés ajoutées en `fr.json` ont leur miroir en `en.json` (sinon CI fail). Aucun assouplissement de cette règle.

### Décision : les labels EN sont produits par Will / agent EN dédié, jamais par auto-traduction au runtime

(Cohérent avec `axionia_session_2026-05-13_seo_email_stack` et la doctrine éditoriale.)

---

## 19. Anti-patterns identifiés (récapitulatif)

Conformément au prompt master §Agent 2 (ligne 238) :

1. **Anti-pattern : labels UI dans le SSOT**
   - Évité : tous les labels FR/EN vivent dans `src/messages/{fr,en}.json`, les helpers SSOT retournent des **clés i18n** (`formatAudienceLabel()` → `"knowledge.audiences.public.label"`), jamais le label localisé.

2. **Anti-pattern : mélange config et runtime data**
   - Évité : `src/content/knowledge/` contient UNIQUEMENT de la config statique (enums, mappings, seuils par défaut). Les données runtime (entrées, versions, traductions) vivent en DB. Les composants React vivent dans `src/components/`. Les server actions dans `src/server/actions/`.

3. **Anti-pattern : duplication d'enums Prisma sans single source**
   - Évité : la SSOT TS pilote la génération Prisma via script `scripts/sync-kb-enums-to-prisma.ts`. Aucune divergence possible. Test garde-fou dans `knowledge-base.test.ts` : `KB_TYPES` doit matcher l'enum `KbType` généré par Prisma (compare au runtime via `Object.values(Prisma.KbType)`).

4. **Anti-pattern : SSOT monolithique illisible**
   - Évité : splitting cohésif en 11 sous-modules. Façade `knowledge-base.ts` ne fait que ré-exporter (pas de logique métier qui s'accumule).

5. **Anti-pattern : helpers qui font de l'I/O DB**
   - Évité : les helpers SSOT sont des fonctions pures. `getQualityThreshold` retourne la constante. La résolution Settings DB (V2) sera faite dans un wrapper `src/lib/knowledge/quality-thresholds-resolver.ts` qui appelle le helper SSOT comme fallback.

6. **Anti-pattern : couplage circulaire SSOT ↔ Prisma**
   - Évité : `src/content/knowledge/*.ts` n'importe **rien** de `@prisma/client` sauf via `import type` pour les enums dérivés. Les helpers cross-module qui ont besoin de `AdminRole` (Prisma enum) vivent dans la façade `knowledge-base.ts` (pas dans les sous-modules).

7. **Anti-pattern : magic strings de routes**
   - Évité : `KB_PUBLIC_ROUTES` + `KB_ADMIN_PATHS` sont la SSOT. `getPublicRoute()` / `getAdminUrl()` produisent les URLs. Aucun composant ne hardcode `/blog/${slug}` directement.

8. **Anti-pattern : labels traduits par défaut dans le code**
   - Évité : aucun fallback string FR dans le SSOT (ex pas de `"Brouillon"` dans `statuses.ts`). Si la clé i18n manque côté composant, next-intl render la clé brute → erreur visible en dev/CI.

---

## 20. Tests colocalisés à prévoir (Sprint KB-1)

Pattern aligné `interventions-taxonomy.test.ts`. Fichiers attendus :

- `src/content/knowledge-base.test.ts` (contrat global)
  - `KB_TYPES.length === 16`.
  - Tous les `KbType` ont une entrée dans `KB_JSON_LD_TYPE`, `KB_RENDERER_ID`, `KB_PUBLIC_ROUTES`.
  - `canUserEditEntry` : matrice rôle × audience × confidentiality (10+ cas).
  - `isEntryPubliclyVisible` : combinaisons audience × status (8 cas).

- `src/content/knowledge/types.test.ts`
  - `getJsonLdType('guide', { hasSteps: false }) === 'TechArticle'`.
  - `getJsonLdType('help_article', { isTechnical: true }) === 'TechArticle'`.
  - `isKbType('article') === true` / `isKbType('xyz') === false`.

- `src/content/knowledge/statuses.test.ts`
  - `KB_TRANSITIONS` : pas de cycle infini (toute transition vers `archived` est terminale sauf reset draft).
  - `shouldPingIndexNow` : 4 cas (publish, unpublish, archive, no-op).

- `src/content/knowledge/audiences.test.ts`
  - `formatAudienceLabel` retourne une clé i18n existante (cross-check avec `fr.json` parsé).

- `src/content/knowledge/routes.test.ts`
  - `getPublicRoute('article', 'fr', 'mon-slug') === '/blog/mon-slug'`.
  - `getPublicRoute('adr', 'fr', 'slug', 'id123') === '/ressources/id123/slug'`.
  - `getPublicRoute('adr', 'fr', 'slug')` (sans fallbackId) → `null`.
  - `getAdminPrefix()` throw si `ADMIN_URL_PREFIX` absent (test avec env mock).

- `src/content/knowledge/quality-thresholds.test.ts`
  - Tous les `KbType` ont un threshold défini.
  - `altTextRequired === true` pour tous (canonical).

- **Cross-check FR/EN i18n** (ajouter à `pnpm i18n:check`) :
  - Toutes les clés `knowledge.types.<type>.*` retournées par `formatAudienceLabel` / `formatTypeLabel` etc. existent dans `fr.json` ET `en.json`. Failsafe : test qui parse les helpers et vérifie chaque clé.

**Cible** : ≥ 25 tests unitaires SSOT (Sprint KB-1).

---

## 21. Génération enums Prisma — script `sync-kb-enums-to-prisma.ts`

Pour respecter l'anti-pattern §3 (duplication enums), Sprint KB-1 produit un script qui :

1. Lit `KB_TYPES`, `KB_DOMAINS`, `KB_AUDIENCES`, `KB_CONFIDENTIALITIES`, `KB_STATUSES`, `KB_RELATION_KINDS` depuis les SSOT TS.
2. Génère un fragment `prisma/schema-fragments/kb-enums.prisma` avec les `enum KbType { ... }` Prisma.
3. Concatène dans `prisma/schema.prisma` entre les balises `// <kb-enums-start>` et `// <kb-enums-end>`.
4. Exécuté en hook `predb:migrate:dev` (npm script).

Test : si Will modifie `KB_TYPES` et oublie de relancer le script, `pnpm prisma format` détecte un drift au prochain run (l'enum DB n'a pas le nouveau membre).

**Garde-fou test** dans `knowledge-base.test.ts` :

```ts
import { KbType as PrismaKbType } from "@prisma/client";
import { KB_TYPES } from "@/content/knowledge-base";
it("KB_TYPES TS et Prisma KbType sont synchronisés", () => {
  expect([...KB_TYPES].sort()).toEqual(Object.values(PrismaKbType).sort());
});
```

Ce test CASSE le CI si quelqu'un modifie un enum d'un côté seulement. Garantit la SSOT.

---

## 22. STOP & ASK — décisions à trancher Will

Ces décisions sont **bloquantes** pour Phase B Sprint KB-1. À ajouter au reality check §10 :

1. **i18n mono-fichier vs multi-fichiers** (recommandation reality check + Agent 2 = mono-fichier) → confirmer.
2. **Génération enums Prisma depuis TS** : script `sync-kb-enums-to-prisma.ts` (recommandation Agent 2) OU édition manuelle `schema.prisma` ? Recommandation Agent 2 = script.
3. **Snippets éditeur** : V1 (Sprint KB-3 minimal) vs V1-extended (Sprint KB-16) ? Recommandation Agent 2 = V1 = 0 snippets, V1-extended = 4 snippets initiaux (callout-info, callout-warning, cta-booking, internal-link).
4. **Templates Tiptap** : V1 = templates initiaux pour `article`, `case_study`, `help_article`, `guide`, `adr`, `post_mortem`. Les 10 autres types = body vide. Confirmer ?
5. **Quality thresholds par défaut** : valeurs §11 (`minBodyChars` etc.) figées Agent 2 OU à valider par Will éditorialement ? Recommandation Agent 2 = valider une fois en revue, puis V1.
6. **Review windows par défaut** : valeurs §12 figées Agent 2 OU à valider Will ? Idem.
7. **Routes fallback non typées** : pour les types internes qui DEVIENNENT publiques (ex `methodology` `audience='public'`), URL = `/ressources/<id>/<slug>` (recommandation Agent 2) OU `/ressources/<type-slug>/<slug>` (plus SEO friendly mais nécessite mapping label-FR-de-type → slug-URL) ?
   - Recommandation Agent 2 = `/ressources/<id>/<slug>` en V1 (simple), avec `<id>` opaque CUID. V2 = mapping slug-friendly si volume justifie.

**Décisions transversales déjà tranchées en reality check § 10** (rappel pour cohérence) :

- Hub public = `/ressources/` (`fr`) et `/resources/` (`en`) — confirmé.
- Body Tiptap JSON canonical + HTML rendered + text plain — confirmé.
- `KbStatus` enum dédié (pas extension de `PublishStatus`) — confirmé.

---

## 23. Cohérence avec doctrine Axion-IA

| Doctrine mémoire                           | Conformité Agent 2                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `axionia_doctrine_code_ssot`               | ✅ Audit (Agent 2 ne touche pas au code, produit spec). Code = SSOT respecté : on aligne sur pattern existant. |
| `axionia_pricing_zero_hardcode_2026-05-08` | ✅ Pattern reproduit : helpers + types + arrays + tests colocalisés.                                           |
| `axionia_naming_brand_vs_project`          | ✅ Identifiers JS camelCase (`getJsonLdType`), marque/projet `Axion-IA`.                                       |
| `axionia_naming_cabinet`                   | ✅ Pas de mention "agence/studio" dans labels (validation côté i18n FR/EN).                                    |
| Web Vitals AGENTS.md                       | ✅ SSOT pur (zero JS runtime overhead) : aucune fonction n'augmente le bundle public > 1 KB gz.                |
| ADR location `docs/adr/`                   | À ajouter dans ADR-DRAFT (Agent 8) : SSOT KB doit être référencé dans `0021-knowledge-base.md`.                |

---

## 24. Effort estimé Sprint KB-1 — partie SSOT seule

| Tâche                                                                             | Effort    |
| --------------------------------------------------------------------------------- | --------- |
| Créer `src/content/knowledge-base.ts` + 11 sous-modules                           | 0.5 dj    |
| Tests colocalisés ≥ 25 cas                                                        | 0.5 dj    |
| Script `sync-kb-enums-to-prisma.ts` + intégration `pnpm` scripts                  | 0.3 dj    |
| Ajout namespace `knowledge.*` dans `fr.json` + `en.json` (150-200 clés initiales) | 0.5 dj    |
| Garde-fou test sync TS ↔ Prisma                                                   | 0.1 dj    |
| Doc inline (commentaires)                                                         | 0.1 dj    |
| **Total Agent 2 livrables Sprint KB-1**                                           | **~2 dj** |

(Inclus dans les 4 dj du Sprint KB-1 global du prompt master §13.3.)

---

**Fin Agent 2 — SSOT contenu — AUDIT-ONLY.**

> Aucune écriture sous `src/content/`. Tout est spec markdown avec blocs ```ts. Pré-requis Phase B : Will tranche les 7 STOP & ASK §22.
