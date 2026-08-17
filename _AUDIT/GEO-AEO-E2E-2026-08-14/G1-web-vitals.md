# G1 — Budgets Web Vitals : pages stratégiques vs seuils AGENTS.md, et lien perf ↔ budget de crawl

**Date d'exécution** : 2026-08-15, 01:05 → 01:20 UTC.
**Mode** : AUDIT-ONLY STRICT. Aucune écriture hors `_AUDIT/GEO-AEO-E2E-2026-08-14/`,
aucun build, aucun `next dev`, aucun Lighthouse local, aucune suite de tests,
aucun POST/PUT/DELETE, aucune soumission d'URL. Prod : GET/HEAD uniquement.

**Fenêtre de mesure** : les déploiements ont atterri à 14:57, 18:26 et ~19:50 UTC
le 2026-08-14 (run `31830868520`, job `deploy` terminé à **19:49:58 UTC**). Toutes
mes mesures live sont postérieures à **01:05 UTC le 2026-08-15**, soit **> 5 h 15
après le dernier atterrissage**. Aucun constat ci-dessous n'est imputable à une
fenêtre ISR post-deploy ni au contrat `stub.invalid`.

## Périmètre réellement couvert

| Item de mission | Couvert | Méthode |
|---|---|---|
| Les « 15 pages stratégiques » vs budgets AGENTS.md | ✅ | 21 URLs sondées en HTTP + confrontation aux 3 listes concurrentes du dépôt |
| LCP / INP / CLS / TBT en **lab** | ⚠️ partiel | Interdit en local (machine de Will). Exploité : artefacts lhci CI réels (run `31830868520`), configs, doctrines |
| **First Load JS ≤ 75 KB gz** | ✅ | mesure directe : somme des `<script src>` du HTML servi, re-compressés + relevé `size-limit` réel de la CI |
| Réalité des gates (lhci PR, lhci post-deploy, size-limit, nightly) | ✅ | lecture des workflows + logs GH Actions réels des runs du 2026-08-14 |
| Monitoring terrain (RUM p75) | ⚠️ partiel | code lu et validé ; **valeurs p75 en base non lisibles** (accès DB non autorisé pour G1) |
| Lien perf ↔ budget de crawl | ✅ | poids brotli réellement transféré, composition des documents, TTFB origin vs edge, TTFB UA Googlebot |

**Rapports recoupés AVANT de mesurer** : `G3-isr-caches.md` (course `lhci`⇄`warm`,
Cloudflare qui réécrit `max-age`, cache ISR éphémère), `G4-mobile-a11y.md` (cécité
mobile des gates, PNG lourds, LCP mesuré 756–792 ms), `G2-rendu-sans-js.md`,
`F1-probe-http.md`, `00-CONTEXT-DIGEST.md`. Les constats transverses (a)…(e) du
digest ne sont **pas** re-découverts ici ; je les cite quand ils expliquent un
résultat.

---

## Résumé exécutif

Les budgets Web Vitals d'AGENTS.md ne sont **pas tenus** et, surtout, **ne sont
mesurés par rien qui bloque**. Le seul gate réellement bloquant (lhci post-deploy)
couvre **5 URLs**, en **desktop seul**, **sans assertion INP** — alors qu'AGENTS.md
annonce 15 pages, un INP ≤ 100 ms et deux gates PR bloquants. Ces deux gates PR
sont en `continue-on-error` depuis mai/juillet, et `size-limit` **était rouge sur
3 buckets sur 7** dans la CI du 2026-08-14 sans rien bloquer (`134,87 kB` vs
100 kB ; `606,92 kB` vs 75 kB ; **2 globs qui ne matchent plus aucun fichier**
depuis la suppression de `/reserver` le 2026-06-26). Mesuré en prod : le
**First Load JS est de ~240 KB gz sur 100 % des routes** (278 KB avec les
polyfills `noModule`), soit **×3,2 le budget de 75 KB gz**, avec un socle partagé
identique partout et un chunk de page de 0,8 à 3 KB. Côté crawl : **11+ URLs
publiques stratégiques sont rendues dynamiquement** (`Cache-Control: private,
no-store`, `cf-cache-status: BYPASS`) malgré leur `export const revalidate` —
dont `/fr/avis`, `/fr/galerie`, `/fr/observatoire-ia`, `/fr/appel`, `/fr/presse`,
`/fr/carrieres`, `/fr/avis/ville/*` et `/fr/blog/page/*` — avec un TTFB de
157 à 1 078 ms contre 29–66 ms sur les pages en cache. Le correctif de l'audit
GSC du 2026-07-31 (retrait de `await searchParams`) a été appliqué à `/blog` et
`/cas-concrets` puis **jamais propagé**. Enfin, les deux pages les plus lourdes
du site (`/fr/implantations` : **625 KB brotli, 24 752 nœuds DOM** ; `/fr/faq` :
**299 KB brotli, 13 170 nœuds**) ne figurent dans aucune liste de gate, et les
audits `dom-size` / `dom-size-insight` sont explicitement désactivés dans
`lighthouserc.json` — l'angle mort est verrouillé par la configuration.

---

## Findings

### [P0] Les deux gates de budget annoncés « bloquants » dans AGENTS.md ne bloquent rien — et `size-limit` est rouge sans conséquence

**Symptôme.** `AGENTS.md` (racine du dépôt) affirme : « Lighthouse CI (`pnpm lhci`)
gate les PR. Bundle delta gate (`size-limit`) bloque les PR avec > +5 KB gz vs
`main`. » Dans la CI réelle, les deux steps portent `continue-on-error: true`, et
`size-limit` a échoué sur 3 buckets sur 7 lors du dernier run PR sans faire
échouer quoi que ce soit.

**Preuve code.**
- `AGENTS.md:21` — la promesse (« Lighthouse CI (`pnpm lhci`) gate les PR.
  Bundle delta gate (`size-limit`) bloque les PR avec > +5 KB gz vs `main`. »).
- `.github/workflows/ci.yml:276-278` — step `Bundle size (reporting — gate
  per-route = Lighthouse)` → `continue-on-error: true`.
- `.github/workflows/ci.yml:279-291` — step `Bundle delta vs main (reporting)`
  → `continue-on-error: true` **+** `timeout-minutes: 6` posé exprès pour que
  l'action échoue vite (commentaire `:281-286`). Le delta de +5 KB n'est donc
  jamais calculé de bout en bout sur ~17,9 k pages SSG.
- `.github/workflows/ci.yml:296-317` — step `Lighthouse CI` →
  `continue-on-error: true` depuis le 2026-07-01, commentaire explicite : « Le
  gate lhci PR-time est cassé de façon chronique ».
- `package.json:239-249` — deux buckets `size-limit` pointent
  `.next/static/chunks/app/**/reserver/**` alors que la page `/reserver` a été
  **supprimée le 2026-06-26** (`next.config.ts:280-289`, redirection 301 vers
  `/appel`). `package.json:223` (`_size_limit_doctrine`) parle encore de
  « 110 KB sur /reserver ».

**Preuve live (CI, horodatée).** Run `31825377760`, job Gate B (`94852231187`),
step `Bundle size`, sortie du **2026-08-14 18:13:12 UTC** :

```
Shell partagé (framework + main + webpack + polyfills) — cible ≤ 100 KB gz cumulé
  Package size limit has exceeded by 34.87 kB
  Size limit:  100 kB     Size: 134.87 kB brotlied
Routes /reserver (exception calendrier — 110 KB gz cumulé)
  Size Limit can't find files at .next/static/chunks/app/**/reserver/**/page-*.js
Routes /reserver — chunks dynamiques (Calendar SSR=false)
  Size Limit can't find files at .next/static/chunks/app/**/reserver/**/*.js
Pages standard (toutes routes hors /reserver) — page chunks individuels
  Package size limit has exceeded by 531.92 kB
  Size limit:  75 kB      Size: 606.92 kB brotlied
Routes /galerie …            Size limit: 75 kB   Size:  2.44 kB brotlied
Routes /implantations hub …  Size limit: 72 kB   Size:  3.38 kB brotlied
Widget chatbot (T-08) …      Size limit: 30 kB   Size:  4.49 kB brotlied
```

Conclusion du job : `success` (Gate B vert, PR mergeable).

**Root-cause.** Trois couches de neutralisation empilées, chacune justifiée
localement par un commentaire, jamais réconciliées avec la promesse d'AGENTS.md :
(1) le gate lhci PR-time est cassé au niveau de l'environnement CI (`next start`
ne bind pas sur loopback) et a été passé en reporting plutôt que réparé ;
(2) `size-limit` a été laissé mal calibré (les buckets « par route » somment tout
un glob) donc rendu non bloquant ; (3) les 3 buckets **verts** ne mesurent que le
chunk-feuille de la route (2,44 / 3,38 / 4,49 kB) et **ne peuvent structurellement
pas rougir** — ils donnent l'illusion d'une couverture. C'est le cas d'école de
la règle maison « une garde ne vaut que si elle rougit ».

**Patch prescrit.**
1. Corriger d'abord la documentation pour qu'elle cesse de mentir : dans
   `AGENTS.md`, remplacer les deux phrases par l'état réel (« le seul gate
   bloquant est le lhci **post-deploy** sur 5 URLs prod ; les gates PR sont en
   reporting »). C'est le patch le moins risqué et le plus urgent.
2. Supprimer les 2 buckets `/reserver` de `package.json:238-249` et créer un
   bucket `/appel` (`.next/static/chunks/app/**/appel/**/page-*.js`) — sinon
   l'exception d'AGENTS.md n'a aucun support technique.
3. Recalibrer le bucket « Shell partagé » sur son coût réel constaté
   (134,87 kB brotli) puis le **ratcheter à la baisse** ; le repasser bloquant
   une fois seulement le seuil aligné (sinon on rouvre un rouge permanent).
4. Ne PAS repasser `Lighthouse CI` PR-time en bloquant tant que le bind loopback
   CI n'est pas réparé — ce serait un rouge systématique. Renforcer plutôt le
   gate post-deploy (voir finding suivant).

**Effort** : S (1–2) / M (3–4). **Impact GEO/AEO** : moyen en direct, **fort en
prévention** — c'est ce qui a laissé passer les findings P0/P1 suivants.
**Risque de régression** : faible pour 1-2 ; **moyen** pour 3 (un ratchet mal
posé bloque toutes les PR). **Do-not-touch** : `.github/workflows/ci.yml:255-262`
(bloc `BUILD_SSG_VILLES_INDEXABLE_ONLY` / ENOSPC), `package.json:224`
(`running:false`, sinon `size-limit` relance Chrome et fait SIGTERM Gate B).

---

### [P0] First Load JS ≈ 240 KB gz sur 100 % des routes, soit ×3,2 le budget de 75 KB gz — et aucune gate ne le mesure

**Symptôme.** Chaque page publique charge 20 à 24 fichiers JavaScript pour un
total de **269 à 305 KB gz**, dont ~38,6 KB de polyfills `noModule` (non
téléchargés par les navigateurs modernes). Le **First Load JS effectif est donc
de ~237 à ~267 KB gz**, contre un budget AGENTS.md de **75 KB gz**. Le chunk
propre à la route ne pèse que 0,8 à 3,0 KB : la totalité du dépassement est dans
le socle partagé, identique sur toutes les pages.

**Preuve code.**
- `AGENTS.md:17` — « **First Load JS** ≤ 75 KB gz / route (cible V6) ».
- `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md:47` et suivants — `initial_kb_gzip: 75`
  répété sur 13 routes.
- `package.json:250-258` — le seul bucket `size-limit` censé couvrir « toutes
  routes hors /reserver » ne mesure que les `page-*.js`, c'est-à-dire **les
  chunks-feuilles**, pas le socle : il ne peut pas voir ce dépassement (il en
  voit un autre, factice, par sommation de glob — cf. finding précédent).

**Preuve live (horodatée 2026-08-15 01:08:38 UTC, puis détail 01:09 UTC).**
Décomposition de `https://axion-ia.com/fr` (21 fichiers, `TOTAL <script src> gz =
278,3 KB`) :

| gz | brut | attribut | fichier |
|---:|---:|---|---|
| 68,0 KB | 293,7 KB | `async` | `/_next/static/chunks/18966-8be3fe38add1b188.js` |
| 61,4 KB | 195,5 KB | `async` | `/_next/static/chunks/e5f456b7-e637271fd2966e03.js` (React) |
| 38,6 KB | 110,0 KB | **`noModule`** | `/_next/static/chunks/polyfills-42372ed130431b0a.js` |
| 14,6 KB | 60,4 KB | `async` | `/_next/static/chunks/37177-…js` |
| 12,7 KB | 38,7 KB | `async` | `/_next/static/chunks/48974-…js` |
| 12,5 KB | 42,1 KB | `async` | `app/[locale]/layout-ff07a1f4…js` |
| 12,0 KB | 40,3 KB | `async` | `/_next/static/chunks/93107-…js` |
| 10,6 KB | 31,7 KB | `async` | `/_next/static/chunks/39398-…js` |
| … | | | 13 autres chunks de 0,4 à 8,5 KB |
| **2,4 KB** | 6,3 KB | `async` | **`app/[locale]/page-1cd7b18c…js` (la page elle-même)** |

Sur `/fr/implantations/ile-de-france/paris` le total est de **275,6 KB gz** avec
un chunk de route de **0,8 KB** ; sur `/fr/appel`, **278,9 KB gz** avec 3,0 KB de
route. Le socle est donc rigoureusement le même partout.

Relevé sur les 21 pages sondées (01:08:38 UTC) : minimum **269,4 KB gz**
(`/fr/tarifs`, `/fr/observatoire-ia`), maximum **305,3 KB gz** (`/fr/simulateur`).
**Zéro page sous le budget.**

**Root-cause.** Le budget de 75 KB gz est une cible « V6 » (`_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md:25`,
« Applicable post-V6 ») qui n'a jamais été atteinte, et le tableau de trajectoire
de ce même document (`:255-269`) partait de ~1 000 KB **non compressés**. Deux
chunks concentrent 129,4 KB gz à eux seuls (`18966` et `e5f456b7`) : `e5f456b7`
est le runtime React, incompressible ; **`18966` (68,0 KB gz / 293,7 KB brut) est
le vrai levier et n'a jamais été analysé** — aucun rapport du dépôt ne l'identifie.

**Patch prescrit.**
1. **Diagnostic d'abord, pas de patch à l'aveugle** : lancer
   `ANALYZE=true pnpm build` (ou `@next/bundle-analyzer`) **en CI**, jamais sur la
   machine de Will, pour identifier le contenu de `18966-*.js`. Suspects à
   vérifier en priorité au vu des `preconnect` servis (`src/app/[locale]/layout.tsx`) :
   SDK Sentry, `web-vitals/attribution`, Turnstile, et toute librairie tirée par
   un `"use client"` monté dans le layout racine (donc présent sur 100 % des pages).
2. Tout composant client du layout racine qui n'est pas nécessaire au premier
   rendu doit devenir une île `dynamic(..., { ssr: false })` chargée à l'idle —
   le widget chatbot le fait déjà correctement (4,49 kB, cf. log CI).
3. Aligner ensuite le budget affiché sur une trajectoire crédible (ex. 150 KB gz
   en palier 1) plutôt que de conserver un 75 KB décoratif.

**Effort** : L. **Impact GEO/AEO** : **fort** — le JS pèse sur TBT/INP, donc sur
l'expérience de page, et alourdit chaque fetch de crawler qui exécute le JS (les
crawlers IA ne l'exécutent généralement pas, mais Googlebot si).
**Risque de régression** : **fort** si on déplace des composants du layout — le
JSON-LD des ~4 300 pages villes est déjà en `strategy="afterInteractive"`
(constat transverse (b) du digest) : **toute île déplacée ou différée doit être
vérifiée contre G2** sous peine de retirer du JSON-LD au rendu.
**Do-not-touch** : `src/app/[locale]/layout.tsx:262` (bloc preconnect Turnstile
documenté), `src/components/analytics/WebVitals.tsx` (source de vérité RUM,
cf. dernier finding), `package.json:22` (`_browserslist_doctrine`).

---

### [P1] 11+ URLs publiques stratégiques sont rendues dynamiquement (`no-store`, BYPASS) malgré leur `revalidate` — le correctif de l'audit GSC 2026-07-31 n'a jamais été propagé

**Symptôme.** Une partie des pages les plus « GEO » du site (avis, galerie,
observatoire, presse, carrières, pagination blog, facettes avis par ville) sont
recalculées **à chaque requête**, servies avec `Cache-Control: private, no-cache,
no-store, max-age=0, must-revalidate`, jamais mises en cache à l'edge Cloudflare
(`cf-cache-status: BYPASS`), et sans en-tête `x-nextjs-cache`. Leur `export const
revalidate` est **mort**. TTFB constaté : **157 à 1 078 ms** contre **29 à 66 ms**
sur les pages effectivement en cache.

**Preuve code.**
- Le mécanisme est **déjà documenté et déjà corrigé ailleurs** :
  `src/app/[locale]/blog/page.tsx:9-15` — « Audit indexation GSC 2026-07-31
  (P1 « BYPASS /fr/blog ») — cette route ne lit PLUS `searchParams` :
  `await searchParams` forçait un rendu DYNAMIQUE à chaque requête malgré
  `revalidate` (Next émettait `Cache-Control: private, no-store` →
  `cf-cache-status: BYPASS` mesuré en prod, origin tapé à froid par tous les
  crawls du hub) ». Même correctif à `src/app/[locale]/cas-concrets/page.tsx:94`.
- Routes **non corrigées**, qui `await searchParams` dans le composant de page :
  - `src/app/[locale]/avis/page.tsx:66` (`revalidate = 3600`) puis `:180` (`await searchParams`)
  - `src/app/[locale]/galerie/page.tsx:227` (`revalidate = 60`) puis `:51` et `:125`
  - `src/app/[locale]/observatoire-ia/page.tsx:57` puis `:98`
  - `src/app/[locale]/roi/page.tsx:89` puis `:119`
  - `src/app/[locale]/simulateur/page.tsx:30` puis `:56`
  - `src/app/[locale]/appel/page.tsx:30` puis `:78`
  - également listées par le même motif : `presse/page.tsx`, `carrieres/page.tsx`,
    `recherche/page.tsx`, `demande-devis/page.tsx`, `interventions/demande/page.tsx`
- **Commentaire faux à corriger** : `src/app/[locale]/galerie/page.tsx:225` —
  « La page lit `searchParams` (module/page) donc Next.js applique le cache par
  variante de query ». La mesure live dit l'inverse : `no-store`, aucun cache.
- Deuxième famille, sans `searchParams` : routes à segment dynamique **sans
  `generateStaticParams`** — `src/app/[locale]/avis/ville/[ville]/page.tsx:21`
  (`revalidate = 3600`, aucun `generateStaticParams`) et
  `src/app/[locale]/blog/page/[num]/page.tsx:13`. Ce dernier porte pourtant le
  commentaire `:9-12` « Route ISR : rendue à la demande puis cacheable à l'edge
  comme toute page du site » — **démenti par la mesure**.

**Preuve live (horodatée).** Sonde du 2026-08-15 **01:10:41 UTC** (en-tête
`x-nextjs-cache`) et **01:12:13 UTC** (TTFB + `Cache-Control`) :

| URL | TTFB | `cf-cache-status` | `x-nextjs-cache` | `Cache-Control` |
|---|---:|---|---|---|
| `/fr` | 159 ms | HIT | HIT | `s-maxage=3600, stale-while-revalidate=…` |
| `/fr/formations` | 47 ms | HIT | HIT | `s-maxage=3600, …` |
| `/fr/glossaire` | 46 ms | HIT | HIT | `s-maxage=3600, …` |
| `/fr/guides` | 40 ms | HIT | HIT | `s-maxage=3600, …` |
| **`/fr/appel`** | **1 078 ms** | **BYPASS** | *(absent)* | **`private, no-cache, no-store, max-age=0, must-revalidate`** |
| **`/fr/presse`** | **433 ms** | BYPASS | *(absent)* | `private, no-store, …` |
| **`/fr/blog/page/2`** | **341 ms** | BYPASS | *(absent)* | `private, no-store, …` |
| **`/fr/roi`** | 263 ms | BYPASS | *(absent)* | `private, no-store, …` |
| **`/fr/carrieres`** | 239 ms | BYPASS | *(absent)* | `private, no-store, …` |
| **`/fr/galerie`** | 228 ms | BYPASS | *(absent)* | `private, no-store, …` |
| **`/fr/observatoire-ia`** | 221 ms | BYPASS | *(absent)* | `private, no-store, …` |
| **`/fr/avis`** | 218 ms | BYPASS | *(absent)* | `private, no-store, …` |
| **`/fr/avis/ville/paris`** | 215 ms | BYPASS | *(absent)* | `private, no-store, …` |
| **`/fr/simulateur`** | 202 ms | BYPASS | *(absent)* | `private, no-store, …` |
| **`/fr/recherche`** | 187 ms | BYPASS | *(absent)* | `private, no-store, …` |

En-têtes bruts de `/fr/avis` (01:11 UTC) — `curl -sI` :
`Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` +
`Set-Cookie: NEXT_LOCALE=fr` + `Set-Cookie: __Host-authjs.csrf-token=…` +
`Set-Cookie: __Secure-authjs.callback-url=…` + `cf-cache-status: BYPASS`.
À comparer à `/fr` (01:11 UTC) : `Cache-Control: s-maxage=3600,
stale-while-revalidate=31532400`, `x-nextjs-cache: HIT`, `x-nextjs-prerender: 1`,
`Age: 2150`, `cf-cache-status: HIT`, **aucun `Set-Cookie`**.

Avec un UA Googlebot (01:12 UTC, 3 requêtes consécutives) :
`/fr/avis` = 202 / 184 / 177 ms ; `/fr/appel` = 213 / 168 / 157 ms ;
`/fr` = 68 / 67 / 59 ms. Le surcoût est structurel, pas un cold-start : **chaque
passage de crawler sur ces URLs traverse l'origine Hetzner et déclenche un rendu
serveur complet**.

**Root-cause.** Deux causes distinctes, même symptôme.
(1) `await searchParams` dans le composant de page opte la route hors du rendu
statique : Next émet alors `no-store` et Cloudflare passe en BYPASS. Diagnostic
posé le 2026-07-31, corrigé sur 2 routes, **jamais balayé sur les autres**.
(2) Un segment dynamique sans `generateStaticParams` (`avis/ville/[ville]`,
`blog/page/[num]`) n'entre dans aucun prerender manifest et retombe dans le même
régime. **[À CONFIRMER]** sur le mécanisme interne Next 16 exact pour la
famille (2) — l'observable et le code sont, eux, doublement prouvés.
Note : les `Set-Cookie` d'Auth.js (`__Host-authjs.csrf-token`) posés sur ces
réponses publiques interdiraient de toute façon la mise en cache edge, même si
le `Cache-Control` était corrigé — c'est un second verrou à lever, déjà
diagnostiqué dans `lighthouserc.json:69` pour `/fr` (qui, lui, est depuis passé
en HIT).

**Patch prescrit.**
1. Balayage systématique : `grep -rl "searchParams" --include=page.tsx src/app/[locale]/`
   hors `(admin)` → 20 fichiers. Pour chacun, appliquer le patron déjà validé sur
   `/blog` : déplacer l'état dans le **chemin** (`/blog/page/[num]`) ou dans un
   composant **client** (filtrage CSS, comme `cas-concrets`), et retirer
   `await searchParams` du composant serveur. Priorité GEO :
   `/avis`, `/avis/ville/[ville]`, `/galerie`, `/observatoire-ia`, `/presse`,
   `/carrieres`. Les pages purement transactionnelles (`/appel`, `/roi`,
   `/simulateur`, `/demande-devis`) peuvent rester dynamiques si Will le veut,
   mais alors **le retirer explicitement de la liste des « pages stratégiques »**
   plutôt que de laisser un `revalidate` mort.
2. Ajouter `generateStaticParams` (liste statique, **sans lecture DB** pour rester
   compatible avec le contrat `stub.invalid`) à `avis/ville/[ville]` ; pour
   `blog/page/[num]`, pré-générer un plancher (pages 2 à 5) et laisser
   `dynamicParams = true` couvrir le reste.
3. Corriger le commentaire mensonger `galerie/page.tsx:225` et celui de
   `blog/page/[num]/page.tsx:9-12` dans le même patch.

**Effort** : M par route, L pour l'ensemble. **Impact GEO/AEO** : **fort** — TTFB
×3 à ×20 sur des pages d'entité (avis, presse, carrières, observatoire), coût de
crawl direct sur l'origine, et impossibilité pour Cloudflare de servir ces pages
aux crawlers IA.
**Risque de régression** : **moyen**. Retirer `searchParams` casse tout filtre
serveur qui en dépend (galerie : `module=`, observatoire : filtres) → il faut
basculer le filtrage côté client ou en segments de chemin, et **vérifier les
redirections existantes** (`/fr/galerie/audits` → 307 vers
`/fr/galerie?module=audits`, mesuré 01:12:13 UTC — ce 307 casserait).
**Do-not-touch** : `src/lib/prisma.ts` et le contrat `stub.invalid`
(un `generateStaticParams` qui lit la DB rendrait `[]` au build) ; les deux listes
du job `warm` (`.github/workflows/deploy-coolify.yml:747` et `:778`) — **toute
route repassée en ISR doit y être ajoutée**, règle déjà actée en mémoire (#599).

---

### [P1] Le seul gate bloquant mesure 5 URLs, en desktop seul, **sans assertion INP**, et 26 secondes après l'atterrissage

**Symptôme.** `AGENTS.md:11-17` annonce des budgets sur « les **15 pages
stratégiques** » incluant `INP ≤ 100 ms`. Le seul gate qui peut faire échouer un déploiement
mesure 5 URLs, uniquement en preset **desktop**, et sa configuration d'assertion
**ne contient aucune assertion INP**. Google indexe mobile-first : on gate
précisément ce que Google ne regarde pas.

**Preuve code.**
- `.github/workflows/deploy-coolify.yml:600-606` — les 5 URLs : `/fr`,
  `/fr/formations`, `/fr/audit`, `/fr/contact`,
  `/fr/implantations/ile-de-france/paris`.
- `.github/workflows/deploy-coolify.yml:607` —
  `LH_SETTINGS=(--settings.preset=desktop --settings.throttlingMethod=devtools)`.
  Le drapeau CLI **écrase** le `settings: [{preset:desktop},{preset:mobile}]` de
  `lighthouserc.json:21`. Le preset mobile n'existe donc que dans le gate PR…
  qui est non bloquant (finding P0 n°1).
- `lighthouserc.postdeploy.json:13-36` — l'`assertMatrix` complet ne contient que
  `categories:performance`, `largest-contentful-paint`,
  `cumulative-layout-shift`, `total-blocking-time`,
  `first-contentful-paint`, `speed-index`. **`interaction-to-next-paint` est
  absent des deux branches.**
- `lighthouserc.json:32` — dans le gate PR, l'INP est en `warn` à 80 ms, jamais
  en `error` : **aucune configuration du dépôt n'assertit l'INP en erreur.**
- `lighthouserc.json:41-42` — `dom-size-insight: "off"` et `dom-size: "off"` :
  l'audit qui aurait détecté les 24 752 nœuds de `/fr/implantations` (voir
  finding suivant) est explicitement désactivé.
- `.github/workflows/deploy-coolify.yml:554-559` — le job `lhci` déclare
  `needs: deploy`, **exactement comme le job `warm`** (`:714-717`).

**Preuve live (horodatée).** Run `31830868520` (dernier déploiement de la
journée) :
- job `deploy` terminé à **19:49:58 UTC** ;
- jobs `lhci`, `warm`, `indexnow` démarrés **tous les trois à 19:50:00 UTC**
  (parallélisme confirmé, recoupe le P0 de `G3-isr-caches.md`) ;
- première requête Lighthouse sur `https://axion-ia.com/fr` à **19:50:26 UTC**,
  soit **28 secondes après l'atterrissage** — c'est-à-dire au moment précis où
  l'application sert encore sa version bâtie sous `stub.invalid` ;
- le gate a mesuré 5 URLs × 2 runs et conclu à **20:00:32 UTC** :
  `Checking assertions against 5 URL(s), 10 total run(s)` → `All results
  processed!` → job **success**, sans aucune assertion en échec.

**Root-cause.** Le gate a été conçu comme un filet anti-cold-start (d'où la passe
de chauffe jetable, `:619`) et non comme une mesure de l'état stationnaire. Il
mesure donc un état que **personne ne voit** : ni le visiteur (qui arrive sur du
cache chaud), ni l'état repeuplé par l'ISR. Le desktop-only et l'absence d'INP
sont des choix de commodité (`lighthouserc.json:74` justifie le `warn` INP par
`auditRan=0` sur des pages statiques) jamais rattrapés par une mesure terrain
bloquante.

**Patch prescrit.**
1. **Découpler l'ordonnancement** : faire dépendre `lhci` de `warm`
   (`needs: [deploy, warm]`) au lieu de `deploy`. Effet double : le gate mesure
   l'état réellement servi, **et** il cesse de refiger la version stub à l'edge —
   c'est le même patch que celui prescrit par `G3-isr-caches.md`, à ne
   **compter qu'une fois** dans le plan.
2. Ajouter un second passage `--settings.preset=mobile` sur les mêmes 5 URLs,
   d'abord en **reporting** (`|| true` + upload d'artefact) pendant 2 semaines
   pour établir une base, puis en `error` sur LCP/CLS/TBT.
3. Ajouter `"interaction-to-next-paint": ["error", {"maxNumericValue": 200}]`
   (seuil Google « good », pas la cible interne de 100) dans les deux branches
   de `lighthouserc.postdeploy.json` — un seuil réaliste qui rougit vraiment vaut
   mieux qu'une cible interne non assertée.
4. Étendre la liste à `/fr/implantations` et `/fr/faq` (les deux pages les plus
   lourdes, voir finding suivant) et à `/fr/appel` (la page d'exception, qui
   n'est mesurée par **rien**).

**Effort** : S (1, 3) / M (2, 4). **Impact GEO/AEO** : **fort** — c'est la
condition pour que tous les autres findings perf deviennent détectables.
**Risque de régression** : **moyen à fort** sur les points 2 et 4 : ajouter des
URLs et un preset mobile va très probablement faire **rougir immédiatement** le
gate post-deploy et **bloquer les déploiements**. → **Introduire en reporting
d'abord, ratcheter ensuite.** Le point 1 allonge la pipeline de ~8 min (durée
du job `warm` mesurée : 19:50:00 → 19:58:27 UTC).
**Do-not-touch** : `lighthouserc.postdeploy.json:15` et `:26` (l'exception
CLS ≤ 0,1 sur `/fr/audit` est un artefact cold-lab documenté et vérifié sur
2 déploiements — ne pas la « corriger ») ; `lighthouserc.json:69` (doctrine
`deprecations` OFF, cause Cloudflare, non corrigeable côté app) ;
`lighthouserc.json:78` (`lcp-discovery-insight` OFF, faux positif hero mobile).

---

### [P1] Les deux pages les plus lourdes du site ne sont dans aucune gate, et l'audit qui les aurait détectées est désactivé

**Symptôme.** `/fr/implantations` pèse **640 527 octets réellement transférés en
brotli** pour un seul document HTML, avec **24 752 nœuds DOM**, **2 279 liens**
et **112 693 mots**. `/fr/faq` pèse **306 396 octets brotli** pour
**13 170 nœuds** et **1 663 liens**. Ni l'une ni l'autre n'est mesurée par le
gate post-deploy, ni par le gate PR (`lighthouserc.json:4-17`), ni par le nightly.

**Preuve code.**
- `lighthouserc.json:4-17` — les 12 URLs du gate PR : ni `/fr/implantations`
  (le **hub**, seul `/fr/implantations/<region>/<ville>` y figure) ni `/fr/faq`.
- `.github/workflows/deploy-coolify.yml:600-606` — les 5 URLs du gate bloquant :
  idem.
- `lighthouserc.json:41-42` — `"dom-size-insight": "off"` et `"dom-size": "off"`.
  L'audit Lighthouse qui échoue au-delà de 1 400 nœuds est éteint. Justification
  au `:77` : « audits expérimentaux qui retournent score=0 quand notApplicable ».
  La justification vaut pour `dom-size-insight` (Lighthouse 12+), **pas** pour
  `dom-size`, qui est un audit stable et non expérimental.

**Preuve live (horodatée 2026-08-15 01:14:14 UTC).** `curl -H "Accept-Encoding: br"`,
octets réellement transférés :

| URL | brotli transféré | liens `<a>` | nœuds DOM ~ | mots ~ | CSS inline (brut) | charge RSC (brut) |
|---|---:|---:|---:|---:|---:|---:|
| `/fr/implantations` | **640 527 o** | 2 279 | **24 752** | 112 693 | 228,6 KB | 4 958,4 KB |
| `/fr/faq` | **306 396 o** | 1 663 | **13 170** | 41 887 | 228,6 KB | 1 395,7 KB |
| `/fr/audit` | 189 110 o | 144 | 2 216 | 3 110 | 228,6 KB | 1 328,6 KB |
| `/fr/formations` | 187 478 o | 154 | 1 850 | 3 115 | 228,6 KB | 1 295,9 KB |
| `/fr/appel` | 157 233 o | 462 | 1 409 | 893 | 230,5 KB | 1 315,1 KB |
| `/fr` | 131 262 o | 166 | 2 370 | 4 997 | 228,6 KB | 1 096,7 KB |
| `/fr/avis` | 108 516 o | 130 | 1 601 | 2 684 | 228,6 KB | 966,2 KB |
| `/fr/implantations/…/paris` | 100 522 o | 109 | 1 017 | 1 746 | 228,6 KB | 890,5 KB |

Le TTFB de `/fr/implantations` reste bon (231 ms, mesuré 01:13 UTC) parce qu'il
est en cache edge — mais le **transfert** de 625 KB et surtout le **parsing de
24 752 nœuds** sont subis par chaque visiteur et chaque crawler.

**Root-cause.** Le hub `/fr/implantations` liste apparemment l'intégralité des
communes en une seule page (2 279 liens, 112 693 mots). C'est un choix de
maillage interne (cf. `C4-maillage-interne.md`) dont le coût perf n'a jamais été
mesuré parce que la page n'est dans aucune liste de gate et que l'audit `dom-size`
est éteint. Le seuil « `initial_kb_uncomp: 250` » de
`_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md:167` pour `/implantations` ne concerne
que le JS, pas le document.

**Patch prescrit.**
1. Réactiver **`dom-size`** seul (laisser `dom-size-insight` OFF, sa justification
   est valable) en `warn` d'abord, puis en `error` — sinon la régression restera
   invisible même après correction.
2. Paginer ou hiérarchiser `/fr/implantations` : servir les régions et les villes
   T1/T2 dans le document, et renvoyer le reste vers les pages régionales
   `/fr/implantations/[region]` (qui existent déjà). Objectif : < 1 500 nœuds et
   < 120 KB brotli, aligné sur les autres hubs.
3. Ajouter `/fr/implantations` et `/fr/faq` aux URLs du gate post-deploy
   (en reporting d'abord, cf. finding précédent).

**Effort** : S (1, 3) / M (2). **Impact GEO/AEO** : **moyen à fort**. Attention :
le point 2 **retire des liens internes** — c'est exactement la surface de
`C4-maillage-interne.md`.
**Risque de régression** : **fort** sur le point 2 → tout retrait de liens du hub
doit être arbitré avec C4 et D4 (profondeur de clic des pages villes, doorway-risk
HCU). **STOP & ASK Will** avant d'y toucher : la découvrabilité des ~4 300 pages
villes en dépend potentiellement.
**Do-not-touch** : `lighthouserc.json:77-78` (doctrines des insights
expérimentaux), les sitemaps villes (A2/A4).

---

### [P1] ~90 % du poids de chaque document est de la charge utile non-contenu (payload RSC + CSS inlinée) — taxe directe sur le budget de crawl

**Symptôme.** Sur une page ville, le document HTML fait 1 237,3 KB bruts, dont
**890,5 KB de charge RSC** (`self.__next_f.push`) et **228,6 KB de CSS inlinée** :
il ne reste **~118 KB de balisage réel** pour **1 746 mots** de contenu. Le ratio
est identique partout, la CSS inlinée pesant **228,6 KB bruts sur absolument
chaque page** (230,5 KB sur `/fr/appel`).

**Preuve code.**
- `next.config.ts:213-215` — `inlineCss: true` (« Natif Next 16 — pas de dep
  externe (vs `optimizeCss` …) »). Conséquence : aucune mise en cache navigateur
  de la CSS entre deux pages, et 228,6 KB rejoués à chaque navigation **et à
  chaque fetch de crawler**.
- Mesure croisée : la sonde du 01:10:41 UTC ne trouve **aucun**
  `<link rel="stylesheet">` sur les 21 pages (`cssFiles = 0` partout), ce qui
  confirme que la totalité de la CSS passe en inline.

**Preuve live (horodatée 2026-08-15 01:08:38 UTC et 01:14:14 UTC).**

| URL | HTML brut | dont charge RSC | dont CSS inline | balisage restant | mots |
|---|---:|---:|---:|---:|---:|
| `/fr/implantations/…/paris` | 1 237,3 KB | 890,5 KB | 228,6 KB | ~118 KB | 1 746 |
| `/fr/avis` | 1 433,8 KB | 966,2 KB | 228,6 KB | ~239 KB | 2 684 |
| `/fr` | 1 709,7 KB | 1 096,7 KB | 228,6 KB | ~384 KB | 4 997 |
| `/fr/audit` | 2 115,2 KB | 1 328,6 KB | 228,6 KB | ~558 KB | 3 110 |
| `/fr/implantations` | 8 586,1 KB | 4 958,4 KB | 228,6 KB | ~3 399 KB | 112 693 |

**Traduction en budget de crawl** : une page ville coûte **98 KB brotli** à
Googlebot (mesure directe, 01:13 UTC) pour livrer 1 746 mots exploitables. Sur les
~4 300 pages villes, une passe de crawl complète représente **~420 Mo** transférés
dont l'essentiel n'est pas du contenu. Pour les moteurs de réponse qui n'exécutent
pas le JS, la charge RSC est du bruit pur — d'autant que le JSON-LD est en
`afterInteractive` sur ces pages (constat transverse (b) du digest, détaillé par
G2) : le crawler paie le poids du payload **sans** en retirer les données
structurées.

**Root-cause.** La charge RSC est structurelle à l'App Router (arbre React
sérialisé pour l'hydratation) : elle n'est pas supprimable, mais elle est
**proportionnelle au nombre et à la taille des frontières de composants clients**.
La CSS inlinée est, elle, un choix explicite (`inlineCss: true`) qui échange un
aller-retour bloquant contre 228,6 KB non cachables sur chaque page — un bon
arbitrage pour une visite unique, un mauvais pour un crawl de 4 300 URLs et pour
la navigation multi-pages.

**Patch prescrit.**
1. **Mesurer avant d'arbitrer** : comparer, en CI, LCP/FCP avec `inlineCss: true`
   vs `false` sur les 5 URLs du gate. Si le gain LCP est < 100 ms, repasser à
   `false` : la CSS externe redevient cachable et on économise ~228 KB bruts par
   page crawlée. **Ne pas basculer sans cette mesure** — le réglage a
   probablement été posé pour une bonne raison.
2. Réduire les frontières `"use client"` sur les gabarits pSEO (pages villes) :
   c'est le levier qui réduit à la fois la charge RSC et le First Load JS
   (finding P0 n°2). Un même chantier sert les deux.
3. Traiter en priorité `/fr/implantations` (finding précédent) : à lui seul il
   représente 4 958 KB de charge RSC.

**Effort** : M (1) / L (2). **Impact GEO/AEO** : **moyen** — pas de perte de
visibilité directe, mais un budget de crawl payé en pure perte, dans un contexte
où F7 mesure le crawl réel et où la production de contenu est à l'arrêt depuis le
2026-07-20 (constat (c)).
**Risque de régression** : **fort** sur le point 1 — passer `inlineCss` à `false`
réintroduit une requête bloquante avant le premier rendu et peut faire échouer les
assertions `first-contentful-paint ≤ 1500` / `speed-index ≤ 2500` du gate
post-deploy. **STOP & ASK Will + ADR** conformément à AGENTS.md.
**Do-not-touch** : `next.config.ts:155-215` (bloc `experimental` — le
`webpackBuildWorker` voisin est verrouillé par le retour d'expérience OOM du
2026-08-12, ne pas y toucher au passage).

---

### [P2] Le document désigné comme « source de vérité » des budgets est périmé sur 4 points

**Symptôme.** `AGENTS.md:23` désigne `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md`
comme source de vérité. Ce document, daté du 2026-05-08, budgète des routes
supprimées et pointe un domaine mort.

**Preuve code.**
- `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md:200-209` — budget `/reserver`,
  route **supprimée le 2026-06-26** (`next.config.ts:280-289`).
- `:57-67` — budget `/interventions` ; `:90-99` — budget `/audit/flash`.
- `:248` et `:284-307` — URLs `https://staging.axionia.eu` et `https://axionia.eu`
  (le domaine de production est `axion-ia.com` depuis longtemps).
- `:295-307` — 13 URLs `/en/*` dans la config Lighthouse proposée, alors que le
  locale EN est désactivé (décision actée 1).
- Divergence interne : `AGENTS.md:19` nomme l'exception **`/appel`** (correct),
  le document SSOT nomme **`/reserver`** (`:196-209`).

**Preuve live (horodatée 2026-08-15 01:09 UTC).**
`GET /fr/reserver` → **308** → `https://axion-ia.com/fr/appel`.
`GET /fr/interventions` → **308** → `https://axion-ia.com/fr/formations`.

**Root-cause.** Document d'audit figé au 2026-05-08 promu au rang de SSOT sans
processus de mise à jour ; les refontes d'offre de juin-juillet ne l'ont pas
traversé.

**Patch prescrit.** Mettre à jour le document : substituer `/appel` à `/reserver`,
`/formations` à `/interventions`, `axion-ia.com` à `axionia.eu`, retirer le bloc
EN, et retirer `/audit/flash` s'il n'existe plus. **Ou** — plus honnête —
déclasser ce fichier en archive et faire d'`AGENTS.md` le SSOT unique, en y
inscrivant la liste nominative des pages stratégiques (aujourd'hui absente du
dépôt sous forme exploitable : 3 listes concurrentes de 5, 12 et 14 routes).
**Effort** : S. **Impact GEO/AEO** : faible en direct, moyen en prévention.
**Risque de régression** : nul (document). **Do-not-touch** : ne pas modifier les
seuils eux-mêmes dans le même patch — cela relève d'un ADR.

---

### [P2] `nightly.yml` mesure `/fr/reserver`, une redirection 308 — et en mode avertissement

**Symptôme.** Le commentaire du gate post-deploy affirme que les Web Vitals de
`/reserver` « restent couverts par `nightly.yml` ». Le nightly mesure en réalité
une URL qui répond 308, et ses assertions ne bloquent rien.

**Preuve code.**
- `.github/workflows/deploy-coolify.yml:598-599` — « Les Web Vitals de
  `/reserver` restent couverts par `nightly.yml` ».
- `.github/workflows/nightly.yml:272` — `--url=https://axion-ia.com/fr/reserver`.
- `.github/workflows/nightly.yml:279` —
  `pnpm exec lhci assert || echo "::warning::LHCI assertions failed (history mode)"`
  → mode historique, non bloquant.
- `.github/workflows/nightly.yml:251` — `if: vars.NIGHTLY_LHCI_ENABLED != 'false'`
  (désactivable par variable de dépôt).

**Preuve live (horodatée 2026-08-15 01:09 UTC).** `GET /fr/reserver` → 308 →
`/fr/appel`.

**Root-cause.** La suppression de `/reserver` (2026-06-26) n'a pas été propagée au
nightly. Lighthouse suit la redirection, donc il mesure de fait `/fr/appel` — mais
en pénalisant l'audit `redirects`, ce que `lighthouserc.json:67` documente
justement comme un motif d'exclusion d'URL.

**Patch prescrit.** Remplacer `/fr/reserver` par `/fr/appel` dans
`nightly.yml:272`. **Effort** : S. **Impact GEO/AEO** : faible.
**Risque de régression** : nul (job non bloquant). **Do-not-touch** : le reste du
job `lighthouse-history`, dont le `upload --target=temporary-public-storage`
constitue la seule série temporelle Lighthouse existante.

---

### [P2] Les budgets sont écrits « gz » et mesurés en brotli ; trois buckets `size-limit` ne peuvent pas rougir

**Symptôme.** Tous les budgets d'AGENTS.md et de `package.json` sont libellés
« KB **gz** ». `size-limit` mesure et affiche « **brotlied** ». Le brotli étant
~10 à 20 % plus compact que gzip, le seuil réellement appliqué est plus permissif
que le seuil écrit. Par ailleurs, 3 buckets sur 7 mesurent des chunks-feuilles de
2 à 4 kB face à des limites de 30 à 75 kB : ils sont verts par construction.

**Preuve code.** `package.json:227-282` (7 buckets, tous libellés « gz »),
`AGENTS.md:17` (« ≤ 75 KB gz »).

**Preuve live (CI, 2026-08-14 18:13:12 UTC, run `31825377760`).** Chaque ligne de
sortie est suffixée `brotlied`. Buckets structurellement verts : `/galerie`
2,44 kB / 75 kB ; `/implantations` 3,38 kB / 72 kB ; `chatbot-widget` 4,49 kB /
30 kB.

**Root-cause.** `@size-limit/preset-app` mesure en brotli par défaut ; les libellés
n'ont jamais été rectifiés. Les buckets par route ne capturent que le chunk propre
à la page, or dans cette application ce chunk fait 0,8 à 3 KB (mesure du finding
P0 n°2) — la totalité du poids est dans le socle partagé.

**Patch prescrit.** Renommer les buckets en « br » (ou forcer `gzip: true`), et
remplacer les 3 buckets par route par un unique bucket « socle partagé + vendors »
qui reflète le vrai First Load. **Effort** : S. **Impact GEO/AEO** : faible en
direct. **Risque de régression** : faible tant que le step reste
`continue-on-error`. **Do-not-touch** : `package.json:224` (`running:false`).

---

### [P2] La doctrine browserslist affirme avoir « tué » les polyfills legacy, qui sont toujours émis

**Symptôme.** `package.json:22` (`_browserslist_doctrine`) annonce des cibles
« modern-only pour **KILLER** les polyfills legacy générés par Next 16 / SWC ».
Le bundle `polyfills-*.js` est toujours produit et référencé sur toutes les pages,
à **110,0 KB bruts / 38,6 KB gz**.

**Preuve live (horodatée 2026-08-15 01:09 UTC).**
`/_next/static/chunks/polyfills-42372ed130431b0a.js` — 110,0 KB bruts, 38,6 KB gz,
présent sur `/fr`, `/fr/implantations/ile-de-france/paris` et `/fr/appel`.

**Nuance importante — ce n'est PAS un coût réel pour les visiteurs.** L'attribut
`noModule` fait que les navigateurs modernes ne téléchargent ni n'exécutent ce
fichier ; il est également exclu de la métrique « First Load JS » de Next. Le
défaut est donc **documentaire** : la doctrine décrit un résultat qui n'a pas été
obtenu, ce qui peut induire en erreur une future analyse de bundle (c'est
exactement le piège qui m'aurait fait annoncer 278 KB gz au lieu de 240).

**Patch prescrit.** Corriger le texte de `package.json:22` (« polyfills confinés
au chemin `noModule`, non téléchargés par les cibles modernes » plutôt que
« killés »). **Ne pas** tenter de supprimer le bundle : Next l'émet
inconditionnellement. **Effort** : S. **Impact GEO/AEO** : nul.
**Risque de régression** : nul.

---

### [P2] Aucune image ne porte `fetchpriority="high"` — le levier LCP restant après le préchargement

**Symptôme.** Sur `/fr` et sur les pages villes, l'image héros **est** correctement
préchargée (`<link rel="preload" as="image" imageSrcSet=…>`) et n'est pas en
`loading="lazy"`, mais **aucune** balise `<img>` du site ne porte
`fetchpriority="high"`.

**Preuve live (horodatée 2026-08-15 01:09 UTC).** `/fr` : 58 `<img>`, dont 57 en
`loading="lazy"`, **0 en `fetchpriority="high"`**. `/fr/implantations/…/paris` :
20 `<img>`, 19 lazy, 0 high. Le préchargement héros est bien présent sur les deux
(`home-hero-equipe.avif`, `villes-hero/paris.avif`).

**Root-cause.** `next/image` n'émet `fetchpriority="high"` que si `priority` est
posé sur le composant ; ici le préchargement vient d'un `<link>` manuel, ce qui
couvre la découverte mais pas la priorisation de la file réseau.

**Patch prescrit.** Poser `priority` sur le composant `next/image` du héros (ce qui
génère à la fois le preload **et** `fetchpriority="high"`) et retirer le `<link
rel="preload">` manuel devenu redondant. **Effort** : S. **Impact GEO/AEO** :
faible. **Risque de régression** : **moyen** — un preload manuel dupliqué avec
celui de `next/image` provoque un double téléchargement ; le retrait du `<link>`
manuel doit être fait dans le **même** patch.
**Complémentarité** : `G4-mobile-a11y.md` mesure un LCP réel de 756–792 ms en
mobile — le gain attendu ici est marginal, à traiter **après** les PNG lourds
identifiés par G4 (logo Qualiopi 1,27 Mo, avatar 1,44 Mo), qui pèsent bien plus.

---

## Points sains (à ne pas « corriger »)

- **Le monitoring terrain RUM existe et ses seuils sont exacts.**
  `src/server/queue/workers/content-web-vitals-monitor-worker.ts:65-67` applique
  `LCP: 1800`, `INP: 100`, `CLS: 0.01` — strictement les budgets d'AGENTS.md,
  avec un minimum de 5 échantillons par (url, metric) pour la fiabilité du p75
  (`:75`) et un cron quotidien à 02:30 UTC. Le piège de couplage au kill switch
  de génération de contenu a été **identifié et corrigé le 2026-08-03**
  (`:102-117`) : la mesure tourne désormais même quand la production de contenu
  est en pause — ce qui est le cas depuis le 2026-07-20 (constat (c)). C'est la
  seule source de vérité *terrain* du projet et elle est saine.
- **Les préchargements de polices sont bien émis partout**, y compris sur les
  pages rendues dynamiquement : sur `/fr/appel` ils passent par l'en-tête HTTP
  `Link: </_next/static/media/…-s.p.woff2>; rel=preload; as="font"` et non par une
  balise `<link>` dans le HTML (vérifié `curl -sI`, 01:10:55 UTC). **Une sonde qui
  ne lit que le HTML conclut à tort à leur absence** — piège signalé ici pour les
  agents H.
- **Le TTFB des pages en cache est excellent** : 29 à 66 ms sur 15 des 21 URLs
  sondées, y compris avec un UA Googlebot (`/fr` : 59–68 ms).
- Le chunk du widget chatbot est correctement isolé hors First Load (4,49 kB
  brotli, log CI 18:13:12 UTC) — le patron d'île différée existe déjà dans le
  projet et sert de modèle au patch P0 n°2.

---

## Mesures brutes

### Sonde 1 — 21 pages, poids et scripts (2026-08-15 **01:08:38 UTC**)

| URL | statut | TTFB | cf | HTML brut | HTML gz | scripts | **JS gz** | RSC inline gz |
|---|---:|---:|---|---:|---:|---:|---:|---:|
| `/fr` | 200 | 159 ms | HIT | 1 709,7 KB | 237,0 KB | 21 | **278,3 KB** | 170,6 KB |
| `/fr/formations` | 200 | 47 ms | HIT | 2 041,3 KB | 282,4 KB | 21 | **277,2 KB** | 218,0 KB |
| `/fr/audit` | 200 | 48 ms | HIT | 2 115,2 KB | 283,4 KB | 22 | **290,3 KB** | 215,6 KB |
| `/fr/implementation` | 200 | 35 ms | HIT | 2 079,4 KB | 283,5 KB | 21 | **277,2 KB** | 217,0 KB |
| `/fr/cas-concrets` | 200 | 29 ms | HIT | 1 136,0 KB | 174,2 KB | 21 | **277,7 KB** | 130,4 KB |
| `/fr/methodologie` | 200 | 37 ms | HIT | 1 197,6 KB | 181,6 KB | 21 | **275,6 KB** | 135,7 KB |
| `/fr/comparaisons` | 200 | 35 ms | HIT | 1 121,9 KB | 171,9 KB | 21 | **275,3 KB** | 128,6 KB |
| `/fr/stack-ia` | 200 | 42 ms | HIT | 1 344,8 KB | 198,0 KB | 21 | **275,3 KB** | 142,9 KB |
| `/fr/implantations` | 200 | 136 ms | HIT | **8 586,1 KB** | **795,4 KB** | 21 | **277,2 KB** | 481,2 KB |
| `/fr/implantations/ile-de-france/paris` | 200 | 41 ms | HIT | 1 237,3 KB | 187,9 KB | 21 | **275,6 KB** | 137,4 KB |
| `/fr/appel` | 200 | **1 078 ms** | BYPASS | 2 038,5 KB | 241,0 KB | 21 | **278,9 KB** | 190,9 KB |
| `/fr/contact` | 200 | 35 ms | HIT | 1 121,5 KB | 170,3 KB | 24 | **295,4 KB** | 126,0 KB |
| `/fr/tarifs` | 200 | 45 ms | HIT | 1 193,7 KB | 181,2 KB | 20 | **269,4 KB** | 134,6 KB |
| `/fr/blog` | 200 | 38 ms | HIT | 1 316,8 KB | 185,4 KB | 21 | **277,1 KB** | 137,4 KB |
| `/fr/faq` | 200 | 66 ms | HIT | 3 372,1 KB | 434,9 KB | 21 | **279,0 KB** | 263,7 KB |
| `/fr/galerie` | 200 | 228 ms | BYPASS | 1 217,8 KB | 174,9 KB | 21 | **278,3 KB** | 129,9 KB |
| `/fr/roi` | 200 | 263 ms | BYPASS | 1 225,3 KB | 185,8 KB | 22 | **299,4 KB** | 138,6 KB |
| `/fr/diagnostic` | 200 | 185 ms | MISS | 1 257,8 KB | 182,6 KB | 20 | **275,5 KB** | 133,2 KB |
| `/fr/simulateur` | 200 | 202 ms | BYPASS | 1 087,1 KB | 166,2 KB | 23 | **305,3 KB** | 124,5 KB |
| `/fr/avis` | 200 | 218 ms | BYPASS | 1 433,8 KB | 199,9 KB | 20 | **274,8 KB** | 144,5 KB |
| `/fr/observatoire-ia` | 200 | 221 ms | BYPASS | 1 474,3 KB | 196,9 KB | 20 | **269,4 KB** | 143,9 KB |

*Budget First Load JS : **75 KB gz**. Dépassement sur **21/21** pages. En retirant
les polyfills `noModule` (38,6 KB gz), le First Load effectif reste de 231 à
267 KB gz, soit ×3,1 à ×3,6.*

### Sonde 2 — état de cache et rendu (2026-08-15 **01:10:41 UTC**)

Voir le tableau du finding P1 « rendus dynamiquement ». Récapitulatif :
**15 URLs** en ISR + cache edge (`x-nextjs-cache` présent, `s-maxage=3600` ou
`86400`), **6 URLs** en rendu dynamique (`x-nextjs-cache` absent,
`private, no-store`, BYPASS). Aucune page ne sert de `<link rel="stylesheet">`
(CSS 100 % inlinée).

### Sonde 3 — surfaces complémentaires (2026-08-15 **01:12:13 UTC**)

| URL | statut | TTFB | cf | `x-nextjs-cache` | poids gz |
|---|---|---:|---|---|---:|
| `/fr/presse` | 200 | 433 ms | BYPASS | — | 198,7 KB |
| `/fr/carrieres` | 200 | 239 ms | BYPASS | — | 234,1 KB |
| `/fr/recherche` | 200 | 187 ms | BYPASS | — | 166,5 KB |
| `/fr/avis/ville/paris` | 200 | 215 ms | BYPASS | — | 174,5 KB |
| `/fr/avis/secteur/btp` | **404** | 178 ms | BYPASS | — | — |
| `/fr/avis/service/audit-ia` | **404** | 204 ms | BYPASS | — | — |
| `/fr/galerie/audits` | 307 → `/fr/galerie?module=audits` | 183 ms | MISS | STALE | — |
| `/fr/blog/page/2` | 200 | 341 ms | BYPASS | — | 185,7 KB |
| `/fr/glossaire` | 200 | 46 ms | HIT | HIT | 183,9 KB |
| `/fr/guides` | 200 | 40 ms | HIT | HIT | 169,9 KB |
| `/fr/connaissances` | 200 | 41 ms | HIT | STALE | 183,9 KB |
| `/fr/secteurs` | 200 | 143 ms | MISS | STALE | 170,7 KB |
| `/fr/un-a-un` | 200 | 160 ms | MISS | HIT | 368,9 KB |
| `/fr/podcast` | 200 | 179 ms | MISS | HIT | 169,0 KB |
| `/fr/formations/entreprise` | 200 | 853 ms | MISS | STALE | 266,5 KB |
| `/fr/audit/tpe-1-jour` | 200 | 186 ms | MISS | STALE | 248,7 KB |

*Les deux 404 (`/fr/avis/secteur/btp`, `/fr/avis/service/audit-ia`) relèvent de
B6/C5, pas de G1 — signalés ici pour information seulement.*

### Sonde 4 — TTFB sous UA Googlebot, 3 requêtes consécutives (2026-08-15 **01:12 UTC**)

| URL | essai 1 | essai 2 | essai 3 |
|---|---:|---:|---:|
| `/fr` (ISR + cache edge) | 68 ms | 67 ms | 59 ms |
| `/fr/appel` (dynamique) | 213 ms | 168 ms | 157 ms |
| `/fr/avis` (dynamique) | 202 ms | 184 ms | 177 ms |

### Sonde 5 — composition des documents, octets brotli réellement transférés (2026-08-15 **01:14:14 UTC**)

Voir le tableau du finding « pages les plus lourdes ». Constante remarquable :
**CSS inlinée = 228,6 KB bruts sur les 8 pages** (230,5 KB sur `/fr/appel`).

### Artefacts CI exploités

| Source | Horodatage | Élément retenu |
|---|---|---|
| Run `31830868520`, job `deploy` | 2026-08-14 19:46:20 → **19:49:58 UTC** | atterrissage du dernier déploiement |
| Run `31830868520`, jobs `lhci` / `warm` / `indexnow` | démarrés **19:50:00 UTC** (les trois) | parallélisme confirmé |
| Run `31830868520`, job `lhci` (`94879376278`) | 19:50:26 → **20:00:32 UTC** | 1er hit Lighthouse **28 s** après l'atterrissage ; `Checking assertions against 5 URL(s), 10 total run(s)` → `All results processed!` → **success** |
| Run `31825377760`, Gate B (`94852231187`), step `Bundle size` | **2026-08-14 18:13:12 UTC** | 3 buckets rouges / 2 globs morts / job vert |
| Run `31825377760`, Gate B, conclusions de steps | 2026-08-14 | `Bundle size`, `Bundle delta`, `Playwright`, `Lighthouse CI` → tous en `continue-on-error` |

### Confrontation aux « 15 pages stratégiques »

Aucune liste de 15 pages n'existe dans le dépôt. Trois listes concurrentes :

| Source | Nb d'URLs | Bloquant ? | Presets |
|---|---:|---|---|
| `.github/workflows/deploy-coolify.yml:600-606` | **5** | **OUI** | desktop seul |
| `lighthouserc.json:4-17` | 12 | non (`ci.yml:308`) | desktop + mobile |
| `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md:31-224` | 14 routes | n/a (document) | n/a |
| `.github/workflows/nightly.yml:268-275` | 5 | non (mode historique) | par défaut |

Pages jamais mesurées par aucune gate, alors qu'elles portent le trafic GEO/AEO :
`/fr/implantations` (hub), `/fr/faq`, `/fr/appel`, `/fr/avis` (et toutes ses
facettes), `/fr/glossaire`, `/fr/guides`, `/fr/observatoire-ia`, `/fr/blog`,
`/fr/tarifs`, `/fr/secteurs`, ainsi que **tout article de blog** et **toute fiche
FAQ/glossaire** individuelle.

---

## Limites

1. **Aucune mesure Lighthouse en lab n'a été produite par moi.** Interdit par la
   contrainte machine (machine de Will, nuit). Les valeurs LCP/INP/CLS/TBT lab
   citées proviennent exclusivement des artefacts CI et des doctrines de config.
   Conséquence directe : **je ne peux pas dire si les budgets LCP ≤ 1 800 ms,
   CLS ≤ 0,05 et TBT ≤ 150 ms sont tenus sur les 16 pages hors gate** — je peux
   seulement établir qu'ils ne sont **mesurés** nulle part. Le seul verdict lab
   dont je dispose est celui du gate post-deploy du 2026-08-14 20:00:32 UTC :
   **vert sur ses 5 URLs, en desktop, sans INP.**
2. **Le log lhci ne détaille pas les valeurs numériques.** `lhci assert` n'imprime
   que les échecs ; comme le gate est passé, aucune valeur LCP/CLS/TBT chiffrée
   n'est extractible du log. Les rapports JSON sont dans `.lighthouseci/` du
   runner, non uploadés en artefact par le job `lhci` du deploy (seul Gate B
   uploade `lhci/`). **Piste pour un futur patch : ajouter l'upload d'artefact au
   job post-deploy**, ce qui rendrait les séries exploitables.
3. **Valeurs terrain (RUM p75) non lues.** Elles vivent dans
   `ContentGenConfig.web_vitals_p75` et dans la table `WebVitalSample`. L'accès à
   la DB de production est réservé aux agents A3, B6, D1, D5, D8 et F7 : je ne
   l'ai pas ouvert. La console `/[adminPrefix]/web-vitals` exige une session
   authentifiée. **Ce qu'il resterait à vérifier : le p75 réel LCP/INP/CLS par
   URL sur 24 h, et notamment si `/fr/appel` et `/fr/avis` (dynamiques) y
   ressortent dégradés.**
4. **Contenu du chunk `18966-*.js` (68,0 KB gz / 293,7 KB bruts) non identifié.**
   Il faudrait un `pnpm build` avec analyseur de bundle — interdit ici. C'est le
   levier n°1 du budget First Load et il reste non diagnostiqué.
5. **Mécanisme Next 16 exact** derrière le rendu dynamique des routes à segment
   dynamique **sans** `generateStaticParams` (`avis/ville/[ville]`,
   `blog/page/[num]`) : marqué **[À CONFIRMER]**. L'observable (`no-store` +
   BYPASS) et le code (`revalidate` déclaré, `generateStaticParams` absent) sont
   prouvés ; l'imputation causale précise mériterait une lecture de
   `node_modules/next/dist/docs/`.
6. **Impact réel de `inlineCss: true` sur le LCP non mesuré** (nécessiterait deux
   builds comparés). La recommandation associée est donc conditionnée à cette
   mesure, pas prescrite sèche.
7. **Mesures faites depuis une seule origine réseau** (poste de Will, France),
   une seule fois par URL pour les sondes 1/3/5. Les TTFB sont indicatifs ; seul
   le contraste ISR/dynamique (facteur ×4 à ×20, reproduit sur 3 essais en
   sonde 4) est solide.
8. **Fichiers de sonde jetables** écrits hors du dépôt, dans le scratchpad de
   session : `g1-probe.mjs`, `g1-probe2.mjs`, `g1-probe3.mjs`, `g1-probe4.mjs`,
   `g1-probe5.mjs` et `lhci-31830868520.log`. Rien n'a été écrit dans
   `axionia/` hors ce rapport.
