# V-GROUPE-2 — KB + Seeds + Admin Init
## Audit AUDIT-ONLY — 2026-05-22

---

## A. Fichiers KB sectorielle

### Résultat par fichier

| Fichier | Export | Facts comptés | Seuil requis | Statut |
|---|---|---|---|---|
| `src/server/content-gen/kb/audits.ts` | `KB_AUDITS` | **10** | ≥10 | ✅ |
| `src/server/content-gen/kb/interventions-formations.ts` | `KB_INTERVENTIONS_FORMATIONS` | **80** | ≥20 | ✅ |
| `src/server/content-gen/kb/un-a-un.ts` | `KB_UN_A_UN` | **60** | ≥20 | ✅ |
| `src/server/content-gen/kb/implementations.ts` | `KB_IMPLEMENTATIONS` | **80** | ≥20 | ✅ |
| `src/server/content-gen/kb/sites-web-augmentes.ts` | `KB_SITES_WEB_AUGMENTES` | **60** | ≥20 | ✅ |

**Total : 290 facts réels** (vs 130 annoncés dans le UI — écart détaillé § E).

### Vérification du schéma des facts

Chaque fact a bien les 7 champs requis : `id`, `text`, `source`, `sourceUrl`, `verifiedAt`, `verticales`, `confidence`.

- `KB_AUDITS` : interface `KbFact` définie dans le même fichier (lignes 14-22), 10 facts `audit-001` à `audit-010`.
- `KB_INTERVENTIONS_FORMATIONS` : importe `KbFact` de `./audits`, 80 facts `form-001` à `form-080`.
- `KB_UN_A_UN` : importe `KbFact` de `./audits`, 60 facts `ua-001` à `ua-060`.
- `KB_IMPLEMENTATIONS` : importe `KbFact` de `./audits`, 80 facts `impl-001` à `impl-080`.
- `KB_SITES_WEB_AUGMENTES` : importe `KbFact` de `./audits`, 60 facts `web-001` à `web-060`.

Toutes les `verticales` sont correctement renseignées (valeurs : `"audits"`, `"interventions_formations"`, `"un_a_un"`, `"implementations"`, `"sites_web_augmentes"`).

**Résultat A : ✅ 5/5 OK**

---

## B. Seed KB facts — `prisma/seeds/content-gen/seed-kb-facts.ts`

### B.1 Imports des 5 KB

```ts
import { KB_AUDITS } from "../../../src/server/content-gen/kb/audits";
import { KB_INTERVENTIONS_FORMATIONS } from "../../../src/server/content-gen/kb/interventions-formations";
import { KB_UN_A_UN } from "../../../src/server/content-gen/kb/un-a-un";
import { KB_IMPLEMENTATIONS } from "../../../src/server/content-gen/kb/implementations";
import { KB_SITES_WEB_AUGMENTES } from "../../../src/server/content-gen/kb/sites-web-augmentes";
```

✅ Les 5 KB sont importées.

### B.2 ALL_KB_FACTS inclut les 5

```ts
const ALL_KB_FACTS: readonly KbFact[] = [
  ...KB_AUDITS,
  ...KB_INTERVENTIONS_FORMATIONS,
  ...KB_UN_A_UN,
  ...KB_IMPLEMENTATIONS,
  ...KB_SITES_WEB_AUGMENTES,
];
```

✅ Toutes les 5 KB sont incluses dans `ALL_KB_FACTS`.

### B.3 Export `seedKbFacts(prisma)`

```ts
export async function seedKbFacts(prisma: PrismaClient): Promise<number>
```

✅ Exportée, retourne le nombre de facts upsertés.

### B.4 Upsert idempotent (pas de delete)

Le seed utilise `prisma.knowledgeEntry.upsert` (sur `{ slug }`) et `prisma.knowledgeTranslation.upsert` (sur `{ locale_slug: { locale, slug } }`). Aucun `deleteMany` / `delete` dans le fichier.

✅ Idempotent confirmé.

**Résultat B : ✅ 4/4 OK**

---

## C. Seed Campaign Templates — `prisma/seeds/content-gen/seed-campaign-templates.ts`

### C.1 Les 8 presets présents

| Slug | Label |
|---|---|
| `toutes-verticales-general` | ✅ |
| `interventions-formations-all` | ✅ |
| `audits-all` | ✅ |
| `implementations-all` | ✅ |
| `un-a-un-all` | ✅ |
| `sites-web-augmentes-all` | ✅ |
| `landing-villes-all` | ✅ |
| `rss-daily` | ✅ |

✅ Les 8 presets sont présents.

### C.2 ALL_TARGETS = ["tpe", "pme", "eti", "ge"]

```ts
const ALL_TARGETS = ["tpe", "pme", "eti", "ge"];
```

Tous les presets utilisent `ALL_TARGETS` directement (référence constante). ✅

### C.3 Les 5 verticales couvertes

```ts
const ALL_VERTICALS = [
  "interventions_formations",
  "audits",
  "implementations",
  "un_a_un",
  "sites_web_augmentes",
];
```

Les presets `toutes-verticales-general`, `landing-villes-all` et `rss-daily` couvrent toutes les 5. Les 5 autres presets couvrent chacun une verticale spécifique. ✅

### C.4 Export `seedCampaignTemplates(prisma)`

```ts
export async function seedCampaignTemplates(prisma: PrismaClient): Promise<number>
```

✅ Exportée, retourne le count de templates upsertés.

### C.5 Upsert idempotent

Utilise `db.campaignTemplate.upsert({ where: { slug: t.slug }, create: {...}, update: {...} })`. Aucun `delete`. ✅

**Résultat C : ✅ 5/5 OK**

---

## D. Admin page Init KB + Presets

### D.1 `src/server/actions/content-gen/seed-initial.ts`

- `"use server"` déclaré ligne 1. ✅
- Importe `seedKbFacts` et `seedCampaignTemplates`. ✅
- Exporte `runInitialSeed()` qui appelle les deux seeds en `Promise.all`. ✅

### D.2 Page `seed-initial/page.tsx`

Fichier : `src/app/[locale]/(admin)/[adminPrefix]/content-gen/settings/seed-initial/page.tsx`

✅ Existe. Server Component avec `dynamic = "force-dynamic"`, vérifie la session, rend `<SeedInitialV2 />`.

### D.3 `seed-initial/_v2/SeedInitialV2.tsx`

- `"use client"` ✅ (justifié par `useState` + `onClick` interactif)
- Bouton `<button type="button" className="admin-button-cta" onClick={handleSeed}>` ✅
- Affiche le résultat (kbFacts + campaignTemplates insérés) après le clic ✅

### D.4 `SettingsIndexV2.tsx` contient `"seed-initial"`

Dans `SECTIONS` (ligne 62) :

```ts
{ href: "seed-initial", label: "🚀 Init KB + Presets", description: "Charge les 130 facts KB et les 6 presets de campagne en base (1 clic)" },
```

✅ Le lien `seed-initial` est bien présent dans `SECTIONS`.

**Résultat D : ✅ 4/4 OK**

---

## E. KB intégration dans les générateurs — `src/server/content-gen/kb-client.ts`

### E.1 Fonction `retrieve` exportée

```ts
export async function retrieve(opts: KbRetrieveOptions): Promise<KbRetrievedChunk[]>
```

✅ Exportée, supporte modes `fts`, `vector`, `hybrid`.

### E.2 Utilisée par les générateurs

Grep sur `retrieve|kb-client` dans `src/server/content-gen/` → 14 fichiers matches, incluant :

- `generators/blog-article.ts` ✅
- `generators/blog-from-keywords.ts` ✅
- `generators/blog-from-rss.ts` ✅
- `generators/blog-from-title.ts` ✅
- `generators/comparison.ts` ✅
- `generators/qa-derived.ts` ✅
- `generators/landing-ville.ts` ✅
- `generators/guide-pilier.ts` ✅
- `generators/faq-standalone.ts` ✅

**Résultat E : ✅ 2/2 OK — 9 générateurs utilisent `retrieve`**

---

## Anomalies et écarts constatés

### ❌ DISCORDANCE UI vs réalité : 290 facts, pas 130

Le UI (`SeedInitialV2.tsx` + `SettingsIndexV2.tsx`) annonce **130 facts** et **6 presets** :

- `SeedInitialV2.tsx` ligne 25 : "Charge les 130 facts KB sectoriels et les 6 presets de campagne"
- `SettingsIndexV2.tsx` ligne 63 : "Charge les 130 facts KB et les 6 presets de campagne en base"

**Réalité mesurée :** 290 facts (10 + 80 + 60 + 80 + 60) et **8 presets** (pas 6).

**Impact :** Aucun impact fonctionnel (seed fonctionne correctement), mais le wording du UI est inexact. P2 : à corriger pour cohérence.

### ❌ DISCORDANCE : le seed-kb-facts.ts header annonce des chiffres obsolètes

Le commentaire du fichier `seed-kb-facts.ts` (lignes 6-7) mentionne :
- "verticale `audits` (10 facts)"
- "interventions-formations (32), un-a-un (28), implementations (32), sites-web-augmentes (28)"

Ces chiffres sont ceux des premières versions. La KB a été massivement enrichie en P6 mais le commentaire n'a pas été mis à jour.

**Réalité :** interventions-formations = 80, un-a-un = 60, implementations = 80, sites-web-augmentes = 60.

**Impact :** Documentation seulement, aucun impact fonctionnel. P3 : à corriger.

---

## Résumé global

| Groupe | Tests | Passés | Échoués |
|---|---|---|---|
| A. KB sectorielle | 5 | 5 | 0 |
| B. Seed KB facts | 4 | 4 | 0 |
| C. Seed Campaign Templates | 5 | 5 | 0 |
| D. Admin page Init KB | 4 | 4 | 0 |
| E. KB intégration générateurs | 2 | 2 | 0 |
| **TOTAL** | **20** | **20** | **0** |

**Score : ✅ 20/20 — 100 % — GO**

Deux discordances documentaires (P2/P3) sans impact fonctionnel :
1. UI annonce 130 facts / 6 presets → réalité 290 facts / 8 presets
2. Commentaire seed-kb-facts.ts avec anciens chiffres par verticale
