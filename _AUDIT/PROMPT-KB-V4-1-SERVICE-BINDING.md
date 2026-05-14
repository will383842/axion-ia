# PROMPT — Sprint KB V4.1 « Service Binding » (Axion-IA)

> **À lancer dans une nouvelle session Claude Code APRÈS** :
>
> - Booking V1 admin UI complet (X.14 → X.19 livrés)
> - Migrations prod stables, healthz vert, KB ingest 401 sans HMAC
> - Aucun WIP sur `main` (ou stash propre)
>
> Estimation : **3-4 jours dev** en autopilot.
> Mode : autopilot avec STOP & ASK uniquement pour décisions business sans default.

---

## CONTEXTE PROJET

Tu reprends **Axion-IA** (`C:\Users\willi\Documents\Projets\Axion-IA\axionia\`).
Cabinet IA opérationnel B2B, structuré en **Axion-IA OÜ estonienne**.
Tech : Next.js 16 + Prisma + Postgres + Redis + BullMQ + DocuSeal,
déployé via Coolify sur Hetzner CPX32 (`178.105.55.15`, domaine
`axion-ia.com` derrière Cloudflare).

### Pourquoi ce sprint existe

Le KB V4 livré 2026-05-14 (commits `7e067cb` → `09ed7ab` + merge `bd0f831`)
sait générer du contenu IA généraliste. **Il ne sait PAS vendre Axion-IA
automatiquement.** Chaque article généré devrait pointer vers une offre
concrète (audit / intervention / implémentation / maintenance) avec tarif
dynamique tiré du SSOT `pricing.ts`, sinon :

- Les contenus deviennent obsolètes à la 1ère modif tarif
- Aucun CTA contextuel = trafic SEO sans conversion
- Schema.org `Offer` manquant → AEO/GEO perd des opportunités
- Pas de variante par cible (dirigeant seul / employé / équipe / conférence)

**Cible business** : ranking #1 sur les requêtes longue traîne
« audit IA + secteur », « intervention IA + métier », « implémentation IA + ville »,
avec chaque page KB devenant une mini-landing page convertissante.

---

## OBJECTIF DU SPRINT

Transformer chaque entry KB en mini-landing page Axion-IA :

- Liée à au moins 1 offre concrète (audit / intervention / implémentation)
- Avec tarif live (dérivé de `pricing.ts` SSOT à chaque render)
- Avec CTA contextuel auto-injecté
- Avec schema.org `Service` + `Offer` pour AEO #1
- Avec axe de classification « cible » (dirigeant / employé / équipe / mixte / conférence)
- Avec garde-fou anti-obsolescence si tarifs changent

---

## SOURCES DE VÉRITÉ EXISTANTES (à NE PAS dupliquer)

| Élément                                    | Path                                                     | Statut                                   |
| ------------------------------------------ | -------------------------------------------------------- | ---------------------------------------- |
| **Tarifs SSOT**                            | `src/content/pricing.ts`                                 | ✅ Existe, ne PAS hardcoder ailleurs     |
| **Interventions SSOT**                     | `src/content/interventions-taxonomy.ts`                  | ✅ 4 familles × 14 formats               |
| **Audit SSOT**                             | dans `pricing.ts` (Express/Approfondie + paliers)        | ✅                                       |
| **Doctrine intervention/jamais formation** | `axionia-core` skill + banned-words KB                   | ✅ Gate runtime                          |
| **pSEO villes**                            | `INSEE_REGIONS` + 2157 villes                            | ✅ Auto-injection `areasServed`          |
| **Schema.org factories**                   | `src/lib/seo/factories/`                                 | ✅ Patterns Organization/Service/Article |
| **Knowledge V4**                           | `src/lib/knowledge/*` + `src/server/actions/knowledge/*` | ✅ Livré                                 |

**À LIRE en début de session (Phase 0.5 reality check)** :

1. `src/content/pricing.ts` — tous les services + tarifs + sub-tiers
2. `src/content/interventions-taxonomy.ts` — toutes les interventions
3. `_AUDIT/KNOWLEDGE-BASE-2026/SPRINT-13-20-V4-FINAL.md` — récap KB V4
4. `prisma/schema.prisma` — `KnowledgeEntry` + 28 KbType + relations
5. Mémoires `axionia_pricing_zero_hardcode_2026-05-08`, `axionia_pricing_centralization`, `axionia_interventions_taxonomy_refonte_2026-05-11`, `axionia_kb_v4_sprints_13-20_livres_2026-05-14`

---

## DELIVERABLES (5 étapes commits atomiques)

### Étape 1 — Schéma : axe « cible » + table binding service

**Migration Prisma** :

```sql
-- 1. Enum axe cible
CREATE TYPE "KbAudienceTarget" AS ENUM (
  'dirigeant_seul',
  'employe_seul',
  'equipe_collective',
  'mixte_dirigeant_equipe',
  'conference',
  'auto_individuel'
);
ALTER TABLE "knowledge_entries"
  ADD COLUMN "audience_target" "KbAudienceTarget";
CREATE INDEX "knowledge_entries_audience_target_idx"
  ON "knowledge_entries"("audience_target");

-- 2. Table binding service
CREATE TYPE "AxionServiceKind" AS ENUM (
  'audit',
  'intervention',
  'implementation',
  'maintenance'
);

CREATE TABLE "knowledge_service_bindings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entry_id" UUID NOT NULL,
    "service_kind" "AxionServiceKind" NOT NULL,
    "service_key" VARCHAR(80) NOT NULL,
    -- ex: 'audit_express', 'intervention_collective_demi_jour', 'implementation_ia_custom'
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "cta_label_fr" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_service_bindings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "knowledge_service_bindings_entry_id_idx"
  ON "knowledge_service_bindings"("entry_id");
CREATE INDEX "knowledge_service_bindings_kind_key_idx"
  ON "knowledge_service_bindings"("service_kind", "service_key");
CREATE UNIQUE INDEX "knowledge_service_bindings_one_primary_per_entry"
  ON "knowledge_service_bindings"("entry_id") WHERE "is_primary" = true;

ALTER TABLE "knowledge_service_bindings"
  ADD CONSTRAINT "knowledge_service_bindings_entry_id_fkey"
  FOREIGN KEY ("entry_id") REFERENCES "knowledge_entries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

**Update schema.prisma** : ajouter model `KnowledgeServiceBinding` + enum
`KbAudienceTarget` + `AxionServiceKind` + relation `serviceBindings` sur
`KnowledgeEntry`. **NE PAS toucher** aux 28 KbType existants.

**Commit message** : `feat(kb): kb-v4.1 step 1 — audience_target + service binding schema`

---

### Étape 2 — SSOT alignment : helpers `pricing.ts` ↔ KB binding

**Fichiers à créer** :

`src/lib/knowledge/service-binding.ts` :

- `getAxionServiceCatalog()` → lit `pricing.ts` + `interventions-taxonomy.ts`,
  retourne `Array<{ kind, key, label, priceFromCents, priceToCents,
durationLabel, format }>`
- `validateServiceKey(kind, key)` → vérifie que la key existe dans le SSOT
- `formatPriceRange(binding, locale)` → "à partir de 490 € HT" / "880-2140 € HT"
  selon paliers
- `getDefaultCtaForBinding(binding)` → "Réserver un audit Express" / "Voir
  interventions collectives" selon kind+key

`src/lib/knowledge/service-binding.test.ts` :

- Couvre TOUS les services existants (au moins 1 test par entrée dans
  `pricing.ts` et `interventions-taxonomy.ts`)
- Test validateServiceKey rejette key inconnue
- Test formatPriceRange gère paliers + tarif unique + min-max

**Commit message** : `feat(kb): kb-v4.1 step 2 — service binding helpers + ssot alignment`

---

### Étape 3 — Gate runtime ingest + audit log

**Update `src/server/actions/knowledge/ingest.ts`** :

- Nouveau paramètre `serviceBindings` dans `IngestPayload` :
  ```ts
  readonly serviceBindings?: ReadonlyArray<{
    serviceKind: 'audit' | 'intervention' | 'implementation' | 'maintenance';
    serviceKey: string;
    isPrimary: boolean;
    ctaLabelFr?: string;
  }>;
  ```
- **Gate 7 nouveau** : refuse entry si `serviceBindings` vide OU si aucun
  binding `isPrimary=true` (sauf si type=faq ou type=glossary_term → exempted)
- **Gate 8 nouveau** : valide chaque binding via `validateServiceKey()` →
  refuse si key inexistante dans SSOT
- Crée les bindings dans la transaction Prisma
- `appendAudit` payload enrichi avec bindings

**Update `src/app/api/internal/kb/ingest/route.ts`** :

- Schema Zod : `serviceBindings: z.array(...).optional()`

**Tests** :

- Refuse ingest sans serviceBindings (sauf faq/glossary)
- Refuse ingest avec key inexistante
- Accept ingest avec 1 primary binding

**Commit message** : `feat(kb): kb-v4.1 step 3 — ingest gate service binding obligatoire`

---

### Étape 4 — Render : tarif live + CTA injection + JSON-LD

**Fichier `src/lib/knowledge/render-with-bindings.ts`** :

- `injectServiceCTA(html, entry, bindings)` → ajoute à la fin du body
  un bloc `<aside class="kb-cta">` avec CTA primary + tarif live tiré
  de `pricing.ts` au moment du render (pas au moment de la génération)
- `buildOfferJsonLdForEntry(entry, bindings)` → schema.org `Offer` +
  `priceSpecification` + `areaServed` (si entry géo-taggée via KB-14 SEO cache)
- `buildServiceJsonLdForEntry(entry, bindings)` → schema.org `Service`
  rattaché au binding primary

**Wire dans pages publiques** :

- `src/app/[lang]/ressources/[type]/[slug]/page.tsx` :
  - Lit les bindings via Prisma
  - Appelle `injectServiceCTA` côté server avant render
  - Inclut `buildOfferJsonLdForEntry` + `buildServiceJsonLdForEntry` dans `<head>`

**Tests** :

- `render-with-bindings.test.ts` — couvre les 4 service kinds
- Snapshot test du JSON-LD généré (schema.org valide)

**Commit message** : `feat(kb): kb-v4.1 step 4 — render dynamic pricing + cta + jsonld service/offer`

---

### Étape 5 — Anti-obsolescence cron + admin UI léger

**Cron `scripts/kb-pricing-obsolescence-check.ts`** :

- Compare `git log --format=%cI -1 src/content/pricing.ts` (dernier commit
  modifiant pricing.ts) avec `KnowledgeEntry.publishedAt`
- Pour chaque entry publié AVANT le dernier `pricing.ts` commit + lié à un
  service via binding → marquer `KnowledgeAnnotation` kind=`seo_suggestion`
  status=`open` avec body « Tarif source modifié — vérifier cohérence »
- Idempotent (skip si annotation existante)
- Wire dans Coolify scheduled task (hebdomadaire dimanche 04:00 UTC)

**Admin UI léger** `src/app/[lang]/[adminPrefix]/connaissances/[id]/bindings/page.tsx` :

- Liste les bindings actuels
- Form pour ajouter/supprimer binding (server actions `addServiceBinding`,
  `removeServiceBinding`, `setPrimaryBinding`)
- Preview du CTA rendu (iframe local)

**Tests** :

- Cron : test idempotence + détection correcte
- Server actions : test addBinding (succès + duplicate rejected)

**Commit message** : `feat(kb): kb-v4.1 step 5 — anti-obsolescence cron + admin bindings ui`

---

## CRITÈRES DE SUCCÈS

- [ ] Migration `audience_target` + `knowledge_service_bindings` appliquée prod
- [ ] Ingest API refuse 422 si pas de binding primary (hors faq/glossary)
- [ ] Page publique `/ressources/[type]/[slug]` affiche CTA dynamique avec tarif live
- [ ] JSON-LD `Offer` + `Service` dans `<head>` (validé via Schema.org validator)
- [ ] Au moins 5 entries existantes back-fillées avec bindings (migration data)
- [ ] Cron anti-obsolescence enabled + 1ère run dry-run loggée
- [ ] Admin UI `/connaissances/[id]/bindings` fonctionnelle
- [ ] Tests verts : ≥ 30 nouveaux tests passent (binding + render + cron)
- [ ] Typecheck + lints OK
- [ ] Documentation `_AUDIT/KNOWLEDGE-BASE-2026/SPRINT-V4-1-SERVICE-BINDING-FINAL.md`

---

## CONTRAINTES NON-NÉGOCIABLES

### Doctrine code

- **Anti-hex hardcoded** : tokens Tailwind uniquement (`var(--color-terracotta)`)
- **Anti-siren** : aucune mention SIREN/SIRET/RCS — Axion-IA OÜ estonienne.
  Note : `pricing.ts` SSOT déjà conforme.
- **Banned word formation** : déjà gate runtime KB. Le sprint NE doit PAS
  introduire de mention « formation » dans les templates ou helpers.
- **« intervention » jamais « training »/« formation »** : appliqué partout.
- **TS strict** + `exactOptionalPropertyTypes` activé
- **`"use server"`** : zéro export non-async
- **NE PAS hardcoder de tarif** : toujours dériver via helpers `pricing.ts`

### Process git

- Commits atomiques par étape (5 commits, 1 par deliverable)
- Conventional commits subject lowercase
- Pre-commit + pre-push hooks doivent passer
- **Une session parallèle peut tourner sur main** (Booking V1) → check
  `git fetch && git log --oneline origin/main..HEAD` avant chaque commit

### Workflow

- **STOP & ASK uniquement pour** :
  - Décision business : « entries faq doivent-elles avoir un binding optionnel ?
    (proposition : oui via tag, mais pas bloquant) »
  - Conflit SSOT : si `pricing.ts` a une key qui ne mappe sur aucun KbType
  - Échec deploy après step 3 (gate runtime déployé) → impact prod

### Données existantes

- Backfill des entries déjà publiées : **PAS migration auto sans review**.
  Étape 5 propose un script `scripts/kb-backfill-service-bindings.ts --dry-run`
  qui suggère bindings basés sur le `type` de l'entry, mais Will doit valider
  avant `--commit`.

---

## INFRA PROVISIONNÉE

Voir `_AUDIT/KNOWLEDGE-BASE-2026/SPRINT-13-20-V4-FINAL.md` pour infra Coolify

- tokens API `.secrets/api-tokens.env`.

App UUID : `mqbmlz1bcwsdwi3t9fxsllqt`.

---

## COMMANDE DE DÉMARRAGE (autopilot)

```bash
# 1. Vérifie état repo + main propre
cd /c/Users/willi/Documents/Projets/Axion-IA/axionia
git fetch --all && git status -sb
git log --oneline main -5

# 2. Reality check Phase 0.5
cat src/content/pricing.ts | head -200
cat src/content/interventions-taxonomy.ts | head -100
cat _AUDIT/KNOWLEDGE-BASE-2026/SPRINT-13-20-V4-FINAL.md | head -150

# 3. Vérifie schéma actuel
pnpm prisma migrate status

# 4. Annonce le plan à Will :
# "Sprint KB V4.1 Service Binding démarré. 5 étapes commits atomiques :
#  1. Schéma audience_target + binding table (~3h)
#  2. Helpers SSOT pricing↔KB (~3h)
#  3. Gate runtime ingest obligatoire (~4h)
#  4. Render dynamic + JSON-LD (~6h)
#  5. Anti-obsolescence cron + admin UI bindings (~6h)
#
#  Total ~22h dev, je commit après chaque étape (5 commits sur main).
#  J'attaque étape 1 immédiatement."

# 5. Attaque étape 1 (schéma) sans attendre OUI
```

---

## STYLE COMMUNICATION

Identique à la session Booking V1 :

- Phrases courtes, listes claires
- Récap après chaque étape (3 lignes max)
- STOP & ASK uniquement pour décisions business
- Will dit « OUI » ou « FAIS SELON ta recommandation » → continuer autopilot
