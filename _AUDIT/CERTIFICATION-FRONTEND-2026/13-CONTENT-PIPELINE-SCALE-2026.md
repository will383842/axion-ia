# 13 — CONTENT PIPELINE SCALE 2026 (100-300 URLs/jour)

> **Audit critique scale** : pipeline éditorial automatisé pour publier 100-300 nouvelles URLs/jour de manière sûre, qualité-gated, indexable, anti-doorway HCU, multilingue FR/EN.
> Lancer fenêtre fraîche depuis `Axion-IA/axionia/`.

## 0. Contexte

AxionIA va passer de **4 342 HTML statiques actuels** à un rythme de **100-300 nouvelles URLs/jour** :

- 36 500 à 109 500 nouvelles URLs/an
- 100K-300K URLs cumulées à année 3
- Source : industrialisation pSEO villes (toutes communes >5K hab) + futurs blog/cas-concrets/glossaire

À cette échelle, **0 humain dans la boucle de chaque page**. Tout doit être automatisé, qualité-gated, et conforme HCU/RGPD.

## 1. Mission

Auditer le pipeline éditorial bout-en-bout et proposer un plan complet pour :

1. Publier 100-300 URLs/jour sans intervention humaine sur 99 % d'entre elles (1 % review humain via sampling).
2. Garantir 0 risque pénalité HCU (anti-doorway, contenu unique, valeur ajoutée).
3. Indexer rapidement (IndexNow + sitemap split + Search Console API).
4. Maintenir Lighthouse 100 sur sample aléatoire des nouvelles pages.
5. Rollback automatisé si quality score dégrade.
6. Multilingue FR/EN sans blocage.

## 2. Audit en 8 chapitres × 10 critères = 80 points

### Chapitre 1 — Source de contenu

1.1 Source identifiée et documentée (DB Postgres ? fichiers MDX ? API externe ?)
1.2 Schéma de données contenu validé (Zod) — champs requis : slug, locale, region, ville, copy.{pitchFr,pitchEn,longFormFr,longFormEn,faqFr,faqEn}, lastmod, author, status
1.3 Versioning du contenu (history, rollback)
1.4 Fallback si source indisponible (graceful degrade vs 503)
1.5 Authentification source (token, IAM)
1.6 Validation FR + EN obligatoires avant publish (pas de page mono-langue qui shippe)
1.7 Source supporte 100K+ rows sans dégradation perf
1.8 Contenu enrichi : geo, demographics, B2B local, ecosystem (pas juste copy générique)
1.9 Source idempotente (republish même contenu = aucun side-effect)
1.10 Logs source ingest (qui, quand, quoi)

### Chapitre 2 — Génération du contenu (AI ou éditorial)

2.1 Stratégie identifiée : génération AI (Claude API ? GPT ? local ?), éditorial humain, ou hybride
2.2 Si AI : prompt système versionné dans `lib/ai/prompts/` (pas hardcodé)
2.3 Si AI : modèle utilisé documenté + ADR (coût + qualité + latence)
2.4 Si AI : seed/temperature/top_p contrôlés pour reproductibilité
2.5 Si AI : prompt enrichi des données ville (INSEE, B2B local, géo) — pas générique
2.6 Translation FR↔EN automatisée (DeepL API gratuit jusqu'à 500K chars/mois OU Claude API)
2.7 Translation post-édit humain sur sample 1 % (qualité)
2.8 Coût par page calculé (cible : < $0.05/page si AI)
2.9 Cache des générations (republish = pas de re-call AI)
2.10 Quota daily configuré (max 500 pages/jour pour absorber pics)

### Frontière avec audit 23 (Quality Automation)

> **13 cible le pipeline workflow** (génération → validation → publish → indexation). **23 cible le quality gate post-publish** (sampling Lighthouse, RUM aggregation, anomaly detection, rollback). La validation pré-publish (chapitre 3 ci-dessous) est **opérée par 13** mais **monitorée par 23**. Si conflit → 23 fait foi pour les seuils chiffrés (cf. README Thresholds canoniques).

### Chapitre 3 — Quality gate (anti-doorway HCU)

3.1 Min word count par page indexable (≥ 800 mots gold standard)
3.2 Uniqueness score vs corpus existant (Jaccard / cosine similarity ≥ 0.7 distinct)
3.3 Détection contenu dupliqué (paragraphes copiés-collés multi-villes)
3.4 Lecture grade FR : Flesch-Kincaid ≥ 60 (lisible général)
3.5 Présence des données locales spécifiques (population, code postal, dépt, géo)
3.6 Présence FAQ géolocalisée (≥ 3 questions spécifiques)
3.7 Présence cas concrets ou ecosystem local (signal E-E-A-T)
3.8 Anti-keyword stuffing (densité < 3 % par mot-clé)
3.9 Score global qualité ≥ seuil → publish ; sinon → noindex + queue review humain
3.10 Logs quality score historisés (pour analyse anomalies)

### Chapitre 4 — Workflow publish

4.1 Trigger : cron (ex. toutes les 6h) ou webhook source contenu
4.2 Idempotence : republish = OK, pas de duplication
4.3 Atomicité : publish = transaction (DB + sitemap + cache invalidation atomic)
4.4 Rollback : si publish casse Lighthouse / erreur indexation → revert auto
4.5 Throttle : max N pages/heure (éviter saturer crawler / Cloudflare)
4.6 Notification : log Slack/Telegram des publishes (volume, success rate)
4.7 Dry-run mode (preview sans publish réel)
4.8 Pages publiées dans les 2 locales (FR + EN) en transaction
4.9 Lastmod sitemap auto-mis-à-jour (signal fraîcheur Google)
4.10 Healthcheck post-publish : page rendue 200 OK + JSON-LD valide

### Chapitre 5 — Cache invalidation & ISR

5.1 Stratégie ISR Next 16 documentée (`revalidate` ou `revalidatePath`/`revalidateTag`)
5.2 Cloudflare Cache Rules : pages dynamiques `s-maxage=600 swr=86400`
5.3 Purge Cloudflare per URL via API (gratuit jusqu'à 1000 purges/jour)
5.4 Purge par tag (Cloudflare Enterprise only — alternative : purge per URL)
5.5 Sitemap : revalidation auto à chaque publish
5.6 Routes parents (ex. `/implantations/ile-de-france`) re-rendered si enfant change
5.7 Stale-while-revalidate actif côté Cloudflare
5.8 ETag/Last-Modified cohérents post-publish
5.9 Header `X-Robots-Tag` cohérent (noindex retiré au publish réel)
5.10 Tests automatisés : after publish, page accessible < 30 sec via Cloudflare

### Chapitre 6 — Indexation push

6.1 Sitemap split actif (max 50K URLs par sitemap, sitemap-index)
6.2 Sitemap auto-régénéré à chaque publish (pas une fois par jour)
6.3 IndexNow API ping à chaque publish (Bing + Yandex + DuckDuckGo)
6.4 Search Console URL Inspection API : sample 10 % nouvelles URLs (quota 600/jour)
6.5 Search Console Indexing API : si applicable (Job Posting, Live Stream — pas notre cas)
6.6 robots.txt allow/disallow cohérent (ne pas bloquer accidentellement)
6.7 Crawl budget : `crawl-delay` Bingbot configuré si abus
6.8 Sitemap soumis dans Search Console + Bing Webmaster Tools
6.9 Lien interne vers nouvelle page depuis hub indexable (ex. région)
6.10 Monitoring : % pages indexées via Search Console API (cible ≥ 80 % à 30 jours)

### Chapitre 7 — Quality automation post-publish

7.1 Lighthouse sampling : 1 % des nouvelles pages auditées chaque jour
7.2 Sample stratifié (par région, par type) — pas uniquement ville pilote
7.3 Anomaly detection : page avec LCP > 4s, CLS > 0.25, score < 80 → alerte
7.4 RUM data per route : agrégation auto (CrUX-style interne)
7.5 Per-route bundle size monitoring (delta > +10 KB → alerte)
7.6 Per-route HTML size monitoring (delta > +50 % → alerte)
7.7 Per-route 4xx/5xx monitoring (taux > 1 % → alerte)
7.8 Indexation monitoring (page non indexée à J+30 → alerte + investigation)
7.9 Rank tracking sample (top 100 mots-clés cibles) — Search Console API gratuit
7.10 Dashboard `/admin/pseo-stats` (Sprint 20) : volume, qualité, indexation, traffic

### Chapitre 8 — Page lifecycle management

8.1 Statut page : `draft / published / depublished / archived` documenté
8.2 Depublish : 410 Gone (pas 404) + sitemap removal + Cloudflare purge
8.3 Archived : noindex + redirect 301 si remplacement
8.4 City devenue inéligible (ex. < 5K hab) : workflow depublish auto
8.5 Slug change : 301 from old to new (Cloudflare redirect rule ou middleware)
8.6 Translation deprecated : graceful fallback à l'autre locale
8.7 Lifecycle logs : qui a depublié quoi quand et pourquoi
8.8 Bulk depublish : safe (max N par exécution + dry-run)
8.9 Recovery : page archivée → restorable sous 24h
8.10 GDPR : right-to-be-forgotten (si applicable au contenu)

## 3. Méthode (5 phases)

### Phase A — Inventaire (lecture seule)

1. Lister tous les emplacements de contenu (`data/villes.ts`, `data/regions.ts`, `data/blog/`, etc.)
2. Mesurer le volume actuel (4 342 HTML connus)
3. Identifier les sources de génération existantes (manuel ? script ? AI ?)
4. Identifier le mécanisme de publish (build SSG seulement ? ISR ?)
5. Mesurer cache invalidation actuelle (Cloudflare Cache Rules ? purge auto ?)

### Phase B — Diagnostic (scoring /80)

Évaluer chaque critère 0/0,5/1.

### Phase C — Plan pipeline cible

- Architecture cible (DB Postgres pour contenu ? Fichiers Git pour static ? Hybride ?)
- Choix AI vs éditorial vs hybride (avec coûts)
- Choix translation (DeepL gratuit 500K chars/mois OU Claude API $3-15/M tokens)
- Choix orchestrateur publish (cron Coolify ? GitHub Actions ? worker BullMQ Sprint 18 ?)
- Stratégie cache + ISR Next 16
- Stratégie indexation (IndexNow + sitemap split)
- Stratégie quality gate (Zod + uniqueness + lighthouse sampling)
- Stratégie monitoring (dashboard `/admin/pseo-stats` Sprint 20)
- Stratégie lifecycle (publish/depublish/archived)

### Phase D — STOP & ASK

**N'applique RIEN.** Livre :

- `_AUDIT/CERTIFICATION-FRONTEND-2026/audit-13-content-pipeline-SYNTHESE.md`
- `_AUDIT/CERTIFICATION-FRONTEND-2026/audit-13-content-pipeline-DIAGNOSTIC.md`
- `_AUDIT/CERTIFICATION-FRONTEND-2026/audit-13-content-pipeline-PLAN.md`
- `_AUDIT/CERTIFICATION-FRONTEND-2026/audit-13-content-pipeline-RUNBOOK.md` (procédure ops)

Liste les **15 STOP & ASK** prévisibles (choix AI, choix DB schema, choix orchestrateur, etc.).

### Phase E — Application après GO Will

Patches en vagues V1-V5 :

- V1 : Schema contenu DB + migration (Sprint 15 prep)
- V2 : Generation pipeline (AI ou éditorial selon choix)
- V3 : Quality gate Zod + uniqueness check
- V4 : Publish workflow (cron + ISR + Cloudflare purge + IndexNow)
- V5 : Quality automation post-publish + dashboard

## 4. Contraintes

- 100 % outils OSS / Free tier / Hetzner CX32 + Cloudflare Free
- Pas de Stripe (NO-STRIPE.md)
- Si AI utilisé : Claude API ou DeepL API (à coût documenté + STOP & ASK)
- Doctrine v3 visuelle figée
- Anti-doorway HCU obligatoire
- Sprint 15 backend nécessaire pour DB-driven content (sinon stay file-based)

## 5. Cible chiffrée

> _« Le pipeline génère, valide, publie, indexe et monitore 200 nouvelles URLs/jour FR+EN sans intervention humaine, avec quality score moyen ≥ 85/100, indexation à J+30 ≥ 80 %, Lighthouse moyen sur sample ≥ 95, et 0 page anti-HCU shippée. »_

## 6. STOP & ASK obligatoires

1. Avant de choisir source contenu (DB vs MDX vs API)
2. Avant de choisir stratégie génération (AI vs éditorial)
3. Avant d'intégrer Claude API ou DeepL (coût + secrets)
4. Avant de toucher au sitemap actuel
5. Avant d'intégrer IndexNow API
6. Avant de configurer Search Console API
7. Avant de modifier Cloudflare Cache Rules
8. Avant tout patch infra (Caddyfile, Coolify cron)
9. Avant ajout dépendance npm
10. Avant tout commit
11. Avant migration Prisma (si DB-driven)
12. Avant tout coût récurrent additionnel
13. Si quality gate rejette > 30 % des pages générées (signal qualité source)
14. Si Lighthouse moyen drops > 10 pts post-rollout
15. Si indexation drops > 20 % vs baseline

## 6bis. Anti-patterns à éviter (Pitfalls)

- ❌ Pipeline sans quality gate (1 mauvaise série = pénalité HCU sur tout le site)
- ❌ Translation auto sans glossaire (« cabinet IA opérationnel » mal traduit)
- ❌ Publish atomique non-idempotent (republish duplique)
- ❌ Manque de throttle (saturer Cloudflare 1000 purges/jour gratuit)
- ❌ Lastmod hardcodé build time (Google détecte fraîcheur fake)
- ❌ Industrialiser avant Paris pilote validé (contre la doctrine projet)
- ❌ AI generation sans seed/temperature contrôlés (pas reproductible)
- ❌ Ignorer le sample manuel humain (1 % review obligatoire)

## 7. Livrables attendus

```
_AUDIT/CERTIFICATION-FRONTEND-2026/
├── audit-13-content-pipeline-SYNTHESE.md
├── audit-13-content-pipeline-DIAGNOSTIC.md  (per-criterion 0/0.5/1)
├── audit-13-content-pipeline-PLAN.md  (architecture cible + patches)
└── audit-13-content-pipeline-RUNBOOK.md  (procédure ops + monitoring)
```

## 8. Mémoire

Crée `axionia_audit_content_pipeline_YYYY-MM-DD.md` (memory) + ajoute ligne dans `MEMORY.md`.

---

**FIN DU PROMPT 13.**
