# PROMPT — Implémentation P0 indexation (staged, 1 fix = 1 commit) — Axion-IA — 2026-06-05

> **Comment l'utiliser** : ouvre une **nouvelle conversation Claude Code** avec le répertoire de travail
> **`C:\Users\willi\Documents\Projets\Axion-IA\axionia`** (le dossier du code Next.js, où `src/` vit — pas la racine).
> Colle tout le bloc « PROMPT À EXÉCUTER » (à partir du `===8<===`). Le reste est le cadrage pour toi.
>
> Ce prompt **implémente** les actions **P0** du plan d'audit. Il ne refait pas l'audit : il s'appuie sur les
> livrables déjà écrits dans `_AUDIT/GSC-INDEXATION-2026-06-05/` (00-VERDICT, 02-ANOMALIES, 03-PLAN, 03b).

---

## A. Décisions arbitrées par Will (2026-06-05) — à appliquer telles quelles

- **D-1 = Geler le drip villes à la cohorte actuelle.** Stopper l'élargissement automatique `+50/jour`. Aucune ville déjà indexée ne bascule en `noindex`. Réouverture cohorte-par-cohorte plus tard, manuellement, conditionnée à l'indexation.
- **D-3 = EN : 301 1-hop comme mécanisme unique.** Retirer `Disallow: /en/` du robots.txt (gaté par `EN_LOCALE_ENABLED`) **et** supprimer les fuites `hreflang="en"`. Objectif : Google voit le 301→FR et purge l'EN. **EN n'est JAMAIS indexé** ; neutralisation **togglable** par `EN_LOCALE_ENABLED` ; **aucune suppression définitive** du code EN.
- **D-4 = og-image : aligner sur `api/og` d'abord** (fallback `runtime="nodejs"` si l'alignement ne suffit pas).
- **D-5 = Copies uniques villes (run LLM facturable) = PLUS TARD.** Interdit dans cette session.
- **Packaging = par étapes : 1 fix = 1 commit, vérification entre chaque, STOP pour validation de Will avant le suivant.**

## B. Ordre d'implémentation P0 (du plus isolé au plus structurant)

1. **P0-2** — Fix `/opengraph-image` 502 (bug fonctionnel isolé, gain rapide, risque faible).
2. **P0-3** — EN 301-unique (robots.ts + fuites hreflang dans les sitemaps images).
3. **P0-1** — Sitemap de cohorte : geler le drip villes (le levier racine).
4. **P0-4** — Forcer le crawl du Tier 0 (maillage interne ≤2 clics + IndexNow Tier 0). *(Touche le frontend → `pnpm lhci` obligatoire.)*

P1 et les actions GSC manuelles de Will (re-soumission sitemap, URL Inspection 10-20/j) seront une session/checklist séparée après validation P0.

## C. Garde-fous absolus (issus de CLAUDE.md / AGENTS.md / mémoire projet)

- **Invariant EN** : FR seul indexable, **EN jamais** ; tout patch EN reste **togglable `EN_LOCALE_ENABLED`** ; ne JAMAIS supprimer `routing.ts` locales/pathnames EN, `messages/en.json`, ni le pré-rendu EN.
- **Contrat build stub** : ne pas toucher la magic string `stub.invalid` ni `SKIP_ENV_VALIDATION` / `BULLMQ_DISABLED` (sinon build GH Actions cassé). Si un sitemap touché fait un appel DB, vérifier que le stub Proxy couvre la méthode.
- **Budgets Web Vitals** (LCP ≤1800 / INP ≤100 / CLS 0 / First Load ≤75 KB gz). Toute dégradation = **STOP & ASK Will + ADR**. `pnpm lhci` sur les étapes frontend.
- **Working tree partagé multi-sessions + `main` = deploy prod.** `git fetch` + vérifier l'état (`ahead`/`behind`) avant tout commit/push. **NE PAS push automatiquement** : commit local, puis STOP — Will valide et pushe lui-même.
- **Pas de run LLM facturable** (D-5).

---

===8<=== PROMPT À EXÉCUTER (copier à partir d'ici) ===8<===

# MISSION — Implémenter les correctifs P0 d'indexation d'Axion-IA, par étapes

Tu es ingénieur Next.js 16 / SEO technique senior. Répertoire de travail = `axionia/` (le code Next.js, `src/` ici). Tu **implémentes** les actions **P0** d'un audit d'indexation déjà réalisé. Tu travailles **une étape à la fois**, tu vérifies, tu commits, puis tu **t'arrêtes pour validation de Will** avant l'étape suivante.

## Étape 0 — Cadrage (à faire avant tout code)

1. **Lis les livrables d'audit** (ce sont ta spec) : `_AUDIT/GSC-INDEXATION-2026-06-05/00-VERDICT.md`, `02-ANOMALIES.md`, `03-PLAN-P0-P1-P2.md`, `03b-STRATEGIE-RAMP-UP.md`. Les correctifs ci-dessous référencent les IDs d'anomalies A-01…A-11 et les `fichier:ligne` qui y sont prouvés.
2. Lis `CLAUDE.md` / `AGENTS.md` (contrats build stub, EN, Web Vitals).
3. `git status` + `git fetch` : vérifie l'état du working tree (partagé multi-sessions). Note `ahead`/`behind`. **Ne pushe rien.** Si l'arbre est sale/divergent, **STOP & ASK Will** avant de commencer.
4. **Vérifie que chaque `fichier:ligne` de la spec correspond encore au code réel** (l'arbre a pu bouger depuis l'audit). Si un emplacement a dérivé, retrouve la cible par recherche et signale l'écart — ne patche pas à l'aveugle sur un numéro de ligne.
5. Annonce le plan des 4 étapes et commence par l'Étape 1.

## Règles de chaque étape (invariables)

Pour **chaque** correctif : **(a)** implémente le minimum nécessaire ; **(b)** `pnpm typecheck` + `pnpm test` (+ `pnpm lhci` si frontend touché) ; **(c)** vérifie le comportement (curl/inspection du sitemap généré quand pertinent — en local `next build && next start`, ou note la vérif post-deploy à faire par Will) ; **(d)** `git commit` **local** avec un message clair (terminer par la ligne de co-author requise) ; **(e)** **STOP** : résume ce qui a changé, le résultat des vérifs, le risque résiduel, le rollback, et **demande à Will de valider + pousser** avant de passer à l'étape suivante. **Ne pousse jamais toi-même.**

---

### ÉTAPE 1 — P0-2 : Fixer `/opengraph-image` (502 live) — anomalie A-02

- **Cible** : `src/app/opengraph-image.tsx`. Le 502 est confirmé live ; `src/app/api/og/route.tsx` répond 200 → c'est un bug spécifique au fichier `opengraph-image.tsx`.
- **Action (D-4)** : **aligner** `opengraph-image.tsx` sur l'implémentation qui marche (`api/og/route.tsx`) — runtime, imports de police/fetch, `ImageResponse`, gestion des assets. Si après alignement le 502 persiste à cause de l'edge runtime, **passer `runtime = "nodejs"`** en fallback.
- **Ne pas** casser `/api/og` (doit rester 200) ni les autres `opengraph-image` de routes spécifiques s'il y en a.
- **Vérif** : `next build` OK ; en local, requête sur `/opengraph-image` → 200 `image/png` ; `api/og` toujours 200. Note pour Will : valider en prod après deploy (`curl -I https://axion-ia.com/opengraph-image`) + LinkedIn Post Inspector.
- **Risque** : asset hors page → 0 impact Web Vitals. Si `nodejs`, surveiller le temps de génération (cache CDN).
- **Rollback** : revert du commit (retour à l'état 502 actuel, pas de régression nette).

### ÉTAPE 2 — P0-3 : EN = 301 unique (Invariant #1) — anomalies A-03 + A-04

Objectif : **EN jamais indexé, purgé proprement via 301→FR**, togglable par `EN_LOCALE_ENABLED`.

1. **robots.txt (A-03)** : dans `src/app/robots.ts` (≈ ligne 95, `dynamicDisallow`), **retirer `"/en/"`** du Disallow **uniquement quand EN est désactivé** (réutiliser `isEnLocaleDisabled()` / le flag déjà importé). Quand `EN_LOCALE_ENABLED=true`, le comportement d'origine doit revenir. But : laisser Googlebot **crawler le 301** au lieu de le bloquer.
2. **Fuites hreflang en (A-04)** : dans `src/app/sitemaps/images-fr.xml/route.ts` (≈ lignes 122-124 et 138-141), supprimer/conditionner l'émission `hreflang="en"` derrière le flag (réutiliser `filterEnIfDisabled` / l'helper existant). **Audite aussi** `sitemap-images-services.xml/route.ts`, `sitemap-images-villes-t*.xml/route.ts`, et `src/server/exporters/knowledge-sitemap.ts` pour la même fuite, et corrige-les pareil.
3. **Vérifie** qu'aucune page FR n'émet `<link rel="alternate" hreflang="en">` après patch (grep + inspection `<head>` d'une page FR rendue).
- **Invariant #2** : tout doit redevenir actif si `EN_LOCALE_ENABLED=true`. Ne supprime aucun message/route/pré-rendu EN.
- **Contrat stub** : `knowledge-sitemap.ts` a un early-exit `stub.invalid` — ne le casse pas ; ton conditionnement hreflang doit vivre **après** cet early-exit.
- **Vérif** : `pnpm typecheck`+`test` ; en local `curl /robots.txt` → plus de `Disallow: /en/` (flag off) ; `curl /sitemaps/images-fr.xml | grep 'hreflang="en'` → vide ; `curl -I /en/about` → **301 1-hop** vers l'équivalent FR ; HTML `<head>` d'une page FR sans alternate `en`. Refais un check mental avec le flag à `true` (hreflang en ré-émis, Disallow remis).
- **Rollback** : revert (remet le Disallow + hreflang).

### ÉTAPE 3 — P0-1 : Sitemap de cohorte — geler le drip villes (D-1) — anomalie A-01 (cause racine)

- **Cible** : `src/content/villes/index.ts` (logique de cohorte : `INDEXATION_START`, `VILLES_PER_DAY`, `cohortSize` ; l'audit pointe ≈ ligne 207). Les sous-sitemaps villes + meta robots + `images-villes-t*` consomment tous `isVilleIndexable` → cohérence garantie si tu modifies la **source unique** de la taille de cohorte.
- **Action (D-1 = geler à la cohorte actuelle)** : remplacer l'élargissement **calendaire** (`+VILLES_PER_DAY/jour`) par une **cohorte figée** = `max(cohorte_actuelle_au_2026-06-05, Tier_0_premium)`. Concrètement : introduire un **flag de gel** (ex. `VILLES_DRIP_FROZEN` / cohortSize plafonné) qui stoppe la croissance automatique **sans** faire basculer en `noindex` une seule ville déjà indexable aujourd'hui. La réouverture future sera **manuelle** (incrément explicite), pas temporelle.
- **⚠️ Sécurité indexation** : calcule la cohorte courante AVANT patch et garantis que l'ensemble indexable **post-patch ⊇ pré-patch** (on gèle, on ne rétracte pas). Sinon des villes déjà indexées passeraient noindex = régression SEO.
- **Vérif** : `pnpm typecheck`+`test` ; inspecter `GET /sitemap/villes-*.xml` (compte d'URLs **stable**, plus de croissance jour+1) ; `GET /fr/implantations/<ville-de-la-cohorte>` garde `index` ; une ville hors-cohorte reste `noindex`. Vérifie que le calcul ne dépend pas d'une heure de build qui dériverait (déterminisme).
- **Risque** : 0 Web Vitals (logique sitemap/meta). Risque = rétraction accidentelle → couvert par le check ⊇ ci-dessus.
- **Rollback** : restaurer la formule calendaire (revert).

### ÉTAPE 4 — P0-4 : Forcer le crawl du Tier 0 (maillage + IndexNow) — frontend → `pnpm lhci` obligatoire

- **Pré-requis** : récupère la **liste Tier 0** dans `03b-STRATEGIE-RAMP-UP.md` (~120 URLs premium). **Demande à Will de la valider (D-2)** avant de câbler le maillage si elle te semble ambiguë.
- **Action (a) Maillage ≤2 clics** : garantir que les pages Tier 0 aujourd'hui orphelines/profondes (notamment `/fr/galerie`, `/fr/methodologie`, `/fr/comparaisons`, et les pages stratégiques jamais crawlées) sont liées depuis l'accueil / `Header.tsx` / `Footer.tsx` avec des ancres descriptives. Pas de sur-maillage : liens texte pertinents.
- **Action (b) IndexNow Tier 0** : la stack image-bank ping déjà IndexNow (Bing/Yandex) — **étendre le ping aux URLs Tier 0** (uniquement des URLs **200 + index**, jamais une noindex). Localise le module de ping sous `src/server/image-bank/**` et généralise-le proprement (ou ajoute un déclencheur dédié Tier 0).
- **Vérif** : `pnpm typecheck`+`test` ; **`pnpm lhci`** (budgets WV tenus : liens texte = impact négligeable, mais on prouve) ; logs/ retour IndexNow ; chaque URL pingée est bien `200 index`.
- **Risque** : ajout de liens = vérifier CLS/First Load inchangés (lhci). IndexNow : ne jamais pinger une noindex.
- **Rollback** : retirer les liens / désactiver le ping Tier 0.

---

## Clôture

Après l'Étape 4 (et validation Will de chaque commit) :

1. Écris `_AUDIT/GSC-INDEXATION-2026-06-05/05-IMPLEMENTATION-P0-LOG.md` : ce qui a été changé (commits + `fichier:ligne`), résultats de vérif, ce qui reste **à faire côté Will** (push → deploy, puis actions GSC : re-soumettre `sitemap-index.xml`, marquer résolus les 5xx, **URL Inspection 10-20 URLs Tier 0/jour (D-6)**, surveiller la courbe « Détectée non indexée »).
2. Rappelle que **P1** (gate qualité auto régime-permanent, `X-Robots-Tag` Edge villes, `lastmod` réels, galerie accueil) et **P2** (backlinks/PR, copies villes facturables — **D-5 = plus tard**) sont des sessions ultérieures.
3. **Résume en ≤10 lignes** pour Will et **attends son go pour pousser**.

## Règles de rigueur (rappel impératif)

- **1 fix = 1 commit local + STOP.** Jamais de push automatique. `main` = deploy prod.
- **Invariant EN** (FR only, EN jamais, togglable `EN_LOCALE_ENABLED`, zéro suppression EN).
- **Contrat stub `stub.invalid`**, `SKIP_ENV_VALIDATION`, `BULLMQ_DISABLED` intacts.
- **Budgets Web Vitals** : `pnpm lhci` sur l'Étape 4 ; toute dégradation = STOP & ASK + ADR.
- **Indexation ne rétracte jamais** : aucun patch ne doit faire passer en `noindex` une URL déjà indexée/indexable (vérif ⊇ à chaque étape qui touche `isVilleIndexable`/sitemaps).
- **Pas de run LLM facturable** (copies villes = D-5 plus tard).
- Vérifie les `fichier:ligne` avant d'éditer ; si dérive, signale et réaligne.

Commence par l'**Étape 0** maintenant.

===8<=== FIN DU PROMPT À EXÉCUTER ===8<===
