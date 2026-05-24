# CROSS-CUTTING — Problèmes Transverses P5
## Date : 2026-05-21
## Auditeur : Claude Sonnet 4.6 (AUDIT-ONLY)

---

## XC-1 : Cohérence design system

### Couleurs brand
- **Fond ivoire `#faf8f3`** : utilisé via `--color-admin-bg` ? La variable CSS `--color-admin-surface` est utilisée dans les composants AdminCard mais le fond général n'est pas explicitement ivoire dans les vues inspectées.
- **Terracotta `#c24a1b`** : le CTA "Nouvelle campagne" utilise `admin-button` (bleu `#1a4dd9`) et non terracotta. Violation confirmée par A5-08 (C2 : couleur bleue au lieu de terracotta).
- **Bleu `#1a4dd9`** : utilisé sur les CTAs principaux — inversion de hiérarchie par rapport à la doctrine couleurs.

### Composants admin V2
- `AdminPageShell`, `AdminPageHeader`, `AdminCard`, `AdminStatCard`, `AdminBadge` utilisés **uniformément** dans toutes les pages content-gen inspectées. ✅
- `AdminBulkActions` existe dans `src/components/admin/` mais **non utilisé dans aucune page content-gen** (A5-08 C3).

### Variables CSS admin-v2
- Pattern `var(--space-admin-*)`, `var(--text-admin-*)`, `var(--color-admin-*)` : **utilisés uniformément** dans tous les composants V2 inspectés. ✅
- Aucune valeur hex hardcodée détectée dans les composants (hors quelques classes Tailwind standards).

**Verdict XC-1** : 🟡 PARTIEL — design system cohérent sauf violation terracotta/bleu sur CTAs principaux.

---

## XC-2 : Performance admin

### Temps de chargement estimé
- Toutes les pages content-gen sont des **Server Components purs** avec `force-dynamic`. Aucun bundle client significatif. ✅
- `ContentGenDashboardV2` : 2 appels Prisma en parallèle (`getDashboardKpis` + `getSectorBreakdownToday`). Pas de N+1 détectable.
- `QualityV2` : 1 requête `article.findMany` avec SELECT limité sur 30j. Potentiellement lent si > 10K articles publiés sur 30j (pas d'index composite `(status, publishedAt)` visible clairement).

### Pagination
- **`CoverageListV2`** : ABSENT de pagination — liste toutes les campagnes en mémoire.
- **`JobsListV2`** (A5-05) : pagination implicite via `take: 50` environ.
- **`CityCoverageV2`** : 39 villes, pas de pagination — acceptable pour l'instant, devient problème à 120 villes.

### Requêtes potentiellement lentes
- `getCityCoverage()` : lit les fichiers TypeScript compilés du dossier `economic-data/` — non DB, très rapide.
- Aucun N+1 détecté dans les fichiers inspectés (usage de `include`/`select` correct).

**Verdict XC-2** : 🟡 PARTIEL — performance acceptable à volume actuel (<50 campagnes, <1K jobs), pagination à implémenter avant 200+ campagnes.

---

## XC-3 : Sécurité admin

### Authentification routes admin
- Toutes les routes `page.tsx` inspectées vérifient `const session = await auth(); if (!session?.user) redirect(...)`. ✅
- Pattern cohérent dans les 20+ pages inspectées.

### Vérification rôle admin
- Le check se limite à `session?.user` (utilisateur authentifié). Aucune vérification de rôle `admin` explicite détectée dans les pages content-gen.
- ⚠️ Si un user non-admin peut s'authentifier, il peut accéder aux routes admin.

### Exposition tokens/clés API dans logs UI
- `CostsV2` affiche les clés `provider` mais pas les clés API elles-mêmes. ✅
- `ContentGenAuditLog` loggue `actorIp` hashée si `IP_HASH_SALT` actif. ✅
- Aucune fuite de token API dans les composants UI inspectés.

**Verdict XC-3** : 🟡 PARTIEL — authentification présente, vérification de rôle à renforcer.

---

## XC-4 : Cohérence données

### Source de vérité compteurs
- Les compteurs `generatedCount`/`publishedCount`/`failedCount` sur `CoverageCampaign` sont mis à jour par les workers et lus directement depuis DB. ✅
- Le dashboard KPIs (`getDashboardKpis`) fait ses propres requêtes agrégées — potentiel drift si les workers ne mettent pas à jour `CoverageCampaign` à chaque job.

### États articles
- `PublishStatus` enum Prisma : `draft`, `published`, etc. ✅
- `ContentGenJobStatus` enum : `queued`, `running`, `completed`, `failed`, etc. ✅
- **ABSENT** : enum `REJECTED`/`REDUNDANT` explicite sur Article — les articles rejetés restent en `draft` avec `indexationTier = tier_3_noindex_nofollow` (convention interne non formalisée en enum).

### Synchronisation BullMQ / DB
- `content-orchestrator-worker.ts` et `content-publish-worker.ts` mettent à jour le statut DB à chaque étape. ✅
- En cas de crash worker, les jobs `active` en BullMQ peuvent diverger de l'état DB — pas de mécanisme de réconciliation visible.

**Verdict XC-4** : 🟡 PARTIEL — états bien définis mais enum rejet/redondant absent, réconciliation BullMQ/DB non documentée.

---

## XC-5 : Accessibilité WCAG

### Aria-labels
- `AdminStatCard` : les `<Link>` wrappers ont `href` mais les cartes sont des blocs cliquables entiers — absence d'`aria-label` sur certains wrappers.
- Les formulaires ont des `<label htmlFor>` cohérents sur tous les `<input>` inspectés. ✅
- Les `<button>` type="submit" ont un `<strong>` texte lisible. ✅

### Contrast ratio
- Les badges `AdminBadge` utilisent les tons CSS admin (success/warning/destructive) — les valeurs hexadécimales exactes des variables ne sont pas inspectées dans cet audit, mais le pattern est standard.
- Les `ScoreBar` dans QualityV2 utilisent `bg-[color:var(--color-admin-info)]` sans label texte sur la barre elle-même — **les barres ne sont pas accessibles aux lecteurs d'écran**.

### Focus visible
- Tailwind CSS par défaut inclut `focus:outline-none focus:ring-*` — à vérifier si appliqué sur les `admin-button` et `admin-link`. Non confirmé sans inspection CSS compilée.

**Verdict XC-5** : 🟠 INSUFFISANT — ScoreBars non accessibles SR, aria-labels partiels, focus visible non confirmé.

---

## Problèmes transverses structurels

### PT-1 : Disjonction concept "Template" (CRITIQUE)
Le terme "template" est utilisé pour deux concepts distincts :
- `ContentTemplate` = template de prompt LLM par type de contenu (ce qui existe en DB)
- `CampaignTemplate` = preset de configuration de campagne (absent, attendu par Will)

Cette confusion est source de malentendu dans toute la console admin et dans les specs. **Le Sprint Corrections P5 doit créer `CampaignTemplate` comme un modèle distinct** en DB.

### PT-2 : MAX_PUBLISH_PER_DAY non exposé comme UI première ligne
Le cap journalier est le paramètre le plus stratégique de tout le système (rampe 30→500/j) mais il est :
- Configurable via env var Coolify (opération DevOps, pas UI admin)
- Configurable via `BatchesV2` par type via `dailyTargetByType` (sum = cap effectif)
Aucun champ unique "cap global jour" visible sur le dashboard ou dans une page dédiée.

### PT-3 : Aucune vue "vue d'ensemble opérationnelle" temps réel
Le dashboard rafraîchit uniquement au reload. Pour un opérateur qui surveille une campagne en production :
- Il faut F5 pour voir les nouvelles valeurs
- Aucun badge alerte dans le header/sidebar
- Aucun toast/notification si anomalie détectée

### PT-4 : Pas de guidage 0-to-campaign
La page dashboard redirige vers `/coverage/new` qui est un formulaire JSON brut. Un nouvel utilisateur sans documentation ne peut pas créer une campagne en < 30 min (JSON `typeDistribution` à saisir manuellement).

---

## Résumé évaluation XC

| Thème | Statut | Priorité correction |
|-------|--------|---------------------|
| XC-1 Couleurs brand | 🟡 PARTIEL | P1 — CTA terracotta |
| XC-2 Performance | 🟡 PARTIEL | P2 — pagination CoverageList |
| XC-3 Sécurité | 🟡 PARTIEL | P1 — vérification rôle admin |
| XC-4 Cohérence données | 🟡 PARTIEL | P2 — enum rejet formalisé |
| XC-5 Accessibilité | 🟠 INSUFFISANT | P2 — ScoreBars SR |
| PT-1 Disjonction Template | 🔴 CRITIQUE | P0 — créer CampaignTemplate |
| PT-2 MAX_PUBLISH_PER_DAY | 🔴 CRITIQUE | P0 — UI dédiée dashboard |
| PT-3 Temps réel absent | 🟠 IMPORTANT | P1 — polling ou badge alerte |
| PT-4 Onboarding 0-to-campaign | 🟠 IMPORTANT | P1 — presets + wizard |
