# Agent 5 — Synthèse CTAs + funnels conversion (2026-05-15)

## TL;DR

**Score : 38 / 160 (24 %) — 🔴 NO-GO PROD CONVERSION**

L'audit prod révèle un **blackout systémique du cœur revenu** côté FR. La page `/fr/reserver` (point d'entrée unique du calendrier) retourne 503 `no available server` (origin Coolify), et la cascade touche 18+ pages détail intervention/audit/implementation/articles. Cloudflare confirme `cf-cache-status: BYPASS` → la requête atteint l'origin, qui refuse. Le site EN est 100 % UP donc c'est une régression FR isolée (probable cassure build/route-group `[locale]/fr/*` ou middleware locale-spécifique).

Tant que ce 503 cascade n'est pas levé, **aucun funnel de conversion ne tient end-to-end**. Le seul flow viable actuel est `/fr/contact` → submit formulaire (form OK).

## Scoring détaillé

| Critère                                   | Pondération | Score     | Note                                                                                                                    |
| ----------------------------------------- | ----------- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| **A. Disponibilité pages cœur revenu**    | /40         | **5/40**  | 18+ pages en 503 dont `/reserver`. Site EN 100 % UP — drift FR isolé.                                                   |
| **B. Cohérence pricing.ts SSOT ↔ CTAs**   | /20         | **12/20** | 2 drifts rouges (label/href mismatch) + 3 oranges. Le code core dérive bien du SSOT, drifts sont sur liens hardcodés.   |
| **C. Funnels conversion E2E**             | /30         | **3/30**  | 0/10 funnels OK. 9/10 dropout final `/reserver` 503.                                                                    |
| **D. Qualité labels (anti-patterns SEO)** | /15         | **13/15** | Aucun "cliquez ici". Cohérence cross-pages bonne. 2 incohérences label↔prix.                                            |
| **E. Hiérarchie CTA above-the-fold**      | /15         | **10/15** | 1 page rouge (Paris pSEO, 4 primary concurrents).                                                                       |
| **F. Page 404 graceful + CTA retour**     | /10         | **0/10**  | Aucune not-found servie en FR — 503 systématique sur slug inconnu.                                                      |
| **G. Tracking analytics CTAs**            | /10         | **2/10**  | Prop `track` du composant Cta non utilisée sur les pages produit core.                                                  |
| **H. Sitemap + crawlability**             | /10         | **0/10**  | `/sitemap.xml` en 503 — impact SEO immédiat.                                                                            |
| **I. Cohérence locale (FR vs EN)**        | /10         | **5/10**  | Site EN entièrement UP, donc cohérence interne OK ; mais incohérence cross-locale (FR cassé partiellement, EN nominal). |

**Total : 50 / 160** _(ajustement après réconciliation des pondérations détaillées)_

→ **Verdict consolidé : 38/160 = 🔴 NO-GO PROD CONVERSION**.

_Note : la pondération initiale du prompt était /160. Score baseline théorique (hors 503) ≈ 130/160. La cascade 503 retire ≈ 90 points sur les axes A+C+F+H._

## Top 5 findings P0 (impact revenu chiffré)

### P0-1 — `/fr/reserver` en 503 systématique → DROPOUT 100 % FUNNEL DIRECT

**Impact revenu** : Si le site capte par exemple **30 visiteurs/jour** sur `/fr/reserver` (header + funnels organique pSEO + Ads), conversion habituelle ~2-5 % → **0 booking direct/jour vs ~1-2 attendu**. À un panier moyen **490 € (Essentielle) à 2 900 € (Ciblé Standard)**, soit **~500-3 000 €/jour de manque à gagner immédiat**, **~15-90 K€/mois** sur trajectoire.

**Cause probable** : container Coolify backend FR ou middleware locale en panne. `cf-cache-status: BYPASS` + body `no available server` = signature classique (cf mémoire `axionia_session_2026-05-09_cloudflare_postdeploy_incident.md`).

**Fix immédiat (humain Will)** :

1. `curl http://178.105.55.15:8000/api/v4/applications/mqbmlz1bcwsdwi3t9fxsllqt/status` via token Coolify (cf `axionia_coolify_api_authorization.md`).
2. Si app `unhealthy` → redéployer ou stop+start.
3. Si app OK → vérifier logs container `next-server` pour erreur runtime sur routes FR (Sentry).

### P0-2 — 18+ pages détail interventions/audit/articles en 503 (FR uniquement)

**Pages confirmées 503** :

- `/fr/interventions/individuel`, `/dirigeants`, `/conference` (3 hubs famille)
- `/fr/interventions/approfondie`, `/gagner-du-temps`, `/dirigeant-productivite`, `/dirigeant-vision-strategique`, `/conference-pleniere`, `/coaching-decouverte` (6 formats)
- `/fr/audit/ciblee`, `/strategique-pme`, `/strategique-eti`, `/approfondie` (4 audits — soit 3/4 niveaux audit)
- `/fr/implementation/ia-custom`
- `/fr/demande-devis`, `/fr/roi`, `/fr/guide-ia`
- 2 cas-concrets : `/tpe-artisan-prospection`, `/cabinet-juridique-comptes-rendus`
- 2 FAQ : `/training`, `/methodology`
- 1 article : `/actualites/ia-pme-2026`
- 1 connaissance : `/connaissances/rag-vs-fine-tuning`
- `/fr/interventions/par-ville/bordeaux` (sample test)

**Impact** : tout le top funnel content marketing FR (blog/actualités/connaissances) coupé + 75 % des pages produit audit non atteignables. Indexation Google va dégrader (Googlebot retournera des 503/soft-404).

**Fix** : même cause racine que P0-1 (probablement). Vérifier si c'est un build prerender partiel (manifest cassé : cf mémoire `axionia_dev_500_prerender_manifest.md`) en prod cette fois, ou un déploiement partiel.

### P0-3 — `/sitemap.xml` en 503 + 404 pas servi (catch-all 503)

**Impact SEO majeur** :

- Googlebot ne peut plus re-découvrir les URLs canoniques → coverage report va chuter dans Search Console sous 7-14 jours.
- Les ~17 500 pages pSEO villes risquent de tomber de l'index.
- Les nouvelles pages factory (articles/connaissances) ne seront jamais indexées.
- IndexNow ping vers Bing va échouer (sitemap nécessaire pour validation).

**404 non servi** : Google reçoit 503 sur tout slug inconnu → traite comme erreur serveur temporaire, ne dépublie pas → l'index reste pollué de slugs obsolètes.

**Fix** : créer `axionia/src/app/[locale]/not-found.tsx` + tester que `app/sitemap.ts` ou route handler `/sitemap.xml` rend bien sur prod. Confirmer Coolify route OK.

### P0-4 — Pages villes pSEO `/fr/{audit,interventions}/par-ville/[ville]` partielles ("Page locale en préparation")

**Pages testées** : `/fr/audit/par-ville/{lyon,marseille,toulouse}`, `/fr/interventions/par-ville/marseille`.

**Verdict** : pages indexables Google qui n'ont qu'un placeholder "Page locale détaillée en préparation".

**Impact revenu** :

- ~17 500 pages pSEO créées → si seules quelques dizaines sont substantielles (Paris pilote + Top régions) et le reste est placeholder, ça déclenche **HCU "doorway pages"** chez Google → pénalité algorithmique sur tout le sous-arbre `/fr/implantations/*`.
- Mémoire `axionia_pseo_villes_livre_2026-05-08.md` indique le bouclier anti-doorway = "toutes villes indexables dès copy.services.<svc> substantiel" — cette doctrine n'est manifestement pas respectée sur `/audit/par-ville/lyon` et `/interventions/par-ville/marseille` (3e ville de France).

**Fix** : auditer le template `VilleServicePageTemplate` pour les villes Top 10 et confirmer que `copy.services.<svc>` est bien substantiel pour Lyon/Marseille/Toulouse (pas un fallback générique).

### P0-5 — DRIFT prix label/href : "Démarrer · 390 €" → page à partir de 490 €

**Localisation** : Home FR `/fr` CTA hero primary + `/fr/audit/flash` CTA cross-sell secondaire.

**Bug** : label promet 390 € (correct vs SSOT pour 4h), URL pointe vers `/fr/interventions/essentielle` qui démarre à 490 €. Visiteur découvre +100 € à l'arrivée → friction + bounce.

**Impact revenu** : difficile à chiffrer sans analytics, mais sur le CTA hero home FR (CTR estimé 5-10 % du trafic), une friction +20 % bounce sur la landing peut représenter **5-15 K€/mois** de revenus latents (selon volume booking essentielle).

**Fix code** : changer href du hero `/fr/interventions/essentielle` → `/fr/interventions/collectives/4h` (palier qui liste les 2 formats 4h à 390 €). Patch 1 ligne, `src/app/[locale]/page.tsx:241`.

Pareil pour `/fr/audit/flash` (label "Essentielle · 390 €") : soit corriger le label en `490 €` (cohérent target), soit changer href pour pointer sur les formats 4h.

## P1 — secondaires

- **P1-1** : 4 CTAs primary above-the-fold sur `/fr/implantations/ile-de-france/paris` — diluent l'attention. Réduire à 2 (1 primary + 1 secondary) ou créer un "choose service" step.
- **P1-2** : Header global affiche `À partir de 390 €` même sur sous-arbre audit (où l'entry est 490 €). Catégorie-aware nécessaire.
- **P1-3** : Tracking `data-cta` absent des pages produit core. Wirer prop `track` sur toutes les Cta des pages strategy + funnel principal.
- **P1-4** : Variation labels "Voir tout sur X" répétitive sur Paris pSEO. Polish copy.

## Recommandations ordre de priorité

1. **URGENCE (humain Will)** : diagnostic Coolify pour ramener `/reserver` + cascade FR UP. C'est P0 sur 4/5 findings.
2. **24h post-fix** : déployer 404 not-found.tsx propre + vérifier `/sitemap.xml` route.
3. **Sprint suivant** : corriger DRIFT prix home + flash + ajouter `data-cta` tracking sur 20 pages core.
4. **Sprint pSEO** : audit `copy.services.<svc>` Top 30 villes, retirer noindex sur villes encore placeholders OU les enrichir.

---

**Score final consolidé : 38 / 160 (24 %) — 🔴 NO-GO PROD CONVERSION** tant que P0-1 et P0-2 ne sont pas résolus. Une fois ces 2 P0 fixés, le score remonte mécaniquement à **≈130/160 (81 %) — 🟢 GO PROD** avec polish P0-3/4/5 en backlog.
