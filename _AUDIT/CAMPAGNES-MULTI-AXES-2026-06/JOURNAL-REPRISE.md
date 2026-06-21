# Journal de reprise — Campagnes multi-axes content-gen

> But : système de génération de contenu où **UNE seule campagne** fixe TOUS les
> pourcentages ensemble et le système croise les axes pour calculer quoi générer.
> Sauvegardé au fil de l'eau pour reprise si Claude Code se ferme inopinément.
> Branche de travail : **`feat/console-ameliorations`** (NE PAS pousser sans accord Will).
> Dernière mise à jour : 2026-06-21.

## Les 8 axes confirmés par Will

Une campagne = on règle tout ça ensemble, le système croise :

1. **% type de contenu** (`contentTypeWeights` — déjà en DB, exposé wizard)
2. **% activité Axion-IA** = `serviceSector` (formation / audit / 1-to-1 / implementation / sites-web). 5 activités. _Aujourd'hui une seule par campagne — à passer en pondéré._
3. **% secteur client** = `targetSecteur` (santé / BTP / juridique…). **N'existe PAS encore en colonne.** À ajouter.
4. **% intention de recherche** (`searchIntentMix` — existe en DB, PAS exposé au wizard). Couvre l'axe « résoudre un problème ».
5. **% audience** (`audienceMix` — existe, hardcodé `{default:100}`). TPE/PME/ETI × type d'organisation.
6. **Ville + alentours** = rayon **50 km** (ou même département). Via `geo.ts getNearbyVilles`. Champ `villeSurroundingMode` à ajouter.
7. **Nombre de contenus / jour** (`dailyArticles` — existe).
8. **Durée OU illimité-jusqu'à-arrêt-manuel** (`endDate` existe ; `durationMode` à ajouter).

### « Résoudre un problème » = 3 leviers déjà en place
- content type `pain_point_solution`
- search intent `commercial_investigation`
- pain-matrix secteur (`SectorPainContext`, 25/50 combos remplis)

## Distinction CRITIQUE à préserver
- `serviceSector` = les 5 **activités Axion-IA** (`interventions_formations / audits / implementations / un_a_un / sites_web_augmentes`)
- `targetSecteur` = le **secteur du client** (santé/BTP/juridique…). PAS encore une colonne.
- Les deux doivent rester distincts. Ne jamais les confondre.

---

## ✅ FAIT — Phase 0a : neutraliser la landmine `landing_ville`

`landing_ville` est **CLI-only** (hors `REGISTRY` de `generators/index.ts`, par choix
coût/cadence). Le proposer dans le wizard / l'ad-hoc / les templates créait des jobs
voués à `No generator registered`. Corrigé sur **toutes les surfaces de dispatch** :

| Fichier | Changement |
|---|---|
| `src/server/content-gen/generators/index.ts` | + `REGISTERED_CONTENT_TYPES` (Set) + `isContentTypeRegistered()` |
| `src/server/queue/workers/content-orchestrator-worker.ts` | + helper `registeredTypeDist()` qui **filtre** les types non enregistrés des poids de campagne (protège campagnes existantes + types futurs) + log des types droppés ; appliqué aux 2 constructions `typeDist` (séquentiel + parallèle) |
| `src/server/actions/content-gen/campaign-wizard-constants.ts` | `landing_ville` retiré de `WIZARD_CONTENT_TYPES` (21→20) + section `core` |
| `.../campaigns/new/_v2/CampaignWizardV2.tsx` | retiré de `DEFAULT_WEIGHTS_BALANCED` (10% redistribués → blog_article 18 / guide_pilier 12) ; preset `pages_villes` → **`contenu_local`** (pain_point_solution 40 / case_study_local 30 / faq_geo 30) |
| `.../campaigns/new/_v2/preset-data.ts` | preset `pme-audits` landing_ville→case_study_local ; `cities-paris` → **`contenu-local-villes`** (pain/cas/faq_geo) |
| `.../campaigns/new/_v2/preset-mapping.ts` | commentaire corrigé (landing_ville → null, filtré) |
| `.../orchestrator/adhoc/_v2/AdHocDispatchV2.tsx` | retiré de la liste + défaut `blog_article` (avant : défaut landing_ville = job échoué d'office) |
| `src/server/actions/content-gen/adhoc.ts` | retiré du Zod `CONTENT_TYPE_VALUES` |
| `src/server/actions/content-gen/enqueue.ts` | retiré du Zod `ContentTypeSchema` |
| `src/components/admin/content-gen/TemplateForm.tsx` | retiré de la liste + défaut `blog_article` |
| `registry-phase8.spec.ts` | tests mis à jour 21→20, core sans landing_ville |

**Laissé volontairement** : générateurs `landing-ville-*.ts` (CLI), maps d'affichage
`constants.ts` (`CONTENT_TYPE_LABELS_FR/PIPELINE_FR` — pour afficher les jobs legacy),
script `delete-landing-ville-articles.ts`, `editorial-mix-rules.ts`.

**Vérifs** : `pnpm typecheck` ✅ · vitest (registry 20/20, orchestrator seq+per-campaign,
type-diversity, coverage-controls) ✅ · eslint des 11 fichiers ✅.

**Reste sur Phase 0a** : commit sur `feat/console-ameliorations` (subject minuscule
pour commitlint). PAS encore commité au moment de ce snapshot.

---

## ✅ FAIT — Phase 0a résidus (audit E2E) — commit `ea397675`

Audit adversarial E2E de la phase 0a (3 agents) → 2 fuites résiduelles fermées :
- `templates.ts` : `landing_ville` retiré du Zod (template sinon intestable).
- `jobs.ts` : garde-fou `enqueueGenJob` (retry) ne re-enqueue plus un job
  `landing_ville` legacy (le filtre liste reste = lecture seule légitime).
Reste vérifié SAIN : orchestrateur (registeredTypeDist 2 chemins), adhoc/enqueue
Zod, worker (échec gracieux), CLI scripts (bypass REGISTRY assumé).

## ✅ FAIT — Phase 0b SSOT secteurs — commit `ea397675`

`src/content/sectors.ts` = SSOT des **10 secteurs client** (alignés 1:1 sur la
pain-matrix = seuls secteurs produisant du contenu différencié) + mappings
BlogSector/KB + helpers. Pur, client-safe. Test drift-guard `sectors.spec.ts` (5).
(Choix 10 et non ~20 : secteur sans entrée pain-matrix = injection no-op ;
étendre = remplir la pain-matrix en Phase 2.)

## ✅ FAIT — Phase 1 (les 8 axes) — `e114a6d8` (backend) + `0560b7d1` (UI)

**Schema** additif, migration `20260621120000`, rétro-compat totale — CoverageCampaign :
`serviceSectorWeights` (axe 2), `targetSecteurWeights` (axe 3), `villeSurroundingMode`
+ `villeSurroundingRadiusKm` (axe 6), `durationMode` (axe 8) + enums
`VilleSurroundingMode`/`DurationMode`. ⚠️ Migration **NON appliquée DB** (Will :
`prisma migrate deploy` au déploiement).

**Orchestrateur** : `sampleServiceSector`/`sampleTargetSecteur` par slot (seeds
91/53) → pose `inputPayload.vertical`+`targetSecteur` (réveille pain-matrix) ;
`expandVilleAnchors` étend les villes EXPLICITES au rayon 50 km / département (file
globale NON étendue) ; `durationMode=unlimited` jamais complété par compteur ;
worker `campaignSector` préfère `inputPayload.vertical`.

**Server action** `campaign-wizard.ts` : Zod + persistance des 8 axes (proportions ;
audienceMix « SIZE:ORG »). Vocabulaires dans `campaign-wizard-constants.ts`.

**UI** `CampaignWizardV2.tsx` : `WeightEditor` réutilisable ; étape 2 ville &
alentours + bloc repliable « Ciblage avancé multi-axes » (% activité/secteur/audience) ;
étape 3 durée fixe/illimitée + % intention ; étape 4 récap. Tout optionnel.

**Tests** : `orchestrator-multi-axes.test.ts` (8) + `sectors.spec.ts` (5) + registry (20).

⚠️ **NON poussé / NON déployé.** Reste Will : pousser branche → PR → main ; au
deploy `prisma migrate deploy` applique la migration ; **redéployer le worker**
(app Coolify séparée) pour activer le sampling ; `QUALITY_PROFILES_ENABLED=true`
requis pour que l'axe 3 (pain-matrix) agisse réellement.

## ✅ FAIT — Audit E2E + Phase 2 (2026-06-21)

**Audit E2E exhaustif** (6 agents : intégrité multi-axes, pipeline content-gen, SEO/AEO,
hiérarchie titres, Web Vitals, console admin) + vérifs croisées perso. **1 seule vraie
régression** trouvée et corrigée (`bdda99ed`) :
- **C1** — `WIZARD_ORG_TYPES` envoyait 2 valeurs hors enum `OrganisationType`
  (`profession_liberale`, `collectivite_territoriale`) → insert job en échec silencieux.
  Corrigé + Zod durci (clé audienceMix « SIZE:ORG » validée contre les 2 enums) +
  test anti-dérive `campaign-wizard-constants.spec.ts` (tous vocabulaires ⊆ enums Prisma).
- Enhancement : détail campagne affiche les axes multi-axes.
- **Réfuté/par-design** (pas de bug) : tier indexation (publish tier_1 = décision Will
  documentée ; détail dérive bien tier-1 via `mapIndexationTier`) ; alignement pain-matrix.
- Findings pré-existants notés pour Will (hors périmètre) : SEO Review/AggregateRating
  inutilisé, blog sans speakable/data-answer, galerie `<h1>` orphelin, `/reserver` CLS,
  CF cache BYPASS home, size-limit pas en CI. Score SEO global 87/100.

**Phase 2 — Qualité** :
- ✅ **pain-matrix 50/50** (`b5d68513`) — 27 combos manquants ajoutés (gold-standard,
  lexique métier authentique, déontologie santé/juridique/public), garde-test couverture.
- ✅ **corpus anti-plagiat 50→200** (`6afd9f5b`) — + tunable `policies.plagiarismCorpusSize`.
- ⏳ `benefit_gate` = flag console **= décision Will** (page admin PH4) — laissé OFF.

## ⏳ À FAIRE

### Phase 3 (plus tard) — SEO v2
Pilier `/secteurs/*` + 50 pages croisées (curées).

### Nettoyage
Supprimer les 3 campagnes de TEST qualité (Grenoble).

---

## Contraintes opérationnelles (à NE PAS oublier)
- Push `main` = deploy prod → **confirmation explicite de Will requise à chaque push**.
- Tout le travail sur `feat/console-ameliorations`. **Jamais `git add .`** — chemins explicites.
- Creds GSC/Coolify dans `.secrets/api-tokens.env` — **ne jamais imprimer les valeurs**.
- Coolify : changement d'env = **REDEPLOY** (pas restart). Worker = app Coolify séparée (`COOLIFY_WORKER_UUID`).
- Arbre de travail **partagé entre sessions** → toujours `git fetch` + vérifier avant d'agir.
- Commits finissent par `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` ; subject minuscule (commitlint).
- tsc OOM connu → `NODE_OPTIONS=--max-old-space-size=8192`.

## Contexte technique utile
- GSC OAuth creds **posés sur Coolify via API** (élagage P4 activé). VOYAGE_API_KEY SET (507 embeddings réels, RAG sémantique actif). kb_fts appliqué.
- Auto-publish : score ≥ 65 (DB `quality_loop.minScoreThreshold`).
- Pipeline : CoverageCampaign → scheduler-worker (*/5) → orchestrator-worker (*/15) → ContentGenJob → content-gen-worker → quality-improver → publish-worker → Article.
