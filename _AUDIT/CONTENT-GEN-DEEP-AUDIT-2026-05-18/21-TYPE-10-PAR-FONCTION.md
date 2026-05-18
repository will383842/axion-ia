# 21 — TYPE 10 : Pages par-fonction (catalogue par fonction d'entreprise)

> Score : 0/100 — Status : 🔴 INEXISTANT (gap stratégique total)

---

## 1. Description simple (Will-readable)

L'idée business : pour chaque fonction d'entreprise (RH, ventes, marketing,
support, compta, juridique, IT, ops), produire une page pSEO listant les
interventions / audits / implémentations IA pertinents pour cette fonction.

Cible search : `automatiser RH avec IA`, `IA pour service compta`, `outil IA
support client`, etc. Volume estimé : 8 fonctions × 4 verticales = 32 pages FR.

**Constat au HEAD `9c1adaa`** : aucune route `par-fonction/` n'existe dans
l'app FR ou EN. Aucun fichier data (`src/content/fonctions.ts`). Aucun
générateur. Aucun seed. Aucune entrée admin. Aucun test.

C'est donc un type de contenu **planifié à la spec** (mentionné dans le prompt
d'audit) mais **jamais implémenté**. Tous les items ci-dessous sont des gaps.

---

## 2. Diagramme Mermaid (flow complet)

```mermaid
flowchart TD
    A[Will trigger Sprint par-fonction] --> B{Décision data source}
    B -->|Option A| C[src/content/fonctions.ts hardcode]
    B -->|Option B| D[Prisma Function + FunctionTranslation tables]
    B -->|Option C| E[Réutiliser KnowledgeEntry type=function]

    C --> F[Page src/app/[locale]/interventions/par-fonction/[slug]/page.tsx]
    C --> G[Page src/app/[locale]/audit/par-fonction/[slug]/page.tsx]
    C --> H[Page src/app/[locale]/implementation/par-fonction/[slug]/page.tsx]
    C --> I[Page src/app/[locale]/un-a-un/par-fonction/[slug]/page.tsx]

    F --> J[generateStaticParams 8 fonctions × 2 locales = 16 SSG]
    F --> K[JSON-LD Service avec serviceType=function]
    F --> L[Mesh interne vers cas concrets filtered by function]
    F --> M[sub-sitemap par-fonction.xml]

    style A fill:#ff9999
    style B fill:#ff9999
    style C fill:#ff9999
    style D fill:#ff9999
    style E fill:#ff9999
    style F fill:#ff9999
    style G fill:#ff9999
    style H fill:#ff9999
    style I fill:#ff9999
    style J fill:#ff9999
    style K fill:#ff9999
    style L fill:#ff9999
    style M fill:#ff9999
```

Rouge = tout est gap. Aucun nœud n'est implémenté.

---

## 3. Inputs / Outputs (fichier:ligne)

### Routes attendues (inventaire prompt)

| Route attendue                                                 | Statut                        |
| -------------------------------------------------------------- | ----------------------------- |
| `src/app/[locale]/implementation/par-fonction/[slug]/page.tsx` | ❌ Inexistant — gap identifié |
| `src/app/[locale]/audit/par-fonction/[slug]/page.tsx`          | ❌ Inexistant — gap identifié |
| `src/app/[locale]/interventions/par-fonction/[slug]/page.tsx`  | ❌ Inexistant — gap identifié |
| `src/app/[locale]/un-a-un/par-fonction/[slug]/page.tsx`        | ❌ Inexistant — gap identifié |

Vérification :

```bash
# Aucun match
Glob src/app/[locale]/**/par-fonction/**     # 0 files
```

### Data source attendue

| Data attendue                                  | Statut                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/content/fonctions.ts`                     | ❌ Inexistant — gap identifié                                                          |
| `src/content/functions.ts`                     | ❌ Inexistant — gap identifié                                                          |
| Modèle Prisma `Function` ou `BusinessFunction` | ❌ Inexistant — `prisma/schema.prisma` ne contient ni l'un ni l'autre                  |
| Enum KbType valeur `function`                  | ❌ Absent — `prisma/schema.prisma:480-526` énumère 28 types KB, aucun n'est `function` |

Vérification :

```bash
Glob src/content/fonctions*       # 0 files
Glob src/content/functions*       # 0 files
Grep "par-fonction|parFonction|byFunction" → 0 hit dans src/
Grep "model Function|function_" prisma/schema.prisma → 0 hit
```

### Outputs attendus

| Output                                                                      | Statut                                                                                                                |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 8 fonctions × 4 verticales = 32 pages FR                                    | ❌ 0 page produite                                                                                                    |
| JSON-LD `Service` avec sous-spécialisation                                  | ❌ Pas de factory dédiée — `src/lib/seo.ts:209` existe `buildServiceJsonLd` générique mais aucun appel `par-fonction` |
| Sub-sitemap `par-fonction.xml`                                              | ❌ Inexistant — `src/app/sitemap.ts` ne référence aucune route `par-fonction`                                         |
| Mesh inverse depuis cas concrets / interventions vers `par-fonction/[slug]` | ❌ Aucun lien                                                                                                         |
| Hreflang FR↔EN                                                              | ❌ Pas de mapping `pathnames` dans `src/i18n/routing.ts`                                                              |

---

## 4. Quality gates

| Gate                                                                             | Statut                                  |
| -------------------------------------------------------------------------------- | --------------------------------------- |
| Isolation-check (`scripts/content-gen/isolation-check.ts`) couvre `par-fonction` | ❌ Pas de pattern, fichiers inexistants |
| Quality threshold (longueur min body, JSON-LD valide)                            | ❌ Aucune règle                         |
| Doctrine-check (`src/server/content-gen/quality/doctrine-check.ts`)              | ❌ Pas de couverture par-fonction       |
| Lighthouse CI 5 URLs prod (`lighthouserc.json`)                                  | ❌ Aucune URL `par-fonction` listée     |
| size-limit budget bundle                                                         | ❌ N/A, pas de route à mesurer          |

---

## 5. Tests existants

`**UNKNOWN — requires fact-check**`

```bash
Grep "par-fonction|parFonction" test           # 0 hit
Grep "fonctions" tests/                        # 0 hit
```

Conclusion : aucun test ne couvre ce type (cohérent avec inexistence).

---

## 6. Tests manquants

Pour atteindre parité avec autres types (blog, KB, cas-concrets), il faudra :

- Snapshot SSG : 8 fonctions × 2 locales = 16 routes prerender OK
- JSON-LD `Service` validation (schema.org snapshot)
- Mesh inverse : assert cas-concrets `[slug]` page liste les fonctions tags
- Hreflang round-trip FR↔EN
- Sub-sitemap inclut les 32 URLs (4 verticales × 8 fonctions)
- Test unit factory `buildFunctionServiceJsonLd` (à créer)
- Test reader `getFunctionBySlug` (à créer)
- Quality gate doctrine-check (no banned phrases, length min)

Effort estimé : ~4-6h de tests pour le type complet.

---

## 7. Erreurs / edge cases

Tous les edge cases sont théoriques (rien n'existe). Liste prospective :

- Slug collision FR↔EN (`ventes` ⇄ `sales`) : doit utiliser
  `pathnames` mapping dans `src/i18n/routing.ts` (pattern centre-aide
  /help à reproduire).
- Fonction sans cas concret associé : page vide → afficher CTA contact
  obligatoire (anti-thin-content Google).
- Slug invalide (`par-fonction/xxx`) : `dynamicParams = false` requis
  (pattern `src/app/[locale]/centre-aide/[slug]/page.tsx:42`).
- Verticale `un-a-un` : naming reco `un-a-un` (cf. memory `axionia_content_gen_city_domination_2026-05-18`) pas `1-to-1`.
- 4 verticales × 8 fonctions = 32 URLs, mais si certaines combinaisons
  n'ont pas de contenu réel (ex: `audit/par-fonction/it`), produire
  ces pages quand même créerait du thin-content. Décision business
  requise : produire 32 ou seulement les combinaisons couvertes ?

---

## 8. Status global

**Score : 0/100 — 🔴 INEXISTANT**

| Critère             | Note | Justification                             |
| ------------------- | ---- | ----------------------------------------- |
| Routes implémentées | 0/20 | 0/4 verticales, 0/8 fonctions             |
| Data source         | 0/15 | Aucun fichier ou table                    |
| JSON-LD Service     | 0/15 | Factory générique existe mais pas appelée |
| Mesh interne        | 0/10 | Aucun lien                                |
| Hreflang FR↔EN      | 0/10 | Pas de mapping                            |
| Sub-sitemap         | 0/10 | Pas d'entrée                              |
| Tests               | 0/10 | Aucun                                     |
| Admin UI            | 0/5  | Aucune                                    |
| Quality gates       | 0/5  | Aucune règle                              |

**Verdict** : type de contenu **complètement à construire**. Sprint dédié
~2-3 semaines (data model + 4 routes verticales × 8 fonctions + admin +
tests + sitemap + mesh + hreflang). Décision Will préalable : (1) Option
data source A/B/C, (2) produire 32 pages ou subset cohérent, (3)
prioriser cette verticale vs autres gaps connus (par-secteur, par-taille).

**P0 bloquant** : décision business avant tout dev. Sans décision Will,
sprint = waste. Cf. memory `axionia_content_gen_city_domination_2026-05-18`
ligne « gap 4e verticale `1-to-1` -4300 pages » pour contexte gap similaire.

---

_Audit AUDIT-ONLY au HEAD `9c1adaa`. Aucune modification de code._
