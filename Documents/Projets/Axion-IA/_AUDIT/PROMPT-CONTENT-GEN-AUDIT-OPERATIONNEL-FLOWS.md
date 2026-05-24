# 🎬 PROMPT AUDIT OPÉRATIONNEL — Flows + Scénarios end-to-end Content Generator

> Audit **complémentaire** à `_AUDIT/PROMPT-CONTENT-GEN-AUDIT-FINAL-PRODUCTION-READY.md`.
>
> Le premier audit vérifie « le système est-il codé/raccordé/cohérent ? ».
>
> Celui-ci vérifie « **toutes les actions utilisateur fonctionnent-elles vraiment de A à Z ?** » :
>
> - Génération (8 scénarios)
> - Publication (6 scénarios)
> - Modification (7 scénarios)
> - Dépublication / archive / suppression (8 scénarios)
> - Restauration / retry / rollback (5 scénarios)
> - Erreurs + recovery (10 scénarios)
>
> Pour chaque scénario : tracer **frontend → Server Action → DB → Worker → DB → UI feedback**.
> Identifier toute rupture, action manquante, état orphelin, regret UX.

---

```
Skill : axionia-content-generator (mode 🔒 AUDIT OPÉRATIONNEL FLOWS)

Tu es l'auditeur opérationnel du content generator Axion-IA. Le premier
audit (PROD-READY) a validé la structure code. Ton job : vérifier que
TOUTES les actions opérationnelles que Will fait depuis l'admin (générer,
publier, modifier, dépublier, restaurer, gérer les erreurs) marchent
RÉELLEMENT de bout en bout — frontend ET backend câblés sans rupture.

⛔ MODE AUDIT-ONLY STRICT — RÈGLES ABSOLUES :
- Tu N'ÉCRIS aucun code (Edit/Write INTERDITS sur code source)
- Tu NE COMMITES rien, NE PUSHES rien
- Tu NE FAIS aucun appel API IA externe
- Tu N'EXÉCUTES aucun migrate / seed / restart
- Tu LIS le code statiquement + Bash read-only (grep, find, git log)
- Si bug détecté → NOTER dans rapport, NE PAS fix
- Si Will dit « petit fix tant qu'on y est » → REFUSER, noter
- Seul livrable : 1 fichier `_AUDIT/CONTENT-GEN-AUDIT-OPERATIONNEL-FLOWS-2026-XX-XX.md`

╔═══════════════════════════════════════════════════════════════════════╗
║                  LECTURE OBLIGATOIRE                                  ║
╚═══════════════════════════════════════════════════════════════════════╝

1. .claude/skills/axionia-content-generator/SKILL.md
2. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md — particulièrement :
   • § 14 publication + validation workflow
   • § 25 campagnes de couverture
   • § 27 boucle qualité
   • § 28 pipeline RSS
   • § 29 Q/R post-process
   • § 13 queues + workers + scheduling
   • § 12 console admin (12 sections)
3. _AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md
4. _AUDIT/CONTENT-GEN-V1-AUDIT-COMPLET-2026-05-14.md
5. docs/adr/0021-content-gen-v1-skeleton-vs-deep-impl.md
6. _AUDIT/CONTENT-GEN-AUDIT-FINAL-PROD-READY-2026-XX-XX.md (le premier
   audit si déjà livré)
7. prisma/schema.prisma (Article + ContentGenJob + ReviewQueue states)

╔═══════════════════════════════════════════════════════════════════════╗
║                  PHASE 0 — Setup audit                                ║
╚═══════════════════════════════════════════════════════════════════════╝

```bash
git status
git log --oneline -20
git rev-parse HEAD
git tag -l "v*-content-gen" | sort -V
```

Note branche / commit / tag audités.

╔═══════════════════════════════════════════════════════════════════════╗
║      PHASE 1 — État machine ContentGenJob + Article + ReviewQueue     ║
╚═══════════════════════════════════════════════════════════════════════╝

🎯 OBJECTIF : cartographier TOUS les états possibles + TOUTES les
transitions valides + identifier les états orphelins (jamais quittés) ou
transitions impossibles (pas de code qui flip A→B).

────────────────────────────────────────────────────────────────────────
1.1 — États ContentGenJob (12 statuts ContentGenJobStatus)
────────────────────────────────────────────────────────────────────────

États : queued, running, generating_text, generating_image, running_qa,
quality_improving, needs_review, approved, publishing, published, failed,
cancelled.

Pour CHAQUE statut :
- [ ] Code qui transitionne VERS ce statut ? (qui flip status = X)
      → grep `status:\s*["']${status}["']` dans `src/server/`
- [ ] Code qui transitionne DEPUIS ce statut ? (qui lit status = X et le change)
- [ ] UI qui affiche ce statut quelque part (filtres, badges) ?
- [ ] État final ou transitoire ?
- [ ] Si transitoire : worker qui pick + reflète vers état suivant ?
- [ ] Si état orphelin (aucune transition sortante) : justifié ou bug ?

→ SORTIE : matrice 12 statuts × 4 critères (transition entrante / sortante
/ UI affiché / final ou bug).

→ Diagramme texte des transitions valides :
```
queued → running → generating_text → generating_image →
running_qa → quality_improving (loop) → needs_review →
{approved → publishing → published, rejected → cancelled, failed}
```
Comparer ce diagramme aux transitions effectivement implémentées.

────────────────────────────────────────────────────────────────────────
1.2 — États Article (PublishStatus + IndexationTier)
────────────────────────────────────────────────────────────────────────

PublishStatus : draft, published, archived.
IndexationTier : tier_1_indexable, tier_2_noindex_follow,
tier_3_noindex_nofollow.

Pour CHAQUE combinaison statut × tier :
- [ ] Combinaison atteignable depuis le code ?
- [ ] Affichage admin reflète correctement (badge, filtre) ?
- [ ] Comportement SEO côté public cohérent (robots meta + sitemap include) ?

→ SORTIE : matrice 3×3 = 9 combinaisons × comportements attendus.

────────────────────────────────────────────────────────────────────────
1.3 — États ReviewQueue (5 statuts ReviewStatus)
────────────────────────────────────────────────────────────────────────

États : pending, approved, rejected, needs_edits, promoted_t1.

Pour CHAQUE statut :
- [ ] Transition entrante (qui flip vers ce statut) ?
- [ ] Transition sortante ?
- [ ] UI admin /review-queue filtre exposé ?
- [ ] needs_edits a-t-il un workflow ré-édition (ou seulement
      placeholder V2) ?

────────────────────────────────────────────────────────────────────────
1.4 — États CoverageCampaign (7 statuts)
────────────────────────────────────────────────────────────────────────

États : draft, queued, running, paused, completed, failed, cancelled.

Pour CHAQUE statut :
- [ ] Code qui transitionne vers ?
- [ ] Code qui transitionne depuis ?
- [ ] Boutons UI admin pour chaque action (launch / pause / resume /
      cancel) présents ?
- [ ] Le statut `queued` est-il utilisé ou orphelin ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 2 — 8 SCÉNARIOS de GÉNÉRATION (frontend → output)         ║
╚═══════════════════════════════════════════════════════════════════════╝

Pour CHAQUE scénario : tracer ligne par ligne **où se déclenche l'action
côté admin / cron / event**, **quelle Server Action est appelée**,
**comment le ContentGenJob est créé**, **quel worker pick**, **quel
generator est utilisé**, **quel output est produit**, **où il atterrit**.

────────────────────────────────────────────────────────────────────────
SCÉNARIO G1 — Génération unitaire manuelle depuis dashboard admin
────────────────────────────────────────────────────────────────────────

Specs § 12.2 : « [Générer landing ville…] [Générer article…] [Générer
comparatif…] [Générer guide pilier…] [Générer FAQ standalone…] »
boutons quick actions.

Trace :
1. Will dashboard `/content-gen` → clique "Générer landing ville…"
2. → Modal s'ouvre : ville select + variant override + langue + advanced
3. → Submit → Server Action `?` (laquelle ?)
4. → Insert ContentGenJob.queued + enqueue queue 'content-gen'
5. → content-gen-worker pick
6. → ... (suite jusqu'à needs_review)
7. → Toast / redirect / feedback Will

Vérifier :
- [ ] Bouton "Générer X" PRÉSENT dans dashboard ? (grep dans page.tsx)
- [ ] Modal de saisie présent ?
- [ ] Server Action existe + fait insert + enqueue ?
- [ ] Feedback post-submit (redirect /jobs/[id] ? toast ?)

⚠️ Si bouton manquant → noter comme P0 (le master prompt § 12.2 prévoit
explicitement ces quick actions dashboard).

────────────────────────────────────────────────────────────────────────
SCÉNARIO G2 — Génération depuis template admin
────────────────────────────────────────────────────────────────────────

Trace :
1. Will → `/templates/[id]` → ouvre template
2. → Bouton "Tester avec ce template" ? "Générer 1 exemple" ?
3. → Server Action → insert ContentGenJob avec templateId

Vérifier :
- [ ] Bouton "Tester" présent sur la page template detail ?
- [ ] Lien existant vers form génération pre-rempli avec template ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO G3 — Génération depuis campagne couverture (massif)
────────────────────────────────────────────────────────────────────────

Trace :
1. Will → `/coverage/new` → form complet
2. → createCampaign() + launchCampaign(id)
3. → CoverageCampaign.running
4. → Cron 15min content-orchestrator-worker tick
5. → Sample distribution → N ContentGenJob.queued
6. → Enqueue queue 'content-gen'
7. → ... (génération + review + publish)
8. → UI /coverage/[id] suit burndown en temps réel

Vérifier :
- [ ] Tous les champs CoverageCampaign correctement passés à
      l'orchestrateur ?
- [ ] Le repartition `dailyBatchSize / runningCampaigns.length` est
      sain (pas de division par 0) ?
- [ ] Idempotency key empêche double-création si tick re-trigger ?
- [ ] generatedCount incrémenté + flip status="completed" quand atteint
      totalTargetCount ?
- [ ] UI /coverage/[id] affiche progression temps réel
      (avec révalidate régulière OU SSE) ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO G4 — Génération depuis source RSS
────────────────────────────────────────────────────────────────────────

Trace :
1. Will → `/rss/new` → addRssSource()
2. → ContentGenConfig.rss_sources ou table RssSource (V2)
3. → Cron hourly content-rss-fetch-worker
4. → Fetch + parse + dedup → N items nouveaux
5. → Enqueue 'content-gen' contentType=blog_from_rss
6. → blog-from-rss generator → NewsArticle output
7. → ReviewQueue.pending OU auto-publish si autoPublish source ET
      score ≥ rssAutoPublishMinScore

Vérifier :
- [ ] Worker rss-fetch cron BOOT dans bootRepeatableJobs() ?
- [ ] enqueueContentGen passé avec contentType=blog_from_rss ?
- [ ] Auto-publish check `policies.rssAutoPublishMinScore` lu côté
      review-queue insert ?
- [ ] Si auto-publish → ReviewQueue.approved directement + enqueue
      'content-publish' ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO G5 — Génération Q/R post-process automatique
────────────────────────────────────────────────────────────────────────

Trace :
1. Article landing_ville published avec FAQ 8 items
2. → Hook post-publish déclenche content-qa-extract-worker
3. → Worker extrait chaque Q/R → insert FAQ row + ArticleTranslation FR
4. → Crée page `/fr/faq/[slug]` indexable
5. → JSON-LD QAPage émis

Vérifier :
- [ ] Hook post-publish enqueue 'content-qa-extract' ?
- [ ] Worker qa-extract présent ?
- [ ] Toggle `policies.qaAutoCreatePages` respecté (skip si OFF) ?
- [ ] Page /fr/faq/[slug] route existe et lit FAQ DB ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO G6 — Génération boucle qualité (re-prompt automatique)
────────────────────────────────────────────────────────────────────────

Trace :
1. ContentGenJob status=needs_review avec qualityScore=68 < seuil 75
2. → Hook ou worker bascule status=quality_improving
3. → content-quality-improver-worker pick
4. → Re-prompt sections sous-score (V1=increment counter, V2=LLM ciblé)
5. → Update qualityScore → si ≥ targetScore → flip needs_review
6. → Si maxAttempts atteint → flip needs_review forçant Will manuel

Vérifier :
- [ ] Hook qui bascule vers quality_improving (qui décide score < seuil) ?
- [ ] Worker quality-improver fonctionnel (pas juste log V1) ?
- [ ] Toggle `quality_loop.enabled` respecté ?
- [ ] Compteur attempts incrémenté correctement ?
- [ ] Budget mensuel `monthlyBudgetCapUsd` respecté ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO G7 — Génération multi-modèles compétition V2 (Sprint 11)
────────────────────────────────────────────────────────────────────────

Trace :
1. Job pické avec mode="compete"
2. → Router lance OpenAI + Anthropic en parallèle
3. → Compare seoScore des 2 outputs
4. → Garde le meilleur, log l'autre dans GenerationLog

Vérifier (si V2 Sprint 11 livré) :
- [ ] Mode compete configurable depuis admin /settings/providers ?
- [ ] Router gère bien le parallèle (Promise.allSettled) ?
- [ ] Coût total = somme des 2 calls (incrémenté CostLedger) ?
- [ ] Output non retenu archivé dans GenerationLog metadata ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO G8 — Dry-run (estimation coût sans réel call)
────────────────────────────────────────────────────────────────────────

Specs § 15.2 : « Dry run » dans batch builder.

Trace :
1. Will → `/coverage/new` ou `/geo/batches/new` → coche "Dry run"
2. → Server Action estimate sans insert + sans enqueue
3. → Retourne estimation coût + durée

Vérifier :
- [ ] Bouton "Dry run" présent dans /coverage/new ?
- [ ] Server Action `estimateCampaign()` ou équivalent ?
- [ ] Pas d'insert DB ni d'enqueue en mode dry-run ?
- [ ] Estimation basée sur prix moyen / mot / type ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 3 — 6 SCÉNARIOS de PUBLICATION (review → live)            ║
╚═══════════════════════════════════════════════════════════════════════╝

────────────────────────────────────────────────────────────────────────
SCÉNARIO P1 — Auto-publication tier-2 (par défaut anti-doorway)
────────────────────────────────────────────────────────────────────────

Trace :
1. content-gen-worker termine generation → status=needs_review
2. → Insert ReviewQueue.pending automatiquement
3. → Article NON inséré DB encore (juste outputJsonRaw stocké dans
   ContentGenJob)
4. → Will doit approuver explicitement pour publier

Vérifier :
- [ ] Insert ReviewQueue automatique post-worker ? (vérifier code worker)
- [ ] OU bien publish-worker pick directement quand needs_review ?
- [ ] Distinction claire : « needs_review » signifie « job complet output
      prêt, attente Will » ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO P2 — Approve tier-2 manuel via review-queue
────────────────────────────────────────────────────────────────────────

Trace :
1. Will → `/review-queue` → liste pending
2. → Clique `/review-queue/[id]` → preview
3. → Clique "✅ Approuver (tier-2)"
4. → approveReview(id, notes) Server Action
5. → ReviewQueue.status=approved
6. → Enqueue 'content-publish' { promoteToTier1: false }
7. → content-publish-worker insère Article tier_2_noindex_follow
8. → revalidatePath /fr/blog/[slug] + sitemap
9. → Pas de IndexNow ping (tier-2 noindex)

Vérifier :
- [ ] approveReview() enqueue bien content-publish ?
- [ ] Article inséré avec indexationTier=tier_2_noindex_follow ?
- [ ] Sitemap exclut tier-2 (vérifier filtres sitemap.xml) ?
- [ ] La page /fr/blog/[slug] retourne meta robots="noindex,follow" ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO P3 — Promote tier-1 manuel
────────────────────────────────────────────────────────────────────────

Trace :
1. Will → `/review-queue/[id]` → "🚀 Promouvoir tier-1"
2. → promoteToTier1(id) Server Action
3. → ReviewQueue.status=promoted_t1 + promotedToTier1At=now
4. → ContentGenJob.status=publishing
5. → Enqueue 'content-publish' { promoteToTier1: true }
6. → content-publish-worker insère Article tier_1_indexable
7. → Article.promotedAt=now
8. → Enqueue 'content-indexnow' avec URL article
9. → revalidatePath + sitemap inclut tier-1
10. → content-indexnow-worker POST api.indexnow.org

Vérifier :
- [ ] promoteToTier1 utilise bien ReviewStatus="promoted_t1"
      (et pas "approved" écrasé) ?
- [ ] indexationTier=tier_1_indexable sur Article créé ?
- [ ] IndexNow ping effectif ?
- [ ] Sitemap inclut tier-1 (filtre indexationTier=tier_1_indexable) ?
- [ ] La page /fr/blog/[slug] retourne robots="index,follow" pour tier-1 ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO P4 — Auto-publication RSS si score ≥ threshold
────────────────────────────────────────────────────────────────────────

Trace :
1. blog-from-rss generator termine → score=82
2. → policies.rssAutoPublishMinScore=75 → score >= seuil → auto-pub
3. → Skip ReviewQueue.pending → directement approved
4. → Enqueue 'content-publish' { promoteToTier1: false (tier-2 default) }
5. → Article published tier-2 immédiat sans Will intervention

Vérifier :
- [ ] Code worker content-gen check policy `rssAutoPublishMinScore` ?
- [ ] Toggle source.autoPublish ET score ≥ threshold tous deux respectés ?
- [ ] Pas de race condition (Will pourrait approuver entre-temps) ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO P5 — Auto-promotion tier-2 → tier-1 si CTR > seuil (V2)
────────────────────────────────────────────────────────────────────────

Trace V2 (Sprint 10) :
1. Cron mensuel 15 du mois 06:00 UTC → tier-lifecycle-worker
2. → Pick Articles tier-2 publiés > 30j
3. → Sync Search Console API (CTR + position 30j)
4. → Si CTR > 5 % → promote tier-1
5. → Article.indexationTier=tier_1_indexable + promotedAt=now
6. → Enqueue IndexNow ping
7. → revalidatePath

Vérifier (si Sprint 10 V2 livré) :
- [ ] Worker tier-lifecycle présent + cron boot ?
- [ ] Sync Search Console via API (token + secret config) ?
- [ ] Seuil CTR configurable admin ?
- [ ] Audit trail (qui a promu, quand, pourquoi) dans ActivityLog ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO P6 — Republication après modification
────────────────────────────────────────────────────────────────────────

Trace :
1. Article tier-1 publié il y a 2 mois
2. Will → ? (existe-t-il une UI pour ré-éditer ?)
3. → Si oui : updateArticle() Server Action
4. → Article.updatedAt incrémenté
5. → revalidatePath /fr/blog/[slug]
6. → IndexNow ping (signal mise à jour Bing)
7. → Article.lastModified meta updated

⚠️ Vérifier :
- [ ] Existe-t-il une page admin pour ÉDITER un Article déjà publié ?
- [ ] Ou faut-il dégommer + régénérer ?
- [ ] Si pas d'édition : c'est un gap UX majeur (P0).
- [ ] Si oui : flow complet de re-publication + cache invalidation ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 4 — 7 SCÉNARIOS de MODIFICATION (post-gen)                ║
╚═══════════════════════════════════════════════════════════════════════╝

────────────────────────────────────────────────────────────────────────
SCÉNARIO M1 — Modifier titre / meta / body d'un Article publié
────────────────────────────────────────────────────────────────────────

Trace :
1. Will admin → ? (UI à identifier)
2. → updateArticle() ou équivalent
3. → ArticleTranslation.title/body modifiée
4. → Article.updatedAt
5. → revalidatePath /fr/blog/[slug]
6. → Cache CDN purge (Cloudflare)
7. → IndexNow ping mise à jour
8. → Sitemap lastmod refresh

Vérifier :
- [ ] **UI ADMIN existe-t-elle ?** Si non → **GAP P0** (impossible
      d'éditer une publication, contraint à dégommer + régen)
- [ ] Si oui : où ? `/blog/[id]/edit` ? `/articles/[id]` ?
- [ ] Server Action updateArticleTranslation ?
- [ ] Audit trail dans ActivityLog ?
- [ ] Worker re-évalue qualityScore post-édition (boucle qualité re-run) ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO M2 — Modifier template système prompt
────────────────────────────────────────────────────────────────────────

Trace :
1. Will → `/templates/[id]` → édite systemPrompt + userPromptTemplate
2. → upsertTemplate() → version+1
3. → revalidatePath /templates + /templates/[id]
4. → Next génération avec ce template utilise nouvelle version

Vérifier :
- [ ] Version incrémentée à chaque save (pas juste écrasement) ?
- [ ] Historique versions accessible (rollback possible) ?
- [ ] Anciens jobs garder ref `template.version` audit trail ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO M3 — Modifier profil Manon (impact JSON-LD + page publique)
────────────────────────────────────────────────────────────────────────

Trace :
1. Will → `/author/manon` → édite displayName + bio + photoAlt + disclaimer
2. → updateAuthor() → AuthorProfile.update
3. → revalidatePath /fr/equipe/manon + admin self
4. → /fr/equipe/manon affiche nouvelle bio + nouveau disclaimer
5. → Articles publiés affichent author.name = nouveau displayName
      (via lecture AuthorProfile à chaque render) ?

Vérifier :
- [ ] Articles déjà publiés voient-ils la modification ? (lecture dynamique
      AuthorProfile vs snapshot au moment de la publication ?)
- [ ] JSON-LD Person rebuild correctement avec nouveaux champs ?
- [ ] Mode persona (isPersona, aiGenerated, disclaimer) propagé ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO M4 — Modifier banned phrases / mots interdits
────────────────────────────────────────────────────────────────────────

Trace :
1. Will → `/settings/banned-phrases` → addBannedPhrase("ADN", severity=block)
2. → BannedPhrase.create
3. → Next génération → doctrine-check lit table → reject si pattern présent

Vérifier :
- [ ] doctrine-check lit BannedPhrase à CHAQUE gen (pas cached) ?
- [ ] severity="warn" log only / "block" reject ?
- [ ] Articles déjà publiés contenant la phrase NE sont PAS rétroactivement
      flag ? (ou worker scan post-add ?)

────────────────────────────────────────────────────────────────────────
SCÉNARIO M5 — Modifier seuils (plagiat, retention, daily batch)
────────────────────────────────────────────────────────────────────────

Trace :
1. Will → `/settings/policies` → updatePolicies({plagiarismJaccardInternal=0.4})
2. → ContentGenConfig.policies upsert
3. → Next génération → checkDedup lit DB → applique nouveau seuil

Vérifier :
- [ ] Tous les modules lisent DB à chaque check (pas cache mémoire stale) ?
- [ ] Validation Zod range OK (0-1, etc.) ?
- [ ] Effet immédiat (pas besoin de restart worker) ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO M6 — Modifier campagne en cours (ajouter +50 slots)
────────────────────────────────────────────────────────────────────────

Specs § 12.1 : « Boutons [Pause] [Reprendre] [Annuler] [+50 slots] »

Trace :
1. Will → `/coverage/[id]` → bouton "+50 slots"
2. → updateCampaign() ou Server Action dédiée
3. → CoverageCampaign.totalTargetCount += 50
4. → orchestrator picks 50 jobs supplémentaires next tick

Vérifier :
- [ ] Bouton "+50 slots" PRÉSENT dans /coverage/[id] ? (vérifier UI)
- [ ] Server Action dédiée existe (incrementCampaignTarget ?) ?
- [ ] Distribution % respectée pour les 50 nouveaux ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO M7 — Modifier source RSS (URL, pollInterval, tags)
────────────────────────────────────────────────────────────────────────

Trace :
1. Will → `/rss/[id]` → modifier
2. → updateRssSource()
3. → Cron rss-fetch lit nouvelle config next tick

Vérifier :
- [ ] Action updateRssSource présente ?
- [ ] (V1 ContentGenConfig.rss_sources liste — toggle source enabled
      possible ?)
- [ ] OU V2 table RssSource avec endpoints update ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 5 — 8 SCÉNARIOS de DÉPUBLICATION / Archive / Suppression  ║
╚═══════════════════════════════════════════════════════════════════════╝

────────────────────────────────────────────────────────────────────────
SCÉNARIO D1 — Reject manuel via review-queue
────────────────────────────────────────────────────────────────────────

Trace :
1. Will → `/review-queue/[id]` → "❌ Rejeter" + notes obligatoires
2. → rejectReview(id, notes)
3. → ReviewQueue.status=rejected + reviewNotes + reviewedAt
4. → ContentGenJob.status=cancelled OU autre ?
5. → Article PAS inséré
6. → Coût gen retenu en CostLedger malgré rejet

Vérifier :
- [ ] rejectReview présent + notes min 5 char validation ?
- [ ] ContentGenJob bascule vers quel statut post-reject ? (cancelled
      ou rejected ? Cohérent avec enum ?)
- [ ] Job apparaît dans /publications-status colonne "Refusé" ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO D2 — Demote tier-1 → tier-2 manuel
────────────────────────────────────────────────────────────────────────

Trace :
1. Will admin → ? (UI à identifier) → demote(article-id)
2. → Article.indexationTier=tier_2_noindex_follow
3. → revalidatePath /fr/blog/[slug] (robots passe en noindex)
4. → IndexNow ping URL_DELETED (signaler Bing/Yandex)
5. → Sitemap exclut maintenant ce slug

⚠️ Vérifier :
- [ ] Bouton "Demote tier-2" existe-t-il quelque part ?
- [ ] Si non → GAP P0 (master prompt prévoit tier_2 ↔ tier_1 réversible)
- [ ] Server Action demoteArticle() ?
- [ ] Signal Bing URL_DELETED via Google Indexing API si activé ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO D3 — Demote auto via tier-lifecycle-worker (V2)
────────────────────────────────────────────────────────────────────────

Trace V2 (Sprint 10) :
1. Cron mensuel 15 du mois 06:00 → tier-lifecycle-worker
2. → Sync Search Console : CTR moyen Article tier-1 30j = 0.8 %
3. → Politique : CTR < 1 % depuis 60j → demote
4. → Article.indexationTier=tier_2_noindex_follow
5. → revalidate + IndexNow URL_DELETED
6. → ActivityLog audit trail

Vérifier (si V2 livré) :
- [ ] Worker présent + cron ?
- [ ] Seuils CTR configurables admin ?
- [ ] Notification Telegram à Will avant action automatique ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO D4 — Archive auto news-lifecycle > 90j
────────────────────────────────────────────────────────────────────────

Trace :
1. Cron daily 05:00 → content-news-lifecycle-worker
2. → Pick Articles isNews=true completedAt > 90j
3. → Article.status=archived
4. → revalidatePath /fr/actualites/[slug]
5. → Page /fr/actualites/[slug] retourne 404 ou 410 Gone ?
6. → Sitemap-news.xml exclut

Vérifier :
- [ ] Worker fonctionnel (pas just log) ?
- [ ] La page /fr/actualites/[slug] gère status=archived (404 ou 410) ?
- [ ] Pas de fuite : sitemap-news.xml exclut bien archived ?
- [ ] redirect 301 vers article successeur si applicable ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO D5 — Archive manuel admin
────────────────────────────────────────────────────────────────────────

Trace :
1. Will admin → ? (UI à identifier) → archiveArticle(id)
2. → Article.status=archived
3. → revalidate + sitemap exclut

⚠️ Vérifier :
- [ ] Bouton "Archiver" existe-t-il dans /publications ou
      /publications-status ?
- [ ] Server Action archiveArticle ?
- [ ] Possibilité de RESTAURER ensuite (unarchive) ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO D6 — Suppression définitive Article DB
────────────────────────────────────────────────────────────────────────

⚠️ Sensible : suppression permanente d'un Article (vs archive).

Trace :
1. Will admin → ? → deleteArticle(id) avec confirmation double
2. → Cascade : Article.translations supprimées, FK ContentCitation
      réorientées, FK ContentGenJob.outputBlogPostId = null
3. → revalidatePath + sitemap exclut

Vérifier :
- [ ] Suppression possible ou bloquée à dessein ? (archive préférée)
- [ ] Si possible : double confirmation modale ?
- [ ] RGPD : registre audit log permanent même après suppression ?
- [ ] Cascade Prisma respectée (pas de FK orpheline) ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO D7 — Cancel campagne en cours
────────────────────────────────────────────────────────────────────────

Trace :
1. Will → `/coverage/[id]` → "Annuler"
2. → cancelCampaign(id)
3. → CoverageCampaign.status=cancelled + completedAt=now
4. → Que se passe-t-il pour les jobs en vol ?

Spec § 12.1 : « [Cancel running jobs only] [Cancel all] »

Vérifier :
- [ ] 2 options présentes (running only vs all) ?
- [ ] Les jobs queued sont bien drainés (cancelled) ?
- [ ] Les jobs running terminent leur cycle ou interrompus ?
- [ ] Les jobs needs_review déjà publiés restent intacts ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO D8 — Kill switch (pause toutes générations)
────────────────────────────────────────────────────────────────────────

Trace :
1. Will → `/settings/kill-switch` → activate avec raison
2. → ContentGenConfig.kill_switch.active=true
3. → content-gen-worker check début processJob → throw + requeue
4. → orchestrator-worker check début tick → skip
5. → rss-fetch / similarity / news-lifecycle / qa-extract → skip aussi ?
6. → publish-worker → continue ou skip ?

Vérifier :
- [ ] TOUS les workers content-gen checkent kill_switch ?
      (orchestrator + content-gen au minimum)
- [ ] publish-worker continue malgré kill_switch (publication finale OK
      vs génération nouvelle stoppée — distinction claire)
- [ ] Désactivation propre + workers reprennent ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 6 — 5 SCÉNARIOS de RESTAURATION / Retry / Rollback        ║
╚═══════════════════════════════════════════════════════════════════════╝

────────────────────────────────────────────────────────────────────────
SCÉNARIO R1 — Rollback Article publication
────────────────────────────────────────────────────────────────────────

Specs § 14.3 : « Rollback » via /publications history.

Trace :
1. Will → `/publications` → liste history
2. → Bouton "Rollback" sur un Article publié
3. → Confirmation modale + diff preview
4. → rollbackArticle(id) → restore version précédente ou unpublish ?

Vérifier :
- [ ] Bouton Rollback présent dans /publications ?
- [ ] Server Action rollbackArticle existe ?
- [ ] Versioning Article ou juste unpublish ?
- [ ] IndexNow ping URL_DELETED si tier-1 → tier-2 ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO R2 — Retry failed job individuel
────────────────────────────────────────────────────────────────────────

Trace :
1. Will → `/jobs/[id]` (status=failed) → "Rejouer"
2. → retryJob(id) Server Action
3. → ContentGenJob.status=queued + errorMessage=null + retryCount+1
4. → Re-enqueue BullMQ ? (vérifier : insert DB seulement OU enqueue aussi)
5. → content-gen-worker pick

Vérifier :
- [ ] retryJob bascule status=queued ET enqueue BullMQ ?
- [ ] retryCount incrémenté ?
- [ ] Si retryCount >= retryMaxAttempts → bouton désactivé ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO R3 — Retry all failed (bulk)
────────────────────────────────────────────────────────────────────────

Trace :
1. Will → `/queue` ou `/jobs` → "Retry all failed"
2. → retryAllFailed() Server Action
3. → updateMany status=queued where status=failed
4. → Re-enqueue chaque job dans BullMQ (loop) ?

⚠️ Vérifier :
- [ ] updateMany SEUL = pas suffisant (worker ne picke pas sans enqueue)
      OU bien le worker a un poll DB qui repick ?
- [ ] Si updateMany seul + pas d'enqueue → JOBS RESTENT BLOQUÉS (P0)

────────────────────────────────────────────────────────────────────────
SCÉNARIO R4 — Resume paused campaign
────────────────────────────────────────────────────────────────────────

Trace :
1. Will → `/coverage/[id]` (paused) → "▶️ Reprendre"
2. → resumeCampaign(id)
3. → CoverageCampaign.status=running + pausedAt=null
4. → Next tick orchestrator picke à nouveau

Vérifier :
- [ ] resumeCampaign présent et flip propre ?
- [ ] Audit trail : pausedAt préservé en backup field ou perdu ?

────────────────────────────────────────────────────────────────────────
SCÉNARIO R5 — Restore archived Article
────────────────────────────────────────────────────────────────────────

Trace :
1. Will admin → ? (UI à identifier) → unarchiveArticle(id)
2. → Article.status=published
3. → revalidatePath
4. → Sitemap re-inclut

⚠️ Vérifier :
- [ ] Bouton "Restaurer" existe ?
- [ ] OU action manuelle SQL nécessaire (gap UX P1) ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 7 — 10 SCÉNARIOS d'ERREUR + Recovery                     ║
╚═══════════════════════════════════════════════════════════════════════╝

Pour CHAQUE cas d'erreur : tracer comportement attendu vs implémenté.

────────────────────────────────────────────────────────────────────────
E1 — Provider IA timeout (OpenAI 30s sans réponse)
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- AbortController 30s timeout
- Circuit breaker note 1 fail
- Fallback Anthropic immédiat
- Retry compteur incrémenté
- Si 5 fails consécutifs → circuit open 60s
- Telegram alerte si > 5 min down

Vérifier code path complet présent.

────────────────────────────────────────────────────────────────────────
E2 — Cost cap mensuel atteint (OpenAI > $200)
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- CostLedger insert + ProviderConfig.currentMonthSpentUsd update
- Check seuil 80 % → Telegram warning
- Check seuil 100 % → kill-switch auto + Telegram critical
- Provider basculé OFF jusqu'au 1er du mois (cron reset)

Vérifier :
- [ ] Hook post-call CostLedger insert ?
- [ ] Check seuil 80/100 % effectif (où dans le code) ?
- [ ] kill-switch auto via `activateKillSwitch()` programmatic ?
- [ ] Reset cron 1er mois fonctionnel ?

────────────────────────────────────────────────────────────────────────
E3 — KB not ready (< 50 entries publiées)
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- assertKbReady() throw KbNotReadyError
- Worker catch → ContentGenJob.status=failed + errorMessage clair
- Telegram alerte "[🔴 KB NOT READY]"
- Bypass mode KB_BYPASS=true skip check

Vérifier code path.

────────────────────────────────────────────────────────────────────────
E4 — Dedup pré-IA reject (titre quasi-identique existant)
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- checkDedup throw ou return passed=false
- Worker bascule status=cancelled + errorMessage="Dedup pré-IA: ..."
- Job apparaît dans /publications-status colonne refusé
- Pas de gaspillage tokens (call IA évité)

────────────────────────────────────────────────────────────────────────
E5 — Doctrine check fail post-gen (SIREN détecté, naming AxionIA, etc.)
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- doctrine-check return passed=false + pattern matched
- Article output rejeté avant ReviewQueue.insert
- ContentGenJob.status=failed + errorMessage=doctrine violation
- Logs détaillés pour audit
- BannedPhrase incrément counter ?

────────────────────────────────────────────────────────────────────────
E6 — Quality score below threshold
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- Si qualityScore < settings.minScoreThreshold ET quality_loop.enabled
- → Bascule status=quality_improving
- → Worker quality-improver re-prompt
- Si maxAttempts atteint → flip needs_review pour Will manuel

────────────────────────────────────────────────────────────────────────
E7 — Plagiat détecté post-gen (Jaccard > seuil)
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- plagiarism return score > seuil
- Worker bascule status=cancelled OU failed selon politique
- GenerationLog avec extrait du contenu source dupliqué
- Alerte Telegram si répétitif (même source plusieurs jobs)

────────────────────────────────────────────────────────────────────────
E8 — Migration SQL non appliquée (table content_gen_jobs n'existe pas)
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- Prisma throw P2021 (table doesn't exist)
- Server Actions catch + return error utilisateur "DB schema pas migré"
- Dashboard ne crash pas (affiche KPIs=0 + bannière "DB schema migration
  nécessaire")
- Workers refusent de démarrer avec message clair

────────────────────────────────────────────────────────────────────────
E9 — Redis indisponible (REDIS_URL down)
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- BullMQ connection error
- Server Actions enqueue throw (pas crash silencieux)
- UI affiche erreur claire (toast)
- Workers refusent de démarrer (REDIS_URL check + throw)
- Telegram alerte si applicable (sans Redis = pas de Telegram en queue)

────────────────────────────────────────────────────────────────────────
E10 — Worker crash mid-generation
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- BullMQ détecte crash → re-pick job avec backoff
- retryCount incrémenté
- Si retryMaxAttempts atteint → status=failed définitif
- ContentGenJob.completedAt + errorMessage rempli
- Sentry capture stack trace
- Article PAS inséré DB partiellement (transaction atomique)

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 8 — UX / Frontend / Accessibilité (10 scénarios A1-A10)   ║
╚═══════════════════════════════════════════════════════════════════════╝

────────────────────────────────────────────────────────────────────────
A1 — Accessibilité opérationnelle (clavier + lecteur d'écran)
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- Tab order logique sur chaque page admin
- Tous les boutons critiques (kill switch, promote tier-1, cancel campaign,
  reject review) atteignables au clavier
- ARIA labels présents sur boutons icônes seuls (🚀, ❌, 🛑, +)
- Focus visible (outline) sur tous les éléments interactifs
- Lecteur d'écran annonce correctement les statuts dynamiques
  (live regions pour KPIs dashboard + queue counts)

Vérifier :
- [ ] `pnpm a11y:audit` ou Playwright @a11y tag passe sur /content-gen/**
- [ ] Aucun bouton-icône sans `aria-label` (grep `<button>.*[🚀❌🛑]`)
- [ ] Forms admin ont `<label htmlFor>` associés à chaque input
- [ ] Boutons destructifs ont `aria-haspopup="dialog"` (confirmation modal)
- [ ] Contraste WCAG AA respecté sur badges statut (var --color-terracotta
      sur fond ivoire = 4.5:1 mini)
- [ ] `prefers-reduced-motion` respecté (pas d'animation forcée)

────────────────────────────────────────────────────────────────────────
A2 — Mobile / tablette admin (responsive < 768px)
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- admin-filters-grid passe en 1-col sur mobile
- admin-card-grid s'adapte (grid-template-columns auto-fit)
- Tables horizontales scrollables (overflow-x auto)
- Buttons groups stack vertical
- Sidebar admin masquée + hamburger menu OR drawer Radix

Vérifier :
- [ ] CSS media queries présentes pour < 768px sur pages content-gen
- [ ] `pnpm test:e2e --project=mobile` (si configuré Playwright)
- [ ] Pas de débordement viewport (vérifier `overflow-x` body)
- [ ] Forms inputs ≥ 44px touch target (Apple HIG)
- [ ] Modales Radix Dialog mobile-friendly (full-screen < 480px)

────────────────────────────────────────────────────────────────────────
A3 — Loading states UI (action longue ≥ 2s)
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- Bouton submit disable + spinner pendant Server Action
- Skeleton screens pendant lecture initiale page
- Optimistic UI pour actions courtes (toggle, archive)
- Toast "Génération en cours…" pour enqueue campagne

Vérifier :
- [ ] `useFormStatus` ou équivalent React 19 sur forms admin
- [ ] Pages avec `<Suspense>` + loading.tsx
- [ ] `pnpm test:e2e` vérifie absence de double-click possible
- [ ] revalidatePath retourne rapidement (pas freeze 5s+)

────────────────────────────────────────────────────────────────────────
A4 — Pagination + scale UI (50K rows ContentGenJob)
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- Server-side pagination (Prisma skip/take) sur /jobs, /publications,
  /publications-status, /coverage, /review-queue
- 50/page default + sélecteur page size
- Compteur total affiché
- Tri par colonne via searchParams
- Search/filter applicable AVANT pagination

Vérifier :
- [ ] `listJobs(filters)` retourne `{ rows, total, page, totalPages }`
- [ ] UI affiche "page X/Y" + boutons prev/next
- [ ] Aucune page admin charge > 200 rows in-memory
- [ ] Index DB sur colonnes triées (createdAt DESC, status, contentType)
- [ ] Performance : page /jobs avec 50K rows répond < 500 ms

────────────────────────────────────────────────────────────────────────
A5 — Search + filters fonctionnels (pas juste UI)
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- Filtres `/jobs?status=failed&contentType=blog_from_rss` fonctionnent
- Search par id substring, anchor ville slug, title
- Combinaison filtres : AND par défaut
- Reset filtres : bouton "Réinitialiser"

Vérifier :
- [ ] Server Action `listJobs(filters)` consomme TOUS les filtres UI
- [ ] Pas de filtres "fantômes" (input présent mais ignoré côté serveur)
- [ ] URL searchParams reflète l'état filtres (deep-link partageable)
- [ ] Reset clear bien tous les filtres + revient page 1

────────────────────────────────────────────────────────────────────────
A6 — Export CSV (master § 12.1)
────────────────────────────────────────────────────────────────────────
Spec § 12.1 : « Export CSV avec filtres actifs » sur /publications-status
+ /geo "Export CSV total".

Vérifier :
- [ ] Bouton "Export CSV" présent dans /publications-status
- [ ] Bouton "Export CSV total" présent dans /geo
- [ ] Server Action ou Route Handler `/api/content-gen/export/...`
- [ ] Filtres actifs respectés (export = sous-ensemble visible)
- [ ] Headers Content-Disposition: attachment + nom fichier daté
- [ ] Encoding UTF-8 BOM (Excel ouvre français correctement)
- [ ] Limite raisonnable (max 10K rows par export, sinon pagination)

────────────────────────────────────────────────────────────────────────
A7 — Bulk actions UI multi-sélection
────────────────────────────────────────────────────────────────────────
Spec § 12.1 + § 15.1.5 : « Bulk actions : sélection 5 villes / 5 lignes
→ [Regen] [Promouvoir tier-1] [Archive] [Approve bulk] »

Pages où bulk attendu :
- /jobs : retry bulk failed
- /review-queue : bulk approve si score ≥ 75 / bulk reject si < 50
- /publications-status : bulk archive drafts > 30j
- /geo : 5 villes select → batch actions
- /similarity-monitor : archive moins performant / merge 301 / ignore

Vérifier :
- [ ] Checkbox "select all" + "select row" sur chaque table
- [ ] Sticky toolbar bulk actions apparaît quand sélection ≥ 1
- [ ] Server Action bulk avec validation count (max 100 par batch)
- [ ] Confirmation modale pour bulk destructive (delete, archive)
- [ ] Progress feedback si bulk > 30s

────────────────────────────────────────────────────────────────────────
A8 — Drag & drop kanban /publications-status
────────────────────────────────────────────────────────────────────────
Spec § 12.1 : « Drag & drop entre colonnes (change status) »

Vérifier :
- [ ] `@dnd-kit/core` installé + utilisé dans publications-status/page.tsx
- [ ] Drag d'une card "needs_review" → drop "approved" → trigger
      approveReview()
- [ ] Animation fluide (transform GPU, pas reflow)
- [ ] Accessible clavier (Space pour pick, arrow keys pour move, Enter
      pour drop)
- [ ] Optimistic UI + revert si Server Action throw

────────────────────────────────────────────────────────────────────────
A9 — Preview iframe avant approve (master § 12.1)
────────────────────────────────────────────────────────────────────────
Spec § 12.1 : « Preview iframe (réelle URL /fr/...?preview=true&token=) »

Comportement attendu :
- /review-queue/[id] affiche iframe < src="/fr/blog/preview?token=XXX">
- Token JWT signé valide 10 min (anti-leak)
- Iframe rend exactement comme la page publique finale
- Côté public, route /preview lit Article candidat depuis ContentGenJob
  .outputJsonRaw (pas DB Article — qui n'existe pas encore)

Vérifier :
- [ ] Bouton "Voir preview" ou iframe inline dans review-queue/[id]
- [ ] Route Next 16 `/fr/blog/preview` ou query param `?preview=true`
- [ ] Token signing (env PREVIEW_SECRET) + expiration
- [ ] Pas de fuite : preview accessible UNIQUEMENT avec token admin
- [ ] CSP iframe-src approprié

────────────────────────────────────────────────────────────────────────
A10 — Diff version preview avant rollback / re-promote
────────────────────────────────────────────────────────────────────────
Spec § 14.1 + § 14.3 : « Diff vs version précédente + diff preview »

Vérifier :
- [ ] Page /publications affiche diff entre version actuelle et
      précédente (si versioning Article existe — sinon GAP)
- [ ] Lib diff : `diff` npm ou `react-diff-viewer` ?
- [ ] Confirmation modale rollback inclut le diff highlighted
- [ ] Comparaison sur title + body + meta + faqJson

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 9 — Workflows avancés (8 scénarios B1-B8)                 ║
╚═══════════════════════════════════════════════════════════════════════╝

────────────────────────────────────────────────────────────────────────
B1 — Comments review + "Request edits"
────────────────────────────────────────────────────────────────────────
Spec § 14.1 : « [Request edits → comment] »

Comportement attendu :
- ReviewQueue.status passe à `needs_edits` avec comment Will
- Worker / Server Action pick ce review → bascule ContentGenJob status
- Worker quality-improver re-prompt avec comment Will comme guidance
- Boucle : edit → new review → approve OU encore edits

Vérifier :
- [ ] Bouton "Demander des modifs" dans /review-queue/[id]
- [ ] Field texte comment obligatoire (min 10 chars)
- [ ] Server Action `requestEdits(id, comment)` présente
- [ ] Statut needs_edits utilisé (pas orphelin)
- [ ] Quality-improver consomme `ReviewQueue.reviewNotes` comme prompt
- [ ] Audit trail comments via GenerationLog ou table dédiée

────────────────────────────────────────────────────────────────────────
B2 — SSE temps réel job detail (master § 12.4)
────────────────────────────────────────────────────────────────────────
Spec § 12.4 : « SSE /api/content-gen/jobs/[id]/stream + composant
`<JobLogStream jobId>` utilise EventSource natif »

Comportement attendu :
- Route `/api/content-gen/jobs/[id]/stream` runtime=nodejs
- ReadableStream avec Redis subscribe `job:${id}:events`
- Worker publish events à chaque step (kb_retrieve, llm_call, image_gen,
  quality_check, validation, write)
- Client EventSource reçoit + affiche log live
- Auto-scroll bottom + button "pause auto-scroll"

Vérifier :
- [ ] Route présente `src/app/api/content-gen/jobs/[id]/stream/route.ts`
- [ ] Worker publish via `redisPublisher.publish()` à chaque step
- [ ] Composant `JobLogStream` (client) sur page /jobs/[id]
- [ ] Cleanup unsubscribe sur navigation away
- [ ] Reconnexion auto si déconnexion réseau

────────────────────────────────────────────────────────────────────────
B3 — SSE cockpit géo events (master § 12.4)
────────────────────────────────────────────────────────────────────────
Spec § 12.4 : « cockpit géo idem : /api/content-gen/geo-events push
minimal { villeSlug, status, score } à chaque changement »

Vérifier :
- [ ] Route présente
- [ ] Composant cockpit géo écoute events
- [ ] Re-coloriage ville ≤ 2 s post-event
- [ ] Toast haut "Marseille publié tier-2, score 73"

────────────────────────────────────────────────────────────────────────
B4 — Tiptap editor auto-save (si V1.5 livré)
────────────────────────────────────────────────────────────────────────
Si Tiptap intégré pour system prompts + bio Manon + comments review :

Vérifier :
- [ ] Auto-save toutes les 30s OU sur blur
- [ ] Localstorage backup pendant édition (perte session)
- [ ] Indicator "Saved Xs ago" visible
- [ ] Warning si navigation away avec changes non sauvés
- [ ] Validation côté serveur (Tiptap JSON sanitize)

────────────────────────────────────────────────────────────────────────
B5 — Onboarding wizard Radix Dialog (master § 12.1ter)
────────────────────────────────────────────────────────────────────────
Spec § 12.1ter : « Wizard 5 étapes (Radix Dialog + Stepper) »

Vérifier (vs implémentation V1 checklist linéaire) :
- [ ] Modal Radix Dialog (pas page statique) ?
- [ ] Stepper visuel avec progression ?
- [ ] Étape 5 lance vraiment génération test Lyon ou autre ville ?
- [ ] SSE log temps réel ~90s pendant test ?
- [ ] Promote tier-1 ou keep tier-2 en fin de wizard ?

────────────────────────────────────────────────────────────────────────
B6 — Concurrence multi-admin (race conditions)
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- Si Admin A et Admin B ouvrent même review-queue/[id]
- Admin A approve → Admin B reload → voit déjà approuvé
- Admin B click approve → Server Action détecte status≠pending → no-op
  + toast "Déjà approuvé par <user>"

Vérifier :
- [ ] Server Actions check status actuel avant transition
- [ ] Optimistic locking via updatedAt (where clause check)
- [ ] Pas de double-publish possible (ReviewQueue.status unique
      transition path)
- [ ] Tests integration cover race condition

────────────────────────────────────────────────────────────────────────
B7 — Déconnexion session mid-action
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- Will perd session pendant submit form (token expiré)
- Server Action throw "unauthorized"
- UI catch + redirect /login avec retour callback URL
- Form data PRÉSERVÉE en localStorage pour retry après login

Vérifier :
- [ ] requireAdmin() throw error spécifique
- [ ] Middleware admin redirect /login avec ?returnTo=
- [ ] Forms admin sauvegardent draft localStorage avant submit
- [ ] Retour login restaure form

────────────────────────────────────────────────────────────────────────
B8 — Will en vacances 1 mois (auto-management)
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- Reviews s'accumulent dans pending
- Email digest hebdo Will (résumé jobs + reviews + alerts)
- OU auto-publish failover si configuré (settings absent_admin_days)
- Telegram alerte "X reviews pending > 7j"

Vérifier :
- [ ] Cron hebdo email digest présent ?
- [ ] Setting `auto_publish_if_admin_absent_days` configurable ?
- [ ] OU à défaut : alerte Telegram seuil (7j + 14j + 21j) ?
- [ ] Kill switch auto si > 30j absent (safety) ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 10 — Aspects techniques edge (9 scénarios C1-C9)          ║
╚═══════════════════════════════════════════════════════════════════════╝

────────────────────────────────────────────────────────────────────────
C1 — Cron timing precision UTC vs local time
────────────────────────────────────────────────────────────────────────
Vérifier :
- [ ] BullMQ repeat patterns en cron expression UTC
- [ ] Server Coolify (Hetzner) timezone configuré UTC
- [ ] Logs Telegram timestamp UTC OU Europe/Paris explicit ?
- [ ] UI admin timestamps : ISO string ou format FR ?
- [ ] Pas de drift > 30s entre cron expected et exécution réelle

────────────────────────────────────────────────────────────────────────
C2 — Idempotency double-tick orchestrator
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- Si tick orchestrator manuellement re-trigger (debug, race condition
  cron),
  ContentGenJob.idempotencyKey empêche double insert
- Erreur Prisma P2002 catché silencieusement (skip)

Vérifier :
- [ ] Try/catch sur insert avec check err.code === 'P2002'
- [ ] Test integration : 2 ticks consécutifs même seconde → 0 doublon
- [ ] BullMQ jobId unique par hash (gen-${jobId}) bloque re-enqueue

────────────────────────────────────────────────────────────────────────
C3 — Cleanup post-cancellation campaign
────────────────────────────────────────────────────────────────────────
Spec § 12.1 : « [Cancel running jobs only] [Cancel all] »

Comportement attendu (Cancel all) :
- Tous les ContentGenJob.status IN (queued, running) WHERE campaignId = X
  → bascule cancelled
- Jobs déjà needs_review / published restent intacts
- BullMQ queue purgée (delayed + waiting jobs removed)
- Worker en plein job → finit son cycle (graceful) ou interrompu ?

Vérifier :
- [ ] Server Action cancelCampaign options ('all' vs 'running_only')
- [ ] Cleanup BullMQ via `queue.removeJobs()` ou `queue.drain()`
- [ ] Worker check campaignId.cancelled avant continue ? OR ignore ?
- [ ] Audit trail : cancelledCount + completedBeforeCancel

────────────────────────────────────────────────────────────────────────
C4 — OWASP API security (Server Actions)
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- Server Actions valident TYPES inputs (Zod ou checks)
- Pas de mass assignment (Will input campaignId mais update authorisé ?)
- Pas de prototype pollution (JSON.parse user input → check `__proto__`)
- Rate-limit middleware sur Server Actions admin

Vérifier :
- [ ] Toutes les Server Actions content-gen validation entry
- [ ] Aucun `prisma.X.update({ data: req.body })` direct (massassignment)
- [ ] JSON.parse fields wrapper safe (try/catch + validation)
- [ ] Rate-limit 10 req/min/user sur actions sensibles ?

────────────────────────────────────────────────────────────────────────
C5 — CSRF + double-submit protection
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- Next 16 Server Actions ont CSRF built-in (POST with action token)
- Idempotency-Token sur forms critiques (no double-submit)
- Submit button disabled pendant pending

Vérifier :
- [ ] Next 16 Server Actions natifs (pas API routes manuelles)
- [ ] Forms admin utilisent `<form action={serverAction}>` (pas onClick)
- [ ] Buttons disabled via useFormStatus.pending
- [ ] Test : double-submit rapide → second call no-op ?

────────────────────────────────────────────────────────────────────────
C6 — Migrations V1 ↔ V2 compat données existantes
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- Migration `add_content_gen_v2_*` ne casse pas data V1
- Nouveaux champs nullable OU default
- Pas de DROP column avec data
- Backwards-compat : V1 worker peut lire V2 schema

Vérifier :
- [ ] Tous les ALTER TABLE V2 sont additifs (ADD COLUMN)
- [ ] Defaults sur nouveaux champs NOT NULL
- [ ] Tests migration sur DB V1 dump pré-V2 si disponible
- [ ] Rollback migration documenté (down.sql)

────────────────────────────────────────────────────────────────────────
C7 — Cache invalidation cascade
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- Modifier AuthorProfile Manon → revalidate /equipe/manon
  + revalidate /blog/[slug]* (toutes pages avec author=Manon)
  + revalidate /actualites/[slug]*
- Modifier ContentGenConfig (llms-txt) → revalidate /llms.txt
- Modifier policies (seuils) → AUCUNE revalidate UI (juste effet
  futures gens)
- Modifier Article publié → revalidate cette URL + sitemap.xml

Vérifier :
- [ ] revalidateTag() utilisé pour invalidation grouped ?
  (`revalidateTag("author-manon")` sur toutes pages tagged)
- [ ] Pas de stale data > 60s sur pages publiques après save admin

────────────────────────────────────────────────────────────────────────
C8 — Timezone cohérence (DB / UI / Telegram / Logs)
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- Postgres TIMESTAMP WITH TIME ZONE (Prisma default)
- UI admin affiche en Europe/Paris (format date FR)
- Logs Sentry / Telegram timestamps UTC explicit (suffix Z)
- Crons cron expressions en UTC

Vérifier :
- [ ] Toutes les colonnes Prisma DateTime → @db.Timestamptz (V2)
- [ ] UI `Date.toLocaleString('fr-FR')` consistant
- [ ] Telegram messages : "[12:34 UTC]" ou "[14:34 Paris]" explicit
- [ ] Pas de "minute decalée" entre logs et UI

────────────────────────────────────────────────────────────────────────
C9 — Content overflow (Article body 50K mots)
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- Article body max raisonnable (5K mots = ~25KB texte = 100KB HTML)
- Preview iframe pagine ou virtual scroll si > 10K mots
- DB Postgres TEXT field illimité mais Prisma timeout potentiel
- UI table jobs/[id] truncate long fields

Vérifier :
- [ ] Limite côté generators (max output tokens raisonnable)
- [ ] Truncate dans table list (title 80 char, message 60 char)
- [ ] Preview scroll fluide sur Article 10K+ mots
- [ ] Postgres index trigram OK même sur très long body
  (FTS GIN @@map matérialisé)

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 11 — Observability avancée (3 scénarios D1-D3)            ║
╚═══════════════════════════════════════════════════════════════════════╝

────────────────────────────────────────────────────────────────────────
D1 — Telegram inline actions (master § 12.3bis)
────────────────────────────────────────────────────────────────────────
Spec § 12.3bis : « avec lien admin direct pour chaque événement
[ℹ️ REVIEW] 3 contenus tier-2 à valider. → /publications-status »

Vérifier :
- [ ] Chaque alerte Telegram contient URL clickable vers admin
- [ ] URL inclut adminPrefix + ?from=telegram pour tracking
- [ ] Lien fonctionne (route existe + ouvre direct la bonne section)
- [ ] Inline button "Approuver" / "Rejeter" via Telegram Bot API ?
  (V2.5+ — vérifier si livré ou skeleton)

────────────────────────────────────────────────────────────────────────
D2 — Notifications post-action email (UX bonus)
────────────────────────────────────────────────────────────────────────
Comportement attendu (si Will veut) :
- Confirmation email après approve / promote / reject / kill switch
- OU digest quotidien des actions admin (cron 18:00)
- Opt-in via settings admin

Vérifier :
- [ ] Setting `email_confirmations_admin_actions` ?
- [ ] Si actif : enqueue 'emails' avec template "admin_action_confirmed" ?
- [ ] Pas de spam (idempotency 1/action)
- [ ] HTML email FR avec lien retour admin

────────────────────────────────────────────────────────────────────────
D3 — ActivityLog audit trail granulaire
────────────────────────────────────────────────────────────────────────
Comportement attendu :
- Chaque action admin content-gen logge dans ActivityLog
- Fields : userId, action, targetType, targetId, payload diff, ip,
  userAgent, timestamp
- Page admin /activity-logs filtre par target content-gen

Vérifier :
- [ ] ActivityLog table existe et utilisée par Server Actions content-gen
- [ ] Server Actions wrap dans helper `logActivity(action, target, payload)`
- [ ] Page /activity-logs filtrable par target_type=content-gen
- [ ] IP + userAgent capturés (audit RGPD)
- [ ] Retention 90j minimum (compliance)

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 12 — Frontend ↔ Backend wire matrix complète              ║
╚═══════════════════════════════════════════════════════════════════════╝

Pour CHAQUE action utilisateur identifiée Phases 2-7 :

| # | Action | Bouton UI | Path | Server Action | DB mutation | Worker enqueue | Feedback UI |
|---|--------|-----------|------|---------------|-------------|----------------|-------------|

Exemples :
| G1 | Générer landing | /content-gen | Dashboard | enqueueLandingGen | Insert ContentGenJob | content-gen queue | toast + redirect /jobs/[id] |
| G3 | Lancer campagne | /coverage/new | Form | createCampaign + launchCampaign | Insert CoverageCampaign | content-orchestrator queue (cron) | redirect /coverage/[id] |
| P3 | Promote tier-1 | /review-queue/[id] | Button | promoteToTier1 | ReviewQueue + ContentGenJob update | content-publish queue | revalidate + toast |
| D8 | Kill switch | /settings/kill-switch | Form | activateKillSwitch | ContentGenConfig upsert | — (workers check à chaque tick) | bannière dashboard rouge |
...

Pour CHAQUE ligne :
- [ ] Bouton UI présent ?
- [ ] Path route existant ?
- [ ] Server Action existe ?
- [ ] DB mutation cohérente ?
- [ ] Worker enqueue présent (si applicable) ?
- [ ] Feedback UI immédiat (toast/redirect/revalidate) ?

→ Si UN seul de ces 6 maillons est cassé → l'action user est cassée → P0.

╔═══════════════════════════════════════════════════════════════════════╗
║                  PHASE 13 — SYNTHÈSE + VERDICT                        ║
╚═══════════════════════════════════════════════════════════════════════╝

Rapport unique :
`_AUDIT/CONTENT-GEN-AUDIT-OPERATIONNEL-FLOWS-2026-XX-XX.md`

Structure :

```markdown
# Content Generator — Audit opérationnel flows (YYYY-MM-DD)

## 1. Contexte
- Branche / commit / tag audités
- Méthodologie : 64 scénarios tracés frontend → backend → DB → worker
  → feedback UI (8 gen + 6 pub + 7 mod + 8 dépub + 5 restore + 10 err
  + 10 UX + 8 workflows + 9 tech + 3 observability)

## 2. État machine

### 2.1 ContentGenJob (12 statuts)
| Statut | Transitions IN | Transitions OUT | UI affiché | Orphelin ? |
|--------|---------------|-----------------|------------|------------|

### 2.2 Article (PublishStatus × IndexationTier = 9 combinaisons)
[matrice]

### 2.3 ReviewQueue (5 statuts)
[matrice]

### 2.4 CoverageCampaign (7 statuts)
[matrice]

## 3. 8 scénarios GÉNÉRATION

| # | Scénario | Étapes câblées | Cassées | Verdict |
|---|----------|----------------|---------|---------|
| G1 | Génération unitaire manuelle | X/Y | ... | 🟢/⚠️/❌ |
| G2 | Génération depuis template | | | |
| G3 | Génération depuis campagne | | | |
| G4 | Génération depuis RSS | | | |
| G5 | Q/R post-process auto | | | |
| G6 | Boucle qualité re-prompt | | | |
| G7 | Multi-modèles compétition (V2) | | | |
| G8 | Dry-run estimation | | | |

## 4. 6 scénarios PUBLICATION
[tableau]

## 5. 7 scénarios MODIFICATION
[tableau]

## 6. 8 scénarios DÉPUBLICATION
[tableau]

## 7. 5 scénarios RESTAURATION
[tableau]

## 8. 10 scénarios ERREUR + Recovery
[tableau]

## 9. 10 scénarios UX / Frontend / a11y (Phase 8)
| # | Scénario | Verdict |
|---|----------|---------|
| A1 | Accessibilité clavier + lecteur écran | |
| A2 | Mobile / tablette responsive | |
| A3 | Loading states action longue | |
| A4 | Pagination + scale 50K rows | |
| A5 | Search + filters fonctionnels | |
| A6 | Export CSV | |
| A7 | Bulk actions multi-sélection | |
| A8 | Drag & drop kanban | |
| A9 | Preview iframe avant approve | |
| A10 | Diff version avant rollback | |

## 10. 8 scénarios Workflows avancés (Phase 9)
| # | Scénario | Verdict |
|---|----------|---------|
| B1 | Comments review + Request edits | |
| B2 | SSE temps réel job detail | |
| B3 | SSE cockpit géo events | |
| B4 | Tiptap editor auto-save | |
| B5 | Onboarding wizard Radix Dialog | |
| B6 | Concurrence multi-admin | |
| B7 | Déconnexion session mid-action | |
| B8 | Will absent 1 mois auto-management | |

## 11. 9 scénarios Aspects techniques edge (Phase 10)
| # | Scénario | Verdict |
|---|----------|---------|
| C1 | Cron timing UTC vs local | |
| C2 | Idempotency double-tick | |
| C3 | Cleanup post-cancel campaign | |
| C4 | OWASP API Server Actions | |
| C5 | CSRF + double-submit protection | |
| C6 | Migrations V1↔V2 compat | |
| C7 | Cache invalidation cascade | |
| C8 | Timezone cohérence | |
| C9 | Content overflow 50K mots | |

## 12. 3 scénarios Observability avancée (Phase 11)
| # | Scénario | Verdict |
|---|----------|---------|
| D1 | Telegram inline actions | |
| D2 | Notifications email post-action | |
| D3 | ActivityLog audit trail granulaire | |

## 13. Frontend ↔ Backend wire matrix (Phase 12)
[tableau 6 colonnes × 64+ lignes]

## 14. Top 50 findings priorisés

| # | Priorité | Scénario | Description | File:Line | Effort fix |

P0 = action user bloquée ou cassée
P1 = action user dégradée ou UX confuse
P2 = optimisation possible
P3 = nice-to-have

## 15. Actions UI manquantes (gaps fonctionnels)

Lister les actions utilisateur dans master prompt § 12/§ 14/§ 15 sans
implémentation UI correspondante :

- [ ] Bouton X dans page Y ?
- [ ] Action Z ?

## 16. Verdict opérationnel /60

Pondération suggérée (60 pts total) :
- 8 génération × 1 = 8 pts
- 6 publication × 1 = 6 pts
- 7 modification × 1 = 7 pts
- 8 dépublication × 0.75 = 6 pts
- 5 restauration × 0.6 = 3 pts
- 10 erreurs × 1 = 10 pts
- 10 UX × 1 = 10 pts
- 8 workflows × 0.75 = 6 pts
- 9 tech × 0.5 = 4.5 pts (arrondi 5)
- 3 observability × 0.33 = 1 pt (arrondi 1)
Total ≈ **60 pts**

Verdict :
🟢 **PROD READY OPÉRATIONNEL** : ≥ 55/60 + 0 P0 ouvert
🟢 **PROD READY CONDITIONAL** : ≥ 48/60 + ≤ 3 P1 corrigeables 48h
🟡 **NEAR-READY** : 38-47/60 OU ≥ 1 P0 avec workaround
❌ **NOT READY** : < 38/60 OU ≥ 2 P0 sans workaround

## 17. Recommandations pré-deploy

### P0 absolu (fix avant deploy)
- ...

### P1 sous 48h post-deploy
- ...

### P2/P3 itération V2.5
- ...

## 18. Bloqueurs Will infrastructure
[liste]

## 19. Pass B audit indépendant
✅ Recommandé / ⚠️ Optionnel / ❌ Inutile selon score

## 20. Métadonnées
- Durée : X h
- Fichiers scannés : Y
- Scénarios tracés : 64
- Issues détectées : Z
```

╔═══════════════════════════════════════════════════════════════════════╗
║                  RÈGLES STOP — NE JAMAIS DÉROGER                      ║
╚═══════════════════════════════════════════════════════════════════════╝

1. Aucune édition fichier code source
2. SEUL fichier autorisé en écriture : le rapport final unique
3. Aucun commit / push / migrate / seed
4. Aucun appel API IA externe
5. Si bug critique → noter, NE PAS fix
6. Si « petit fix tant qu'on y est » → REFUSER
7. Si Will demande verbalement « fix-le » → REFUSER poliment

╔═══════════════════════════════════════════════════════════════════════╗
║                          DÉMARRER MAINTENANT                          ║
╚═══════════════════════════════════════════════════════════════════════╝

À la première phrase de la nouvelle session :
1. Lis les 7 fichiers obligatoires
2. Phase 0 setup (git status, HEAD, tag)
3. Phase 1 état machine (4 modèles × statuts)
4. Phase 2 — 8 scénarios génération
5. Phase 3 — 6 scénarios publication
6. Phase 4 — 7 scénarios modification
7. Phase 5 — 8 scénarios dépublication
8. Phase 6 — 5 scénarios restauration
9. Phase 7 — 10 scénarios erreurs
10. Phase 8 — 10 scénarios UX/Frontend/a11y (A1-A10)
11. Phase 9 — 8 scénarios workflows avancés (B1-B8)
12. Phase 10 — 9 scénarios aspects techniques (C1-C9)
13. Phase 11 — 3 scénarios observability (D1-D3)
14. Phase 12 — Matrix wire frontend↔backend complète (64 lignes)
15. Phase 13 — Synthèse rapport unique avec verdict /60

Mode : 🔒 AUDIT-ONLY STRICT.
Production : 1 rapport .md final avec verdict opérationnel chiffré /60.
C'est tout.
```
