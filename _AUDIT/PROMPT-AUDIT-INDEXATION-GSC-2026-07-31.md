# PROMPT — AUDIT EXHAUSTIF INDEXATION / GOOGLE SEARCH CONSOLE (Axion-IA)

> **Usage** : coller ce fichier entier comme prompt d'ouverture d'une session dédiée.
> Rien d'autre. Le prompt est auto-portant.
> **Date de référence des données** : 2026-07-31. **Fenêtre GSC** : 2026-05-12 → 2026-07-31 (90 j).
>
> ⚠️ **Citations `fichier:ligne`** : relevées les 2026-07-28→31 sur un working tree qui
> s'est avéré **détaché et 122 commits derrière `origin/main`**. Les fichiers cités ont été
> re-vérifiés contre `origin/main` le 2026-07-31 (seuls `robots.ts` — **décalage +32 après
> l.80** — et `deploy-coolify.yml` différaient), mais `origin/main` bouge en permanence :
> **re-résous chaque citation contre `origin/main` fraîchement fetché avant de t'y appuyer.**

---

## 0. MISSION

Le site `axion-ia.com` (Next.js 16.2 App Router, ~17 629 routes SSG, FR canonique / EN neutralisé
en 301) présente depuis **~3 mois** un symptôme constant :

> **de plus en plus de pages indexées, et de moins en moins de visibilité.**
> Les courbes GSC (impressions, clics, pages indexées, exploration) montent puis **chutent en
> dents de scie**, de façon répétée, sans corrélation évidente avec les publications.

Ta mission n'est PAS de « regarder le SEO ». Elle est de produire une **explication causale
prouvée, chiffrée et datée** de ce comportement, puis un **plan de remédiation exécutable**
qui rende l'indexation **automatique, maximale et robuste**.

Hypothèse directrice à tester frontalement (formulée par Will) :

> « **On met trop de barrières, on est trop conservateurs.** »

Cette hypothèse doit être **confirmée ou réfutée pièce par pièce**, jamais admise d'office.
Symétriquement, l'hypothèse inverse (« on publie trop de pages faibles, Google se défend »)
doit être testée avec la même rigueur. Les deux peuvent être vraies simultanément sur des
segments différents du site — c'est même l'issue la plus probable, et il faudra alors
**segmenter** le diagnostic par famille d'URLs.

---

## 1. DONNÉES FOURNIES — À CHARGER AVANT TOUTE CHOSE

Export GSC brut : `C:\Users\willi\Downloads\DSC 31072026\`

| Fichier | Contenu |
|---|---|
| `Problèmes critiques.csv` | Rapport « Indexation des pages » — raisons de non-indexation |
| `Graphique récapitulatif des statistiques sur l'exploration.csv` | Crawl stats quotidiennes (requêtes / octets / temps de réponse) |
| `Tableau des réponses.csv` | Répartition des codes HTTP servis à Googlebot |
| `Tableau des hôtes.csv` | Répartition par hôte |
| `Tableau des types de fichier.csv` | Répartition par type de ressource |
| `Tableau des types de Googlebot.csv` | Répartition par user-agent Googlebot |
| `Tableau des objectifs.csv` | Découverte vs actualisation |
| `Graphique.csv` + `Tableau.csv` | Rapport HTTPS |
| `Problèmes non critiques.csv`, `Métadonnées.csv` | Compléments |

**Archives historiques déjà présentes dans le repo** — W21→W31, soit ~11 semaines :

```
axionia/_AUDIT/crawl-stats-2026-W21.csv … crawl-stats-2026-W31.csv
```

⚠️ **Malgré leur nom, ce ne sont PAS des stats de crawl** (vérifié le 2026-07-31) : ce sont
des exports **GSC Performances par page** — colonnes `page,impressions,clicks,ctr,position`.
C'est donc **la série temporelle de visibilité qui manquait** : 11 points hebdomadaires,
par URL. Exploite-les à fond :

- Reconstruis la **courbe impressions/clics/position moyenne, semaine par semaine, par
  famille d'URLs** (§2 règle 7). C'est la matérialisation directe du symptôme « moins de
  visibilité » — et le moyen de le dater précisément.
- La taille passe de 201 o (W21, ~2 pages avec impressions) à 16 043 o (W31) : **le nombre
  de pages recevant ≥ 1 impression a explosé pendant que la visibilité perçue chutait** —
  quantifie ce paradoxe : est-ce une longue traîne d'impressions à position > 20 qui
  remplace des positions fortes perdues ?
- **Signaux déjà visibles dans l'échantillon W31** (à creuser systématiquement) :
  - des URLs **sans préfixe de locale** reçoivent des impressions
    (`https://axion-ia.com/formations/ia-pour-bien-commencer-journee`,
    `https://axion-ia.com/blog/formation-ia-maurepas-definition`,
    `https://axion-ia.com/connaissances`). ⚠️ Fact-check 2026-07-31 : `proxy.ts` (blocs
    0a-bis et 0bis) **301-ifie déjà ces formes nues** vers `/fr/...` — la branche « 200 en
    double du contenu FR » est donc exclue par le code. L'énigme à résoudre est :
    **pourquoi GSC attribue-t-il encore des impressions à l'URL source d'un 301 ?**
    (index rémanent ? liens externes ? période antérieure au correctif ? — date le
    correctif via git blame et croise avec les semaines des CSV).
  - une URL **`/en/gallery/...`** reçoit encore des impressions malgré le 301 EN→FR →
    résidu d'index EN à purger. En W21, `https://axion-ia.com/en` faisait encore
    **13 impressions + 1 clic** : le résidu EN se résorbe — mesure sa pente.
  - `/fr/blog/integrateur-ia-grenoble-entreprise-faq` (avec préfixe — ne pas la ranger
    dans la famille « URLs nues ») : 84 impressions, position 22,8 — profil type du
    contenu généré qui rankt page 3.

### 1.1 Chiffres déjà extraits (à revérifier, pas à recopier aveuglément)

**Raisons de non-indexation (`Problèmes critiques.csv`)** :

| Raison | Pages | Source | Validation |
|---|---:|---|---|
| Exclue par la balise `noindex` | **1 200** | Site Web | Échec |
| Détectée, actuellement non indexée | **884** | Systèmes Google | Commencé |
| Introuvable (404) | **463** | Site Web | **Non commencé** |
| Page avec redirection | **386** | Site Web | Échec |
| Erreur serveur (5xx) | **282** | Site Web | Échec |
| Explorée, actuellement non indexée | **207** | Systèmes Google | Échec |
| Bloquée par robots.txt | **71** | Site Web | Échec |
| Autre page avec balise canonique correcte | 16 | Site Web | Échec |
| Bloquée 403 | 3 | Site Web | Commencé |
| Duplicate, canonique Google ≠ utilisateur | 1 | Systèmes Google | Non commencé |

→ **~3 513 pages non indexées**, dont **1 091 refusées par les systèmes Google**
(détectée + explorée non indexées) = signal qualité/crawl-budget, pas un bug technique.

**Codes HTTP servis à Googlebot (`Tableau des réponses.csv`)** :

| Code | Ratio |
|---|---:|
| 200 | 71,32 % |
| **301** | **12,17 %** |
| **404** | **8,22 %** |
| 302 | 3,19 % |
| **5xx** | **3,18 %** |
| autres 4xx | 1,91 % |
| robots.txt indisponible | 0,01 % |

→ **~28,7 % du budget de crawl est consommé par des redirections et des erreurs.**

**Hôtes (`Tableau des hôtes.csv`)** :

| Hôte | Requêtes |
|---|---:|
| `axion-ia.com` | 17 457 |
| **`www.axion-ia.com`** | **2 000** |
| `plausible.axion-ia.com` | 1 |

→ **10,3 % du crawl part sur `www`**, hôte qui ne devrait servir que des 301.

**Budget de crawl** : ~19 458 requêtes / 90 j ≈ **216 requêtes/jour** pour **~17 629 routes**
(⚠️ chiffre AGENTS.md probablement périmé : EN n'est plus prérendu, cf. §4.1 — recompte
depuis le manifeste de build). → un passage complet du site prendrait des **dizaines de
jours** dans tous les cas. Objectif du crawl : **71,45 % découverte / 28,55 % actualisation**
→ l'actualisation est famélique.

**Temps de réponse moyen** — baseline ~600-900 ms, avec des pics :

| Date | Temps de réponse moyen | Requêtes |
|---|---:|---:|
| 2026-06-01 | 3 084 ms | 503 |
| 2026-06-17 | **8 308 ms** | 50 |
| 2026-07-23 | **26 765 ms** | 640 |
| 2026-07-24 | 3 324 ms | 505 |

→ Le 2026-07-23/24 correspond à l'**incident VPS documenté** (coupure réseau CF↔origine).
**26 765 ms de temps de réponse moyen sur 640 requêtes** = Googlebot a été maltraité pendant
une journée entière. Il faut mesurer l'impact de chacun de ces pics sur les courbes.

**Types de fichier** : `Inconnu (demandes non abouties)` = **13,32 %**. Ce bucket est le
jumeau des erreurs — le corréler avec les 5xx/404.

**Types de Googlebot** : `Autre type d'agent` = **43,54 %** (à égalité avec Smartphone
43,63 %). **Ce ratio est anormal et doit être expliqué** — identifie quels agents c'est
réellement (AdsBot ? Inspection tool ? Googlebot-Extended ? feeds ?).

---

## 2. RÈGLES D'ENGAGEMENT (non négociables)

1. **Aucune conclusion sans preuve.** Chaque affirmation du rapport final porte soit une
   citation `fichier:ligne`, soit une sortie de commande, soit une ligne de CSV, soit une
   réponse HTTP capturée. Une intuition non prouvée est écrite comme **hypothèse non vérifiée**,
   explicitement étiquetée.
2. **`curl`, jamais `WebFetch`, pour inspecter la prod.** WebFetch supprime les `<script>` →
   il est **inutilisable** pour vérifier du JSON-LD, et il ne montre ni les en-têtes, ni les
   codes HTTP, ni les chaînes de redirection. Utilise
   `curl -sSL -o /dev/null -w '%{http_code} %{redirect_url} %{time_total}\n'` et
   `curl -sSI` systématiquement.
3. **Vérifie l'état RÉEL de `origin/main`.** Le working tree est partagé entre plusieurs
   conversations et a déjà été 58 commits en retard. `git fetch origin` puis
   `git show origin/main:<fichier>` avant toute affirmation sur le code déployé.
   Travaille dans un **worktree isolé** si tu dois modifier quoi que ce soit.
4. **Distingue en permanence trois états** pour chaque constat :
   `code source` ≠ `image Docker déployée` ≠ `ce que Googlebot a réellement vu`.
   Le contrat de build `stub.invalid` (§4.3) rend ces trois états structurellement divergents.
5. **Ne propose aucun patch qui dégrade les budgets Web Vitals** (LCP ≤ 1 800 ms p75,
   INP ≤ 100 ms, CLS = 0, First Load JS ≤ 75 KB gz). Si un correctif d'indexation coûte
   des Web Vitals, écris-le comme arbitrage explicite et laisse la décision à Will.
6. **Ne touche pas à la magic string `stub.invalid`** sans propager dans les 6 fichiers du
   contrat ADR 0026 (`prisma.ts`, `redis.ts`, `knowledge-rss.ts`, `knowledge-sitemap.ts`,
   `Dockerfile`, `.github/workflows/deploy-coolify.yml`).
7. **Segmente toujours.** « Le site » n'est pas une unité d'analyse valable ici : il y a
   au moins 8 familles d'URLs aux comportements radicalement différents (pSEO villes,
   services×villes, blog content-gen, KB/ressources, formations, FAQ/glossaire, presse/news,
   pages transactionnelles). Un chiffre global qui mélange ces familles est un chiffre inutile.
8. **Zéro complaisance.** Si une décision passée documentée dans le code est la cause du
   problème, dis-le, avec le commentaire daté qui la porte. Si une note de mémoire contredit
   le code, **le code a raison**.

---

## 3. LIVRABLES ATTENDUS

Un seul fichier : `_AUDIT/AUDIT-INDEXATION-GSC-2026-07-31.md`, structuré ainsi :

1. **Verdict en 10 lignes** — la ou les causes racines, hiérarchisées, avec leur poids estimé
   en % du symptôme observé.
2. **Chronologie causale** — un tableau daté 2026-05-01 → 2026-07-31 croisant :
   déploiements (git log), incidents (VPS, CF), changements de code SEO, publications de
   contenu, et les inflexions des courbes GSC. **C'est la pièce maîtresse du rapport.**
3. **Diagnostic par famille d'URLs** (les 8 familles ci-dessus) : combien d'URLs déclarées,
   combien indexées, combien refusées, et pourquoi.
4. **Inventaire exhaustif des barrières** (§6) — chaque garde-fou du code, sa date, sa
   justification d'origine, et un verdict : `GARDER` / `ASSOUPLIR` / `SUPPRIMER`, motivé.
5. **Explication mécanique des dents de scie** (§5) — pas une métaphore, un mécanisme.
6. **Plan de remédiation P0/P1/P2** — chaque item avec : fichier(s) touché(s), effort,
   risque, gain attendu, et **méthode de mesure** du gain.
7. **Annexe : reste à faire côté Will** (actions GSC/Cloudflare/Coolify non automatisables).

---

## 4. AXES D'INVESTIGATION — LES 14 CHANTIERS

Traite-les tous. Aucun n'est optionnel. Pour chacun : ce qu'on cherche, où chercher, quoi prouver.

### 4.1 — Les 1 200 pages `noindex` : d'où viennent-elles ?

C'est le **premier bucket en volume**. Personne ne sait actuellement de quoi il est composé.

- Énumère **toutes** les sources de `noindex` du code : `robots: { index: false }` dans les
  `generateMetadata`, `<meta name="robots">`, en-tête HTTP `X-Robots-Tag` (proxy, Caddyfile,
  Cloudflare), et la logique de `src/server/site-explorer/indexability.ts`.
  ```
  grep -rn "noindex\|index: false\|X-Robots-Tag" axionia/src axionia/Caddyfile axionia/next.config.ts
  ```
- Pour chaque source : combien d'URLs concrètes elle génère ? Croise avec le nombre de routes
  réellement prérendues (`.next/` ou le manifeste de build).
- **Question critique** : les pages `noindex` sont-elles **dans les sitemaps** ? Une URL
  `noindex` déclarée en sitemap est un signal contradictoire majeur qui dégrade la confiance
  de Google dans TOUT le sitemap. Vérifie l'intersection.
- **Suspect n°0 — le CAP D'INDEXATION VILLES du 2026-07-03** (découvert au balayage du
  2026-07-31, vérifié dans le code) : `src/content/villes/index.ts:263-285` documente une
  décision Will datée « P0 2026-07-03 — CAP INDEXATION T1/T2 + CURÉES » : ≈ 480 villes
  restent indexées, et **~1 336 petites villes T3/T4 auto-templatées passent
  `noindex,follow` + hors sitemap** (`RANKED_INDEXABLE` = premium ∩ curées, consommé par
  `isVilleIndexable()` → `sitemap.ts:1383,1462`, `VilleServicePageTemplate.tsx:274`,
  `implantations/[region]/[ville]/page.tsx:200`, + les 3 sitemaps images villes).
  → ~1 336 est **du même ordre que le bucket GSC de 1 200 `noindex`**, et la bascule a eu
  lieu **le même jour que le vidage du blog**. C'est probablement la plus grosse part du
  bucket — et une part **voulue et saine** (concentration du crawl sur les pages fortes).
  Quantifie-la précisément, date l'effet dans les courbes, et rends le verdict : le cap
  est-il au bon niveau (480) ou faut-il le bouger — dans un sens ou dans l'autre ?
- Suspect n°1 : les **routes `/en/*`**. ⚠️ Prémisse corrigée le 2026-07-31 : contrairement
  à ce que dit AGENTS.md (périmé sur ce point), **EN n'est PLUS prérendu** —
  `src/i18n/routing.ts:407-424` définit `STATIC_LOCALES = EN_LOCALE_ENABLED ? locales :
  ["fr"]`, utilisé par les `generateStaticParams`. Les `/en/*` sont servis on-demand puis
  301 par `src/proxy.ts`. Recompte donc les routes **réellement prérendues** depuis le
  manifeste de build (le chiffre « 17 629 » est peut-être un décompte FR+EN qui n'existe
  plus) et **corrige AGENTS.md**. Combien des 386 « Page avec redirection » sont des `/en/*` ?
- Suspect n°1bis — les **sources de `noindex` recensées par
  `src/server/site-explorer/indexability.ts`** (le SSOT de l'indexabilité, à exploiter au
  lieu de tout redécouvrir) : (a) le **tier des articles DB** — `tier_2_noindex_follow` /
  `tier_3_noindex_nofollow`, promotion tier-1 au CTR (`indexability.ts:85-96`, resolver
  `src/content/blog/index.ts:54-56`) : un système de noindex automatique par score ;
  (b) le **gate anti-thin glossaire** `isGlossaryTermIndexable` (seuil
  `GLOSSARY_MIN_INDEX_WORDS`, `indexability.ts:149-157`) ; (c) les `NOINDEX_STATIC_PATHS`
  (10 chemins, `indexability.ts:50-62`) — **miroir manuel** de `EXCLUDED_FROM_INDEX` de
  `sitemap.ts`, à resynchroniser à la main (même fragilité que `EDITORIAL_BASELINE`) ;
  (d) la **galerie** : `/galerie/[slug]` (DB-dependent, sans `generateStaticParams`) se
  sert elle-même en `noindex` si la traduction manque ou si `hasSubstantiveContent()` est
  faux (`galerie/[slug]/page.tsx:38,116`) — un `noindex` **conditionnel à l'état DB, donc
  instable d'un crawl à l'autre** : mécanisme de dents de scie à part entière.
  Ventile le décompte brut (~151 occurrences de `index: false` sous `src/app/[locale]`)
  entre ces sources.
- Suspect n°2 : les **tombstones soft-410** (`src/server/content-gen/tombstone.ts`,
  vérifié 2026-07-31). Quand un article content-gen est archivé, la page reste servie en
  **status 200 + `noindex`** (« soft-410 » ; le vrai 410 est différé en V2, l.23-24).
  ⚠️ **Deux prémisses corrigées au fact-check du 2026-07-31 — ne pas répéter ces erreurs** :
  - « le blog a été vidé le 2026-07-03 » est **faux** : `BLOG_POSTS = []` ne concernait que
    **3 posts filesystem legacy** (commit `2b5d14ec`, 2026-07-03), régénérés en base sous
    de nouveaux slugs. Le blog est **100 % DB et vivant** (58 articles ce jour-là).
    L'impact réel du 03/07 : **10 articles archivés** (→ tombstones), **2 noindexés**,
    des slugs renommés (→ `ArticleSlugHistory`), **11 redirects 308** ajoutés dans
    `next.config.ts`.
  - « 42 articles purgés lors du chantier passif éditorial » est **faux** :
    `_AUDIT/PURGE-PASSIF-EDITORIAL-2026-07-21.md:3` déclare « **AUCUNE ÉCRITURE
    EFFECTUÉE** » ; le « 42 » est un **pourcentage** (69 articles sur 163 portent au moins
    un défaut). **Vérifie en base si une purge a été exécutée après le 21/07** avant
    d'utiliser cet événement dans une chronologie.
  Méthode de comptage des tombstones : il n'existe **aucune table `Tombstone`** —
  `findArticleTombstone()` requête `ArticleTranslation` joint `Article` avec
  `status ∈ {archived, draft}`. Le comptage =
  `SELECT count(*) FROM "Article" WHERE status IN ('archived','draft')` (+ ventilation par
  date d'archivage). Rapproche le chiffre des 1 200 ; la part tombstone est **auto-infligée
  et saine** (mécanisme de désindexation voulu) mais gaspille du crawl en 200 — instruis le
  passage au **vrai 410** (la V2 différée) comme item du plan. Note : le tombstone ping
  aussi IndexNow `URL_DELETED` (l.25-26) — vérifie que ces pings partent.
- Suspect n°3 : les pages admin sous `[adminPrefix]`, le portail, `espace-formateur`,
  `mes-ressources`, `design`. Sont-elles seulement **découvrables** ? Si oui, comment ?
  (fuite de lien interne ? sitemap ? cache externe ?)

**À prouver** : une répartition chiffrée des 1 200, source par source (tombstones / EN /
surfaces privées / autre), et pour chaque source un verdict `légitime` / `à corriger`.

### 4.2 — Les 463 × 404 et les 386 redirections : le budget de crawl gaspillé

- Statut GSC de la validation des 404 = **« Non commencé »** → personne n'a lancé la
  validation. Pourquoi ? Est-ce parce qu'on ne sait pas quelles URLs c'est ?
- Reconstitue la liste des 404 depuis les logs origine si accessibles
  (`ssh axion-prod`, logs du conteneur web `mqbmlz1b…`) ou depuis GSC.
- **Classe-les** : anciennes URLs supprimées lors des refontes (catalogue formations,
  `/reserver` supprimé au profit de `/appel`, blog vidé le 2026-07-03, `/sitemap/blog.xml`
  fantôme), URLs inventées par Google, URLs cassées par un bug de génération.
- Pour chaque classe : **301 vers la meilleure cible** ou **410 Gone assumé**. Un 404 en masse
  sur des URLs qui ont existé est un signal de site instable ; un 410 est un signal propre.
- Vérifie **les chaînes de redirection** : `curl -sSIL` sur 30 URLs échantillonnées.
  Toute chaîne > 1 hop est à corriger. Cherche particulièrement :
  `http://www` → `https://www` → `https://apex` → `/fr/...` = 3 hops potentiels.
- **Les 2 000 requêtes sur `www.axion-ia.com`** : le 301 www→apex est dans le **Caddyfile
  du repo** (`Caddyfile:41-44`, `redir @www … permanent`). ⚠️ Réserve du fact-check :
  **ce Caddyfile n'est PAS déployé par le pipeline** (ADR 0026 ne pousse que l'image Next ;
  rien ne synchronise le Caddyfile vers le VPS ; le fichier date du 2026-05-22 et mentionne
  un CPX32 alors que la machine est un CPX42). La preuve code ne vaut donc **rien pour la
  prod** : récupère le Caddyfile **réellement actif sur le VPS** (`ssh axion-prod`) et
  mesure en live (`curl -sSI https://www.axion-ia.com/`). Vérifie aussi qu'aucune règle
  Cloudflare ne double la redirection, que le hop count est 1 en HTTPS (2 max depuis
  HTTP), et si `www` est une propriété GSC distincte qui pollue les rapports.
- **Les URLs sans préfixe de locale** (`/formations/...`, `/blog/...`, `/connaissances` —
  vues avec des impressions dans les CSV W31, cf. §1) : que renvoient-elles ?
  `curl -sSI https://axion-ia.com/connaissances` — 301 vers `/fr/connaissances` ? 200 en
  double du contenu FR ? Si elles servent du 200, c'est de la **duplication interne
  massive** (chaque page existe en 2 URLs) ; si elles 301, pourquoi Google les classe-t-il
  encore ? Trace la source des liens vers la forme nue (maillage interne ? sitemaps ?
  JSON-LD ? OG tags ?).
- **🔴 BUG CONFIRMÉ au fact-check 2026-07-31 — les redirects slug-history sont des 307,
  pas des 301.** Le mécanisme (`src/server/content-gen/slug-history.ts`, table
  `ArticleSlugHistory`, lookup `findArticleSlugRedirect` si `status === "published"`) est
  sain, mais ses deux consommateurs utilisent `redirect()` de `next/navigation` — qui émet
  un **307 Temporary Redirect** : `blog/[slug]/page.tsx:259` et
  `actualites/[slug]/page.tsx:229` (+ `:219` pour le redirect de locale). Le même fichier
  blog utilise pourtant correctement `permanentRedirect()` (308) aux lignes 289/298 —
  incohérence interne, pas un choix. Or Google **ne consolide pas les signaux sur un 307**
  et re-crawle l'ancienne URL indéfiniment — exactement le mécanisme déjà documenté et
  corrigé dans `proxy.ts` (« Un 307 fait re-crawler en boucle … gaspillage de crawl
  budget »). **Candidat direct au bucket des 386 redirections et aux 3,19 % de 302/307 du
  crawl ; correctif P0 à une ligne** (`redirect` → `permanentRedirect`). Vérifie en live
  le code HTTP d'un ancien slug, chiffre le nombre de slugs renommés en base, et cherche
  d'autres `redirect()` sur des chemins qui devraient être permanents.
- **`slug-history.ts` — questions restantes** : combien d'entrées `ArticleSlugHistory` ?
  Les vieux slugs sont-ils restés dans des sitemaps ou du maillage ? Note :
  `recordArticleSlugChange()` (l.122-136) est un doublon d'API **non idempotent** de
  `recordSlugChange()` — à signaler.
- **`next.config.ts:redirects()` (~90 règles 301, l.223-629)** — la matière première du
  bucket « 386 redirections », jamais inventoriée : 17 anciens slugs formations pré-#327,
  17 slugs de la refonte 2026-07-19, 10 règles `/implantations/:region/:ville/<verticale>`
  (refonte 2026-05-26 qui a **supprimé 10 750 pages**), 10 règles blog Grenoble
  (2026-07-03), 20+ `/interventions/*` → `/formations`. Audite : chaînes résiduelles
  (règle → cible qui redirige elle-même), sources encore présentes dans le maillage ou un
  sitemap, et les deux règles `headers()` **mortes** (l.648-673 : `Cache-Control` sur
  `/sitemap.xml` qui est lui-même un 301, et `/twitter-image` qui n'existe pas).
- **Le trailing slash n'est configuré nulle part** (ni `trailingSlash` ni
  `skipTrailingSlashRedirect` dans `next.config.ts`) → comportement par défaut Next
  (301 `/x/` → `/x`). Teste-le en live et compte sa part dans les 301.
- **404 permanents par `dynamicParams = false` sur source FS vidée — à vérifier
  précisément** : `BLOG_POSTS = []` depuis le 2026-07-03 (`src/content/blog/index.ts:48` —
  seul le fallback filesystem est vide, le blog lui-même est 100 % DB). Les 5 taxonomies
  blog (`blog/{tag,secteur,service,taille,auteur}/[slug]/page.tsx`) sont en
  `dynamicParams = false` avec `generateStaticParams` dérivé de `getAllBlogTagSlugs()` :
  **vérifie si ces builders lisent la DB ou seulement `BLOG_POSTS`**. S'ils ne lisent que
  le FS → zéro route générée + aucun rendu on-demand = **404 dur définitif** sur toutes
  les URLs de taxonomie que Google a en index — croise avec la liste des 463 × 404.
  Inventorie aussi les autres `dynamicParams=false` dont la source est DB-dépendante
  (ex. `centre-aide/*` via `listHelpArticles()` : un article créé uniquement en DB ne sera
  **jamais** prérendu → 404 permanent).
- **Inventaire complet de `src/proxy.ts`** — il fait bien plus que le 301 EN→FR ; audite
  chaque bloc : 301 `/` → `/fr` (l.60-62) ; **`resolveLegacyRedirect` qui aplatit les
  chaînes à 2 sauts** (l.71-80, `src/lib/legacy-redirects.ts` — exactement l'objet de ce
  chantier) ; 301 des URLs **sans préfixe de locale** → `/fr/...` (l.97-106 — le code qui
  traite les URLs nues vues avec impressions au §1) ; 301 devenir-commercial villes
  (l.112-118) ; **302 par défaut** vers `/connexion` pour `espace-formateur` /
  `espace-ressources` (l.126-163 — candidat direct aux 3,19 % de 302 du crawl) ; 307 +
  `no-store` sur `/portail/*` (l.189-207) ; et le **strip des `Set-Cookie` Auth.js sur les
  GET publics** (l.289-339) — le correctif qui conditionne le cache Cloudflare de tout le
  HTML (avant lui : `cf-cache-status: BYPASS` sur 100 % des pages). Vérifie en live qu'il
  marche encore : c'est lui qui décide du temps de réponse, donc du budget de crawl.
- Vérifie que le sitemap ne contient **aucune** URL qui redirige. Une seule suffit à faire
  perdre confiance à Google.

**À prouver** : le nombre exact de hops pour chaque point d'entrée, et la liste des 404
classée avec sa cible de remédiation.

### 4.3 — Le contrat `stub.invalid` : la bombe silencieuse du SSG

**C'est l'hypothèse la plus lourde du dossier. Traite-la en priorité.**

Le build tourne sur GitHub Actions sans accès DB. `DATABASE_URL` contient `stub.invalid`, et
`src/lib/prisma.ts` renvoie un Proxy qui retourne `[] / null / 0` pour **toutes** les requêtes.
Conséquence documentée dans AGENTS.md :

> « Pages DB-dependent (sub-sitemaps `knowledge-*`, `/[locale]/ressources`, etc.) sont rendues
> **vides** au build. L'ISR `revalidate=3600` les repopule **sous 1h** en prod. »

Enchaîne ce fait avec le pipeline de déploiement :

1. Build → toutes les pages DB-dependent sont **vides**, bakées dans l'image Docker.
2. Deploy → container restart, **cache ISR en mémoire du worker vidé**.
3. Job `purge` → **Cloudflare `purge_everything`**, cache CDN vidé intégralement.
4. → Pendant **jusqu'à 1 heure**, chaque URL DB-dependent sert une **page vide** à qui la
   demande en premier, **Googlebot compris**, depuis un CDN froid et un origin froid.

**Questions à trancher, preuves à l'appui :**

- **Combien de routes** sont DB-dependent et donc vides post-deploy ? Énumère-les
  (`grep -rn "prisma\." axionia/src/app --include=page.tsx`), croise avec le `revalidate` de
  chaque route.
- **Combien de déploiements** entre le 2026-05-01 et le 2026-07-31 ? (`git log origin/main
  --since=2026-05-01 --format='%ad %h %s' --date=short`). Chaque deploy = une fenêtre de
  dégradation. **Corrèle les dates de deploy avec les creux des courbes GSC.**
  → **Si les creux tombent sur les jours de deploy, la cause racine des dents de scie est ici.**
- Le `purge_everything` de Cloudflare est-il **nécessaire** ? Une purge par tags/URLs serait
  chirurgicale. Chiffre le coût : combien de temps l'origin met-il à se réchauffer sur
  17 629 routes ? (croise avec les pics de temps de réponse du §1.1)
- Les pages vides servies renvoient-elles **200** ? Si oui, Google les a indexées **vides**,
  puis les a désindexées à la re-visite → **c'est exactement la signature « de plus en plus
  de pages indexées, de moins en moins de visibilité »**. Cherche des pages en index avec un
  contenu qui ne correspond pas.
- **Le warm-up post-deploy EXISTE** (fact-check 2026-07-31 — le pipeline `origin/main`
  compte **7 jobs**, pas 5 : `build`, `deploy` — dont le purge CF est un **step**, pas un
  job —, `lhci`, `indexnow`, `warm`, `notify`). Le job `warm`
  (`deploy-coolify.yml:694-799`) fait : (1) revalidation ISR anti-page-vide de 4 chemins
  (`/fr/actualites`, `/fr/connaissances`, `/fr/ressources`, `/fr/galerie`) via
  `/api/internal/revalidate` ; (2) chauffe de 14 pages stratégiques + images above-fold ;
  (3) sweep du sitemap-index, **cap 4 000 URLs**, `xargs -P 6`. La question n'est donc pas
  « existe-t-il ? » mais « **est-il efficace ?** » — 5 failles précises à instruire :
  1. l'étape revalidation est **no-op silencieux si le secret `REVALIDATE_SECRET` manque
     côté GitHub** (gate l.712-715) → vérifie que le secret existe réellement ;
  2. elle ne couvre que **4 chemins** — ni les sub-sitemaps DB, ni `/fr/blog`, ni les
     pages de détail ;
  3. `concurrency: cancel-in-progress` (l.700-702) → **merges rapprochés = warmer annulé**,
     surface froide (le fichier l'admet l.731-734) ;
  4. le sweep dépend du **sitemap-index** : si le gating anti-vide (§4.4) a retiré des
     sub-sitemaps, leurs URLs ne sont **pas chauffées** — couplage direct entre les
     mécanismes §4.3 et §4.4, à traiter ensemble ;
  5. cap 4 000 URLs contre une surface de plusieurs milliers de routes.
  Le job `indexnow` (l.628-666) ré-exécute `scripts/indexnow-ping.ts` **après** le deploy
  avec la vraie clé (car le `postbuild` du builder Docker no-op, `INDEXNOW_KEY` étant
  RUN-scope) — vérifie ses runs récents.
- **Sub-sitemaps `force-static` = non auto-réparables** : `sitemap-images-services.xml`
  (`route.ts:29`, `force-static` **sans** `revalidate`) et `sitemap-recrutement.xml`
  (`route.ts:14-15`) sont bakés au build sous stub — s'ils dépendent de la DB, ils restent
  vides **jusqu'au prochain build**, l'ISR ne les répare pas. Distingue-les des
  `force-dynamic` dans l'inventaire §4.4.
- **Le hook `postbuild` ping IndexNow** : `package.json:32` → `tsx scripts/indexnow-ping.ts`
  après chaque `pnpm build`. Au build Docker il **no-op** (`INDEXNOW_KEY` est RUN-scope,
  absent du builder) — c'est pour ça que le job `indexnow` du pipeline le ré-exécute
  post-deploy avec la vraie clé (cf. ci-dessus). Vérifie que ce job tourne et ce qu'il
  ping réellement.

**À prouver** : la corrélation deploy ↔ creux de courbe, sur données datées, ou son absence.

### 4.4 — L'architecture des sitemaps : cohérence, stabilité, et le gating anti-vide

Fichiers : `src/app/sitemap.ts` (1 200+ lignes, 30 IDs via `generateSitemaps()`),
`src/app/sitemap-index.xml/route.ts`, et **14 Route Handlers XML** :
`sitemap-{news,news-evergreen,blog,knowledge,recrutement,carrieres,avis}.xml`,
`sitemap-images-{services,blog,villes-t1,villes-t2,villes-t3-t4}.xml`,
`sitemaps/images-{fr,en}.xml`.

**Le point le plus suspect : le gating anti-vide.** Le sitemap-index retire dynamiquement
un sub-sitemap dès qu'il n'émet aucune URL (blog, knowledge, news, news-evergreen, presse,
images-en). C'est défendable pour éviter le flag « Balise XML manquante : url »… mais ça
crée un **sitemap-index dont la composition change au fil des heures**.

- `sitemap-news.xml` = fenêtre **48 h stricte**. Sans publication pendant 2 jours →
  disparaît de l'index → réapparaît à la publication suivante. **Ce clignotement est
  structurel et permanent.**
- `sitemap-news-evergreen.xml` = fenêtre 90 j → disparaîtra en bloc si la publication s'arrête.
- Précision de périmètre (fact-check 2026-07-31) : le gate `presse` est à part
  (`route.ts:296`, sur `generatedBlocks`), les 5 autres sont l.283-289. Les sub-sitemaps
  custom DB (blog/knowledge/news/evergreen) sont **cohérents par construction** avec
  l'index (mêmes builders réutilisés) et eux-mêmes `force-dynamic`. La **désynchronisation
  jusqu'à 24 h** ne concerne que les sub-sitemaps de la convention metadata
  (`/sitemap/<id>.xml`, `sitemap.ts` `revalidate = 86400`) — familles statiques dont le
  contenu bouge peu : risque réel mais moindre que le clignotement news. Note technique :
  sous `force-dynamic`, `export const revalidate` est inerte ; c'est le header
  `Cache-Control: s-maxage=600` (l.340) qui pilote le CDN. Vérifie en live :
  ```
  curl -s https://axion-ia.com/sitemap-index.xml
  # puis, pour CHAQUE <loc> listé :
  curl -sS -o /dev/null -w '%{http_code} %{size_download} %{url_effective}\n' <loc>
  ```
  **Aucun sub-sitemap ne doit renvoyer 404, ni un `<urlset>` vide, ni une redirection.**
- Compte les URLs réellement déclarées, sub-sitemap par sub-sitemap, et **totalise**.
  Compare au nombre de routes prérendues (17 629 annoncées). L'écart s'explique comment ?
- Vérifie les **limites du protocole** : 50 000 URLs et 50 Mo décompressés par sitemap ;
  l'index lui-même est limité à 50 000 sitemaps.
- Chaque URL déclarée doit être : **200**, **auto-canonique**, **indexable**. Échantillonne
  200 URLs au hasard dans les sitemaps et vérifie les trois propriétés. Le taux d'échec
  mesuré sur cet échantillon est la métrique de **confiance sitemap** — reporte-la.

**À prouver** : la liste des sub-sitemaps instables avec leur fréquence d'apparition/disparition,
et l'impact mesuré sur la découverte.

### 4.5 — `lastmod` figés : DEUX baselines mortes, pas une

Fact-check 2026-07-31 — il y a **deux** constantes figées, pas une :

- `EDITORIAL_BASELINE = 2026-06-08` (`sitemap.ts:457`, dupliqué dans
  `sitemap-index.xml/route.ts:145` avec un « garder en sync manuellement » — fragilité) —
  couvre pages, faq, help, cas-concrets, comparaisons, guides, glossaire, secteurs,
  formations, stack-ia…
- **`VILLES_EDITORIAL = 2026-05-26`** (`sitemap.ts:464`) — couvre **implantations et
  toutes les familles villes**, c'est-à-dire la plus grosse famille du site, avec un
  `lastmod` **encore plus vieux** (~9 semaines).

Nuance de volume : les ~5 000 pages services×villes ont été **retirées des sitemaps le
2026-06-20** (décision Will, `sitemap.ts:388-399` — IDs `services-villes-*` commentés).
Le nombre d'URLs déclarées portant un `lastmod` figé est donc bien inférieur à 17 000 —
**compte-le précisément** par famille. Par ailleurs `generateSitemaps()` émet **~26 IDs**
(13 statiques + 13 régions ayant des villes ; les 5 DOM n'ont aucun fichier de données),
pas 30.

La décision d'origine (audit fraîcheur 2026-06-08) était rationnelle : éviter le *date-gaming*
qui faisait re-crawler de l'inchangé. **Mais elle a peut-être basculé dans l'excès inverse.**

- Mesure : depuis le 2026-06-08, quelle est la part d'« actualisation » dans le crawl ?
  (28,55 % sur 90 j — décompose-la mois par mois avec les CSV W21→W31).
- Le contenu de ces pages a-t-il **réellement** été inchangé depuis le 2026-06-08 ? Vérifie
  via git : `git log origin/main --since=2026-06-08 --name-only -- axionia/src/content axionia/src/components/sections`.
  **Si le contenu a bougé et que le `lastmod` ne bouge pas, on ment à Google dans l'autre sens** —
  et Google finit par ignorer le champ, ce qui est le pire des deux mondes.
- Propose un `lastmod` **honnête et automatique** : dérivé du contenu réel (hash du rendu,
  ou `updatedAt` DB, ou date du dernier commit touchant la source de la page), jamais du build.
- **Verdict attendu** : `GARDER` / `ASSOUPLIR` / `SUPPRIMER`, avec le mécanisme de remplacement.

### 4.6 — Les 1 091 pages que Google refuse d'indexer (884 détectées + 207 explorées)

C'est le cœur du problème de **visibilité**, distinct du problème technique.

- **« Détectée, actuellement non indexée » (884)** : Google connaît l'URL et **choisit de ne pas
  la crawler**. Causes classiques : budget de crawl insuffisant (voir §4.7), qualité présumée
  faible par extrapolation depuis des pages voisines, ou site jugé peu prioritaire.
- **« Explorée, actuellement non indexée » (207)** : Google a crawlé et **choisi de ne pas
  indexer**. C'est un jugement de qualité **explicite**.
- Identifie **quelles familles d'URLs** peuplent ces buckets. Presque certainement les pSEO
  villes / services×villes. Prouve-le.
- **Audit de contenu réel** sur ces pages :
  - Quel est le **ratio de contenu unique** entre deux pages villes voisines ? Récupère 20
    pages villes en prod (`curl`), extrais le texte, calcule la similarité. Un taux > 90 %
    de duplication explique à lui seul le refus d'indexation.
  - Combien de mots de contenu **propre à la ville** (vs template) ?
  - Y a-t-il des **données réelles** par ville (entreprises locales, chiffres INSEE, cas
    clients) ou seulement des variables substituées dans un gabarit ?
- Lis `_AUDIT/adr-0004-pseo-villes-PROPOSITION.md`, `_AUDIT/pseo-strategy.md`,
  `_AUDIT/PSEO-VILLES-INDUSTRIALISATION-DECISION.md`,
  `_AUDIT/PHASE-FRONTEND-FINAL-PSEO-VILLES-REGIONS.md` : quelle était la stratégie décidée,
  et le résultat livré y correspond-il ?
- **Question franche à poser dans le rapport** : le volume de pages pSEO est-il soutenable
  pour un site jeune ? Faut-il **réduire** le nombre d'URLs déclarées (déprioriser T3/T4)
  pour concentrer l'autorité, plutôt qu'en ajouter ? Chiffre l'arbitrage.

### 4.7 — Budget de crawl : 216 requêtes/jour pour une surface à RECOMPTER

⚠️ « 17 629 routes » (AGENTS.md:27, ADR 0026) est un instantané du **2026-05-16** qui
**incluait EN** (× 2 langues) et précède la **suppression de 10 750 pages**
`/implantations/[region]/[ville]/[verticale]` (risque doorway, `sitemap.ts:162-165`) et le
retrait des ~5 000 services×villes des sitemaps (06-20). Tous les ratios de crawl-budget
sont donc à recalculer sur la surface réelle. **Recompte d'abord** : manifeste de build
(`.next/routes-manifest.json` / log GH Actions) + l'outil interne
`src/server/site-explorer/route-enumerator.ts` qui fait exactement ça.

- Recalcule le budget par jour, par semaine, et sa tendance (les stats de crawl GSC —
  l'export du dossier DSC — pas les CSV W* qui sont des Performances).
- Décompose : combien de ces requêtes servent des **200 utiles** ? (71,32 % de 200, mais
  combien de ces 200 sont des ressources, des images, des sitemaps ?) Croise
  `Tableau des réponses` × `Tableau des types de fichier` × `Tableau des types de Googlebot`.
- **HTML = 58,59 %** seulement. `Autre type de fichier` = 15,61 %, `Inconnu (non abouties)` =
  13,32 %. Identifie ce que sont ces deux buckets — 29 % du crawl part dans du non-HTML
  et du raté.
- **Les 7 feeds RSS/JSON** — absents de tout inventaire jusqu'ici :
  `[locale]/{blog,actualites,avis,cas-concrets,faq}/feed.xml` +
  `[locale]/ressources/{feed.xml,feed.json}` (tous `runtime="edge"`). Candidats directs au
  bucket « Autre type de fichier » et au mystère « Autre type d'agent = 43,54 % »
  (FeedFetcher-Google et les agrégateurs apparaissent souvent ainsi). ⚠️ **Le feed blog
  mappe `BLOG_POSTS` = `[]` depuis le 2026-07-03** (`blog/feed.xml/route.ts:3,25`) → il
  sert un `<channel>` **sans aucun `<item>`** en permanence — signal « site abandonné »
  pour Bing Copilot / Perplexity, qui sont explicitement `Allow` dans robots.ts. Vérifie
  chaque feed en live, et décide : déclarés proprement (`<link rel="alternate">` +
  cohérence robots) ou neutralisés.
- Le **temps de réponse** est le levier n°1 du budget de crawl : Google augmente son taux de
  crawl quand le serveur répond vite. Baseline 600-900 ms = médiocre pour un site
  majoritairement statique derrière Cloudflare. **Pourquoi ?**
  - Le CDN sert-il vraiment les pages SSG en HIT ? Mesure le `cf-cache-status` sur
    30 URLs : `curl -sSI <url> | grep -i 'cf-cache-status\|age\|cache-control'`.
    Un taux de MISS élevé sur des pages statiques = fuite majeure.
  - Les en-têtes `Cache-Control` des pages ISR permettent-ils au CDN de cacher ?
  - Le `purge_everything` post-deploy détruit-il ce cache à chaque livraison ? (voir §4.3)
- **Bingbot `crawlDelay: 1`** dans `robots.ts:150` — justifié en mai par la crainte
  d'écraser l'origin. Est-ce encore justifié aujourd'hui ? Bing alimente aussi ChatGPT/Copilot.
  Verdict attendu.
- Le taux de crawl est-il **plafonné manuellement** dans GSC (ancien paramètre de limitation) ?
  → à vérifier côté Will.

### 4.8 — Les 5xx (3,18 % du crawl, 282 pages) : stabilité de l'origine

- Corrèle les jours à fort taux d'erreur avec : les déploiements, l'incident VPS du 2026-07-23/24,
  les pics de temps de réponse, et les jobs BullMQ lourds (content-gen, image-bank,
  prospection INSEE — **le VPS a déjà été submergé au point de nécessiter un reboot**).
- Le **worker BullMQ est une app Coolify distincte** (`oqj5…`) mais partage la même machine
  et la **même base Postgres**. Un job lourd peut-il dégrader l'app web au point de 5xx-er
  Googlebot ? Cherche les traces.
- Vérifie le `healthcheck` et le comportement pendant `prisma migrate deploy` à l'entrypoint :
  y a-t-il une fenêtre où le container répond 502/503 ?
- **Un 5xx servi à Googlebot fait suspendre le crawl et peut déclencher une désindexation
  temporaire.** 282 pages concernées = un contributeur direct aux dents de scie. Chiffre-le.
- Que renvoie le site pendant un déploiement ? Teste ou déduis du Dockerfile/entrypoint/Caddyfile.

### 4.9 — Canoniques, hreflang et le fantôme EN

- Toutes les pages sont prérendues **FR + EN**, mais `/en/*` est 301 vers FR via `src/proxy.ts`
  + `src/lib/i18n/en-to-fr-redirect.ts`. `routing.ts` déclare toujours `locales: ["fr","en"]`.
- **État vérifié du code (2026-07-31)** : `src/lib/seo.ts:269-304` **omet correctement**
  `hreflang="en"` quand `isEnLocaleDisabled()` est vrai, et pose `fr` + `x-default` → `/fr`.
  Le code est sain. **Mais** les metadata des pages SSG sont **bakées au moment du build**
  (GH Actions), et le flag `EN_LOCALE_ENABLED` est une env var **RUN-scope Coolify** :
  - vérifie comment `isEnLocaleDisabled()` se résout **au build** vs **au runtime ISR** —
    des pages bakées avant la désactivation d'EN (ou revalidées dans une fenêtre où le flag
    différait) peuvent encore porter le hreflang EN fantôme ;
  - donc **vérifie en live**, sur 10 pages de familles différentes (dont une jamais
    revalidée depuis mai) :
    ```
    curl -s https://axion-ia.com/fr/a-propos | grep -oiE '<link[^>]*(canonical|alternate)[^>]*>'
    ```
  - Le `hreflang="x-default"` pointe-t-il vers `/fr` partout ?
  - La canonique est-elle **absolue, HTTPS, sur l'apex, avec le bon préfixe de locale**, et
    **auto-référente** sur chaque page indexable ? Croise avec les URLs **sans préfixe de
    locale** qui reçoivent des impressions (§4.2) : quelle canonique servent-elles ?
- **Bug canonique confirmé au balayage 2026-07-31 — `galerie/[slug]/page.tsx:75`** : la
  page émet `canonical: ${siteUrl}/${locale}/${segment}/...` où `segment` vaut `gallery`
  en EN → **une page `/en/gallery/*` se déclare canonique d'elle-même** alors que
  `proxy.ts` la 301 vers FR. Le commentaire l.74 dit « Canonical FR (toujours) » mais le
  code ne le fait pas. C'est très exactement l'explication du symptôme « `/en/gallery/...`
  reçoit encore des impressions » (§1) et un candidat aux 16 « Autre page avec balise
  canonique correcte ». Correctif : canonique forcée FR. Vérifie aussi que le motif
  historique « 404 héritant de `canonical: /${locale}` » (documenté et corrigé dans
  `[locale]/not-found.tsx:8-27`) n'est réintroduit nulle part.
- **`EN_LOCALE_ENABLED` n'est PAS validé par `env.ts`** (lu en `process.env` brut à ~12
  endroits : `routing.ts:424`, `sitemap.ts:237`, `sitemap-index.xml/route.ts:120`,
  `en-to-fr-redirect.ts:150`…) — une divergence build/runtime est silencieuse **par
  construction**. Vérifie sa valeur effective dans les **trois** environnements :
  build-args GH Actions, env RUN de l'app web Coolify, env RUN du worker `oqj5…` — le flag
  gouverne à la fois le prérendu (`STATIC_LOCALES`), les hreflang ET la composition du
  sitemap-index. Même vérification pour `INDEXING_OAUTH_REFRESH_TOKEN`, `GSC_OAUTH_*`,
  `GSC_PROPERTY_URL`, `INDEXNOW_KEY`, `GSC_HCU_MONITOR_ENABLED` — tous hors schéma Zod,
  tous silencieusement vides si absents.
- Le 301 EN→FR est-il en **1 hop** pour toutes les routes, y compris celles avec un mapping
  `pathnames` FR≠EN ? Teste 20 routes EN. Rappel : le bug next-intl 307 self-loop est
  **toujours non corrigé** — vérifie qu'il ne se manifeste pas via une autre porte.
- **Décision à instruire** : faut-il arrêter de prérender EN ? Cela retirerait potentiellement
  la moitié des routes SSG (gain build, gain crawl, gain clarté), au prix de la réversibilité.
  Chiffre le gain et le coût de retour arrière.
- Cherche les **paramètres d'URL** indexables (`?page=`, `?filter=`, `?utm_`, `?cb=`) : génèrent-ils
  des duplicatas crawlés ? Y a-t-il une canonique qui les neutralise ?
- Pagination : `/blog?page=2`, facettes `/avis`, catégories — canoniques correctes ou
  auto-cannibalisation ?

### 4.10 — La chaîne de génération de contenu : qualité, volume, et le kill-switch

- Cartographie **toute** la pipeline : `src/server/content-gen/**`, les workers
  (`content-publish-worker.ts`, `content-quality-improver-worker.ts`,
  `content-monitoring-worker.ts`), l'orchestrateur, les slots, le retry, le juge.
- **État actuel du kill-switch** : il a été mis à ON (arrêt de la génération) le 2026-07-22.
  **Vérifie en base**, pas dans une note. Depuis combien de temps la génération est-elle
  arrêtée ? **Corrèle avec les courbes** : si la publication s'est arrêtée le 22/07 et que
  `sitemap-news.xml` a une fenêtre de 48 h, ce sitemap a disparu de l'index le 24/07.
- **~912 jobs `failed`** ont été laissés en l'état (chiffre plausible mais tronqué par
  construction : `removeOnFail: { count: 5000 }`). Ces échecs ont-ils produit des articles
  partiels publiés ? Des URLs déclarées sans contenu ? Vérifie.
- Le juge (`judge_thresholds`) rejette en `needs_review` = **rejet automatique**, pas une
  file d'attente. Combien d'articles sont dans cet état ? Leurs URLs sont-elles déclarées
  quelque part ? ⚠️ **La chaîne de jugement a changé de nature le 2026-07-09** (commit
  `c8b84f73` : génération 100 % OpenAI, **retrait du juge/fallback Anthropic**) — en plein
  milieu de la fenêtre analysée. Compare la qualité avant/après cette date.
- Le vidage du 2026-07-03 (reformulé au fact-check, cf. §4.1 Suspect n°2) : `BLOG_POSTS`
  ne portait que 3 posts FS ; les vrais événements du jour sont 10 archivages, 2 noindex,
  des renommages de slugs et 11 redirects 308 (commit `2b5d14ec`). **Vérifie la corrélation
  de CES événements-là avec la courbe de juillet** — pas d'un « vidage » qui n'a pas eu lieu.
- **Audit qualité du contenu publié** : prends 15 articles publiés, évalue honnêtement —
  profondeur, originalité, valeur ajoutée vs les SERP existantes, présence d'expérience
  réelle (E-E-A-T). **Sois brutalement honnête.** Si le contenu généré est du remplissage,
  c'est la cause de « plus de pages, moins de visibilité », et aucun correctif technique
  ne la compensera.
- Le blog a été **vidé le 2026-07-03** (`BLOG_POSTS` purgé). Combien d'URLs sont mortes à ce
  moment ? Sont-elles dans les 463 × 404 ? **Vérifie la corrélation avec la courbe de juillet.**
- Vérifie l'intégrité du **grounding RAG** (FTS lexical, pas vectoriel) : le contenu généré
  est-il ancré sur des sources réelles ou halluciné ?

### 4.11 — La machinerie d'indexation proactive : elle EXISTE — mais tourne-t-elle ?

**Fait vérifié dans le code (2026-07-31)** : contrairement à ce qu'on pourrait croire, une
infrastructure complète de notification existe déjà. L'audit ne doit pas la re-proposer,
il doit **prouver qu'elle fonctionne en prod** — ou trouver pourquoi elle est morte.
Inventaire :

| Composant | Fichier | Rôle |
|---|---|---|
| Worker IndexNow | `src/server/queue/workers/content-indexnow-worker.ts` | ping Bing/Yandex à la publication |
| Worker Google Indexing API | `src/server/queue/workers/content-google-indexing-worker.ts` | API officielle (limitée `JobPosting`/`BroadcastEvent`) |
| Client Indexing API | `src/server/content-gen/seo/indexing-client.ts` | OAuth Google |
| Client Bing WMT | `src/server/content-gen/seo/bing-wmt-client.ts` | soumission Bing Webmaster |
| Helper direct | `src/lib/indexnow.ts` | appel direct `api.indexnow.org` (bypass de la route API) |
| Enqueue | `src/server/content-gen/indexing/enqueue.ts` + `url-builder.ts` | mise en file des pings |
| Route manuelle | `src/app/api/indexnow/route.ts` (+ `key/route.ts`) | debug/manuel, HMAC obligatoire |

**Points de défaillance à vérifier un par un, preuves à l'appui :**

1. **Le kill-switch coupe les pings — question TRANCHÉE au fact-check 2026-07-31** :
   `content-indexnow-worker.ts:74` porte le même guard que le worker Google, et **14
   workers `content-*` au total** le portent (gen, publish, indexnow, google-indexing,
   news-lifecycle, tier-lifecycle, quality-improver, fact-check, orchestrator, rss-fetch,
   qa-extract, keyword-sync, similarity-monitor, web-vitals-monitor). Kill-switch ON =
   **toute la boucle éditoriale ET la boucle de notification BullMQ s'arrêtent**, y
   compris dépublication news et promotion de tiers. MAIS deux canaux échappent au guard :
   le chemin direct `pingIndexNow()` (`src/lib/indexnow.ts`, appelé par les server actions
   admin — **aucun guard**) et les crons GitHub Actions (cf. point 6). ⚠️ Deux réserves :
   (a) « ON depuis le 2026-07-22 » est une **assertion non vérifiée dans le repo** — l'état
   vit en base (`readContentGenConfig("kill_switch")`) : **requête DB obligatoire** avant
   de dater quoi que ce soit ; (b) il n'existe **pas de worker Bing WMT** — seulement le
   client (`bing-wmt-client.ts`) : trouve qui l'appelle, ou constate qu'il est orphelin.
2. **Les credentials sont-ils posés en prod ?** `content-google-indexing-worker.ts:44`
   skippe sans alerte ni métrique (un `console.warn` en stdout uniquement) si
   `INDEXING_OAUTH_REFRESH_TOKEN` ou `GSC_OAUTH_CLIENT_*` manquent. Vérifie sur le VPS
   (`ssh axion-prod`, env du conteneur **worker** `oqj5…` — c'est lui qui exécute BullMQ,
   pas l'app web). Idem `INDEXNOW_KEY`. **Pire encore** : `pingIndexNow()` est
   fire-and-forget (`void fetch`, `indexnow.ts:68`) et **no-op TOTALEMENT silencieux sans
   `INDEXNOW_KEY` — le warn est supprimé en production** (`indexnow.ts:40`,
   `NODE_ENV !== "production"`). C'est la panne muette parfaite : vérifie la clé partout.
3. **La file tourne-t-elle ?** Compte les jobs des queues `content-google-indexing` /
   indexnow en Redis : combien de `completed` / `failed` sur les 90 derniers jours ?
   Les logs du worker (`docker logs`) montrent-ils des `published` ou des `skipped` ?
4. **Quels événements déclenchent l'enqueue ?** Publication seulement ? Mise à jour ?
   Suppression (tombstone) ? Les 54 fichiers qui référencent IndexNow (actions admin
   blog/faq/reviews/case-studies/job-offers/knowledge/image-bank…) l'appellent-ils tous
   vraiment, ou certains chemins de publication passent-ils à côté ?
5. **`/carrieres` + Indexing API** : les `JobPosting` passent-ils réellement par le worker
   Google ? C'est le seul usage 100 % conforme aux règles Google — s'il ne marche pas,
   c'est un gain immédiat.
6. **Les 6 crons SEO GitHub Actions** (`.github/workflows/`) — un canal entier hors
   kill-switch et hors workers, à intégrer dans la chronologie §5 :
   - `gsc-crawl-stats-weekly.yml` (lundi 08:00 UTC) — **c'est lui qui produit les
     `_AUDIT/crawl-stats-2026-W*.csv`** (OAuth `GSC_OAUTH_*`, commit auto sur main) ;
   - `gsc-submit-main-sitemap.yml` (lundi 06:12 UTC) — re-soumission hebdo du
     sitemap-index à GSC ; ⚠️ son header documente un **403 si le refresh token n'a pas
     le scope `webmasters` write** — vérifie les runs récents ;
   - `gsc-submit-image-sitemaps.yml` ; `indexnow-images.yml` ;
   - `daily-indexnow-resubmit.yml` (02:00 UTC) — re-ping IndexNow des URLs
     `lastmod ≥ J-7` découvertes **depuis le sitemap public, sans DB ni kill-switch** →
     l'hypothèse « plus aucun ping depuis le 22/07 » est probablement **fausse pour
     IndexNow** ; vérifie ses runs ;
   - **`cloudflare-purge-weekly.yml` (dimanche 04:00 UTC) — un SECOND `purge_everything`,
     hebdomadaire**, en plus du job post-deploy. Une purge CDN totale récurrente et datée
     est un candidat de premier ordre pour des dents de scie à périodicité hebdo (§5).
- Y a-t-il un **ping sitemap** automatisé ? (le ping `/ping?sitemap=` est déprécié depuis
  2023 — ne pas le proposer).
- **Le monitoring de l'indexation EXISTE déjà — vérifie qu'il tourne au lieu de le
  proposer** : le module Site Explorer (`src/server/site-explorer/{route-enumerator,
  discovery-runner,indexability,categories}.ts`) + 4 workers BullMQ
  (`site-route-discovery-worker`, `site-route-inspector-worker` cron 02:00 UTC,
  `site-route-anomaly-detector-worker` cron 03:00 UTC, `site-route-gsc-worker`) + console
  admin `[adminPrefix]/site-explorer`. L'anomaly detector détecte déjà 9 types dont
  **orphan_page** (aucun lien interne entrant), **thin_content** (< 300 mots), 404,
  duplicate title/description/H1 — soit exactement ce que les §4.6 et §4.12 demandent.
  **Avant tout recalcul manuel, interroge les tables `SiteRoute` / `SiteRouteAnomaly`**
  et vérifie que ces 4 workers tournent réellement sur le conteneur worker. ⚠️ Piège
  documenté dans `indexability.ts:134-141` : les pages passées `noindex` sortent du pool
  d'échantillonnage GSC (400 URLs/run sur ~2 162) et leurs métriques **se figent tout en
  restant affichées** — le Site Explorer a déjà « affirmé le contraire de la production »
  (commentaire daté 2026-07-26, `indexability.ts:149-157`). Vérifie aussi
  `gsc-hcu-monitor-worker.ts:34` : gaté `GSC_HCU_MONITOR_ENABLED`, **V1 squelette qui
  retourne des données stub** — désactivé par défaut, panne invisible type.

### 4.12 — Maillage interne et profondeur de clic

Sur 17 629 routes avec un budget de 216 crawls/jour, **le maillage interne est le levier
principal** de hiérarchisation. Google crawle ce qui est bien lié.

- Calcule la **profondeur de clic** depuis la home pour un échantillon de 100 URLs de chaque
  famille. Toute page à plus de 3-4 clics est structurellement condamnée à « Détectée,
  non indexée ».
- Combien de **liens internes entrants** pointent vers une page ville T3/T4 typique ? Si la
  réponse est « uniquement le sitemap », c'est la cause du bucket 884.
- Y a-t-il des **hubs** (pages de listing par région, par secteur, par service) réellement
  liés depuis la navigation ? Sont-ils paginés au point de rendre les pages profondes
  inatteignables ?
- Les liens sont-ils dans le **HTML servi** ou injectés côté client ? (Googlebot rend le JS,
  mais avec un délai et un coût — sur un budget de crawl contraint, c'est un handicap réel).
  Vérifie avec `curl -s <url> | grep -c '<a '` vs le DOM rendu.
- **Le footer et le méga-menu** : combien de liens ? Un footer à 200 liens dilue le PageRank
  au lieu de le concentrer.
- Y a-t-il des **liens vers des URLs qui 301 ou 404** dans le maillage interne ? Chaque
  occurrence gaspille du budget de crawl. Crawle le site (script Node local ou outil) et
  compte.

### 4.13 — Cloudflare et la couche edge

- **Le Managed Challenge a déjà masqué un bug entier** (le 307 EN). Quelle est la
  configuration actuelle du WAF / Bot Fight Mode / Managed Challenge ? Googlebot est-il
  **vérifié et exempté** ? Un challenge servi à Googlebot = 403 (les 3 pages « Bloquée 403 »
  du rapport pourraient venir de là — **vérifie**). Fait acquis au balayage 2026-07-31 :
  **aucun 403 applicatif sur les pages publiques** (les seuls 403 du code sont sous
  `/api/**` admin, déjà `Disallow` en robots) et **Turnstile est hors du chemin de crawl**
  (formulaires + chatbot uniquement) → les 3 × 403 sont à chercher **exclusivement côté
  Cloudflare**.
- **Bot Fight Mode est explicitement incompatible avec un crawl SEO sain** s'il n'est pas
  configuré en mode « Super Bot Fight Mode » avec allow-list des bots vérifiés. Vérifie.
- Règles de cache, Page Rules, Transform Rules, Redirect Rules : y en a-t-il qui interfèrent
  avec les redirections applicatives (double redirection www + locale) ?
- Le `purge_everything` du job 4 du pipeline (§4.3) — coût mesuré.
- Y a-t-il du **rate limiting** qui pourrait toucher Googlebot lors d'un crawl soutenu ?
- Vérifie les en-têtes servis : `x-robots-tag`, `vary`, `cf-cache-status`, `age`,
  `content-encoding`, et la présence éventuelle d'un `noindex` injecté à l'edge.

### 4.14 — Données structurées, rendu et Web Vitals côté SERP

- **JSON-LD** : valide-le sur 10 pages types. Rappel : **`curl`, pas WebFetch** (WebFetch
  supprime les `<script>` et te fera conclure à tort qu'il n'y a pas de JSON-LD).
  Cherche : `@type` incohérents, `Organization` dupliquée, `LocalBusiness` sur des villes où
  il n'y a pas d'établissement réel (**risque de spam structuré**), `Article` sans `author`
  crédible, `FAQPage` sur du contenu non-FAQ, `AggregateRating` non conforme.
- Le SIRET/l'identité légale sont posés à 4 endroits — sont-ils cohérents dans le JSON-LD
  `Organization` ? (Incohérence NAP = frein au Knowledge Panel et à la confiance).
- **Rendu** : les pages servent-elles leur contenu principal dans le HTML initial ? Vérifie
  qu'aucune section clé n'est client-only.
- **Web Vitals réels (CrUX/GSC)** vs les cibles internes. Les budgets internes sont plus
  stricts que Google — mais les mesures **terrain** (p75 sur trafic réel) sont-elles bonnes ?
  Un LCP dégradé sur mobile est un facteur de classement direct.
- Le rapport « Ergonomie mobile » / « Core Web Vitals » de GSC dit quoi ? (à demander à Will
  s'il n'est pas dans l'export).

### 4.15 — `middleware.ts` racine : du CODE MORT qui devait protéger le budget de crawl

**Découverte du balayage 2026-07-31, à re-prouver puis à traiter en P0.**

`middleware.ts` existe **à la racine du projet**, mais l'app vit dans `src/` — Next 16 ne
charge les conventions `middleware`/`proxy` que depuis le dossier de convention
(`<proj>/src`). Il n'existe pas de `src/middleware.ts` ; seul `src/proxy.ts` est bundlé.
Preuve empirique déjà relevée : le bundle compilé `.next/dev/server/middleware.js` contient
le code de `proxy.ts` mais **zéro occurrence** de `axion_ref_city` ni de `X-Robots-Tag`.

Conséquences si confirmé sur le build de prod :

- `middleware.ts:137-139` prétend émettre **`X-Robots-Tag: noindex, follow` sur ~17 000
  stubs pSEO** avec la justification « divise le coût crawl budget par ~5 ». **Ce header
  n'est jamais servi.** Le seul noindex réel est le `<meta>` dans le HTML → Googlebot doit
  télécharger et rendre chaque stub pour découvrir qu'il est noindex. C'est un gaspillage
  massif de budget de crawl (§4.7), et l'inverse exact de ce que le code documente.
- Les cookies d'attribution `axion_utm` / `axion_ref_city` / `axion_ref_region`
  (`middleware.ts:94-125`) ne sont jamais posés — perte produit silencieuse, hors scope
  SEO mais à signaler.

**À faire** : (1) prouver sur l'image de prod (pas le build dev) que le middleware racine
est absent du bundle ; (2) décider du sort du fichier — fusionner sa logique dans
`src/proxy.ts` ou le supprimer ; (3) chiffrer le gain de crawl d'un `X-Robots-Tag` early
(header servi avant tout rendu) sur les stubs pSEO restants ; (4) chercher d'autres
fichiers de convention orphelins du même type (instrumentation, etc.).

---

## 5. LES DENTS DE SCIE — MÉTHODE D'ANALYSE IMPOSÉE

Ne te contente pas de décrire les courbes. **Construis la corrélation.**

Produis un tableau unique, une ligne par jour du 2026-05-01 au 2026-07-31, colonnes :

| Date | Deploys | Requêtes crawl | Temps réponse | % 5xx | % 404 | Publications | Incidents | Chgt code SEO | Inflexion GSC |
|---|---|---|---|---|---|---|---|---|---|

Sources : `git log origin/main --format='%ad %h %s' --date=short --since=2026-05-01`,
les CSV de crawl, l'historique `_AUDIT/crawl-stats-2026-W*.csv`, les logs de déploiement
GitHub Actions, et l'historique des publications en DB.

Puis teste explicitement chacun de ces **mécanismes candidats** — pour chacun, écris
`CONFIRMÉ` / `RÉFUTÉ` / `INDÉTERMINÉ` avec la preuve :

1. **Deploy → pages vides + cache purgé** (§4.3) : chaque livraison crée une fenêtre de
   contenu dégradé servi à Googlebot. Signature attendue : creux calé sur les dates de deploy.
2. **Gating anti-vide des sitemaps** (§4.4) : des sub-sitemaps entrent et sortent de l'index.
   Signature attendue : chute de « découvertes » quand un sitemap disparaît.
3. **Fenêtre 48 h de `sitemap-news.xml`** : clignotement structurel permanent.
4. **Kill-switch (date à confirmer EN BASE — « 22/07 » est non vérifié)** : s'il est ON,
   **14 workers content-*** s'arrêtent — génération, publication, dépublication news,
   promotion de tiers, ET pings BullMQ (IndexNow + Google Indexing). Mais les crons GH
   Actions (daily-indexnow-resubmit, gsc-submit) et le chemin direct `pingIndexNow()` des
   actions admin **continuent**. La courbe `Graphique.csv` culmine à 98 le 07/07 puis
   décroît continûment jusqu'à 4 le 31/07 — teste si une cassure de pente correspond à la
   vraie date du kill-switch.
5. **Bascules du 2026-07-03 (commit `2b5d14ec`) + tombstones soft-410** — ampleur
   corrigée : PAS un « vidage du blog » (58 articles DB restés vivants) mais **10 articles
   archivés (→ tombstones 200+noindex), 2 noindexés, des slugs renommés (→ 307 !, cf.
   §4.2), 11 redirects 308, et le CAP villes (~1 336 noindex) le même jour**. Google
   désindexe au fil des recrawls → chute par vagues, au rythme du recrawl, pas de
   l'événement. **Mécanisme à retardement** : le 03/07 peut produire des dents de scie
   tout juillet.
5bis. **Changement de chaîne de jugement le 2026-07-09** (commit `c8b84f73` : génération
   100 % OpenAI, retrait du juge/fallback Anthropic) — un changement de nature du contenu
   publié en plein milieu de la fenêtre analysée. À placer dans la chronologie et à
   corréler avec la qualité perçue (§4.10).
6. **Incident VPS 2026-07-23/24** (26 765 ms, 5xx) : suspension du crawl par Google.
7. **`lastmod` figé** (§4.5) : effondrement progressif de l'actualisation.
8. **Indexation de pages vides puis désindexation** : la signature exacte du symptôme décrit
   par Will (« plus de pages indexées, moins de visibilité »).
9. **Simple latence de reporting GSC** : les données GSC ont 2-3 jours de retard et sont
   consolidées ; une partie du « bruit » peut être un artefact. **Élimine cet artefact avant
   d'interpréter** — sinon tout le reste est faussé.
9bis. **La purge Cloudflare hebdomadaire du dimanche 04:00 UTC**
   (`cloudflare-purge-weekly.yml`, cf. §4.11.6) : un `purge_everything` récurrent et daté
   → chaque lundi, Googlebot (dont le pic de crawl hebdo est souvent en début de semaine)
   frappe un CDN froid. **Teste la périodicité hebdomadaire des courbes en premier** : si
   les dents de scie ont un motif à 7 jours calé sur le dimanche, c'est ce mécanisme.
9ter. **Le cap villes du 2026-07-03 + le vidage du blog le même jour** (§4.1 Suspect n°0) :
   deux bascules massives simultanées → « pages indexées » chute par vagues au rythme du
   recrawl pendant des semaines. Sépare leurs contributions si possible (familles d'URLs
   distinctes).
9quater. **Les `noindex` conditionnels à l'état DB** (galerie `hasSubstantiveContent`,
   tiers d'articles promus/rétrogradés au CTR, gate anti-thin glossaire — §4.1 Suspect
   n°1bis) : des pages qui **changent d'indexabilité d'un crawl à l'autre** sans
   déploiement. Signature attendue : oscillations non corrélées aux deploys.
10. **Volatilité SERP / mises à jour d'algorithme Google** sur la période. Vérifie s'il y a eu
    des core updates entre mai et juillet 2026 ; si oui, distingue ce qui est subi de ce qui
    est auto-infligé. **N'utilise jamais « core update » comme explication par défaut** —
    c'est l'excuse qui empêche de trouver la vraie cause.

**Le rapport doit conclure sur une hiérarchie pondérée**, pas sur une liste.

---

## 6. L'INVENTAIRE DES BARRIÈRES — TESTER « ON EST TROP CONSERVATEURS »

Le code porte des dizaines de garde-fous, chacun ajouté par un audit daté, chacun rationnel
**pris isolément**. La question est leur **effet cumulé**. Fais l'inventaire complet et rends
un verdict argumenté sur chacun.

Barrières déjà identifiées (liste **non exhaustive** — complète-la) :

⚠️ Lignes `robots.ts` ci-dessous = **`origin/main` du 2026-07-31** (décalées de +32 vs le
working tree au-delà de l.80). `COMMON_ALLOW` compte désormais 6 entrées dont
`/api/markdown/` (ajout récent), `/_next/image`, `/_next/static` — et `/en/*` n'est
**volontairement PAS bloqué** en robots (décision documentée « Audit GSC 2026-06-05
A-03 », l.124-132) : une barrière **déjà retirée**, à noter comme précédent.

| # | Barrière | Emplacement | Date/justif. d'origine | Verdict attendu |
|---|---|---|---|---|
| 1 | `Disallow` sur **15** chemins | `robots.ts:15-44` | hygiène, audits 05/06 | ? |
| 2 | Blocage `Google-Extended` | `robots.ts:144` | doctrine anti-training 06-22 | ? |
| 3 | Blocage `GPTBot`/`ClaudeBot`/`anthropic-ai`/`Applebot-Extended` | `robots.ts:140-146` | idem | ? |
| 4 | Blocage `CCBot`/`Bytespider`/`omgili`/`Diffbot` | `robots.ts:148-153` | scrapers | ? |
| 5 | `crawlDelay: 1` sur Bingbot | `robots.ts:182` | protection origin 05-15 | ? |
| 6 | `Disallow: /logos/clients/` | `robots.ts:43` | SERP off-brand 06-20 | ? |
| 7 | Gating anti-vide de 6 sub-sitemaps | `sitemap-index.xml/route.ts:282-291` | « urlset vide » | ? |
| 8 | `images-en.xml` gaté sur `EN_LOCALE_ENABLED` | idem:289 | EN désactivé | ? |
| 9 | `lastmod` figés — **2 baselines** : `EDITORIAL_BASELINE` (06-08) + `VILLES_EDITORIAL` (**05-26**, la plus grosse famille) | `sitemap.ts:457,464` + `route.ts:145` | anti date-gaming | ? |
| 10 | 301 EN→FR sur tout `/en/*` | `proxy.ts` | bug next-intl 05-16 | ? |
| 11 | Sitemaps images EN hors index | PR 243 | 301→FR | ? |
| 12 | Kill-switch content-gen ON — **coupe aussi les pings d'indexation** (guard vérifié `content-google-indexing-worker.ts:38` ; vérifier les autres workers) | ligne DB | 07-22 | ? |
| 13 | Seuils du juge `judge_thresholds` | DB | qualité | ? |
| 13b | Tombstone **soft-410** = 200+`noindex` au lieu d'un vrai 410 (purge lente, crawl gaspillé) | `tombstone.ts` | V1, vrai 410 différé V2 | ? |
| 13c | HMAC sur `/api/indexnow` — route de **debug uniquement** (le pipeline réel passe par `lib/indexnow.ts`) : coût indexation = 0, verdict mécanique `GARDER` | `api/indexnow/route.ts:6-8` | anti-abus 05-16 | GARDER |
| 14 | `revalidate` élevés (3600 / 86400) | multiples | charge origin | ? |
| 15 | Managed Challenge / Bot Fight Cloudflare | plateforme CF | anti-bot | ? |
| 16 | **CAP indexation villes T1/T2+curées — ~1 336 villes noindex + hors sitemap** | `villes/index.ts:263-285` | décision Will 07-03 | ? |
| 17 | `noindex` sur les surfaces privées | multiples `page.tsx` | RGPD/privé | ? |
| 18 | Tiers d'articles `tier_2/3_noindex` promus au CTR | `indexability.ts:85-96`, `blog/index.ts:54-56` | qualité auto | ? |
| 19 | Gate anti-thin glossaire `GLOSSARY_MIN_INDEX_WORDS` | `indexability.ts:149-157` | thin content | ? |
| 20 | `noindex` conditionnel galerie (`hasSubstantiveContent`, traduction absente) | `galerie/[slug]/page.tsx:38,116` | qualité images | ? |
| 21 | Purge CF hebdo `purge_everything` dimanche 04:00 UTC | `cloudflare-purge-weekly.yml` | fraîcheur CDN | ? |
| 22 | `NOINDEX_STATIC_PATHS` dupliqué à la main vs `EXCLUDED_FROM_INDEX` | `indexability.ts:50-62` / `sitemap.ts` | hygiène | ? |

Pour chaque ligne, réponds à **trois questions** :

1. **Le risque qui l'a motivée est-il encore réel aujourd'hui ?** (avec la preuve)
2. **Quel est son coût mesuré en indexation/visibilité ?** (chiffré, pas supposé)
3. **`GARDER` / `ASSOUPLIR` (comment, précisément) / `SUPPRIMER` ?**

**Nuance à respecter, sinon l'audit est inutile** : « moins de barrières » n'est pas
automatiquement « plus de visibilité ». Ouvrir le crawl sur 17 629 pages faiblement
différenciées peut **aggraver** le problème en diluant le budget. Les barrières à retirer
sont celles qui **empêchent Google d'accéder au bon contenu** ; celles qui **protègent le
budget de crawl du mauvais contenu** sont peut-être à **renforcer**. Dis lesquelles sont
lesquelles, et assume l'arbitrage.

---

## 7. CE QUE DOIT CONTENIR LE PLAN DE REMÉDIATION

Objectif final : **indexation automatique, maximale et robuste.** Décline-le en trois
propriétés mesurables, chacune avec son plan :

- **Automatique** : aucune action manuelle requise pour qu'une nouvelle URL soit découverte,
  crawlée et indexée. Décris la boucle complète : publication → sitemap → ping → crawl →
  indexation → **vérification**.
- **Maximale** : le maximum d'URLs *méritantes* indexées. Suppose de définir « méritante »
  et d'**assumer de retirer** les URLs qui ne le sont pas.
- **Robuste** : aucun déploiement, aucun incident, aucun creux de publication ne doit faire
  chuter l'indexation. C'est le point le plus faible aujourd'hui (§4.3, §4.4, §4.8).

Chaque item du plan porte : `P0/P1/P2` · fichiers touchés · effort · risque de régression ·
**gain attendu chiffré** · **méthode de vérification** · impact Web Vitals.

Sépare nettement :
- ce qui est **codable** (PR),
- ce qui relève de **la plateforme** (Coolify, Cloudflare, DNS),
- ce qui relève de **GSC/Will** (validations, suppressions, soumissions, propriétés).

Termine par un **dispositif de mesure** : sans instrumentation, le prochain audit repartira
de zéro. Propose le suivi minimal (indexation par famille d'URL, taux de crawl, taux d'erreur,
temps de réponse) et où il vit.

---

## 8. PIÈGES CONNUS — NE PAS Y TOMBER

- **`WebFetch` supprime les `<script>`** → inutilisable pour JSON-LD. Toujours `curl`.
- **Le working tree est partagé** entre conversations et peut être très en retard.
  `git fetch` + `git show origin/main:<f>` avant toute affirmation sur le déployé.
- **`gh pr merge --auto` fusionne IMMÉDIATEMENT** sur ce dépôt (aucun status check obligatoire
  côté GitHub) — et fusionner annule le déploiement en cours.
- **`git push` déclenche la suite de tests complète en pre-push** (> 10 min) → `run_in_background`.
- **Les notes de mémoire peuvent être fausses.** Trois l'ont été le même jour. Le code fait foi.
  Et une note qui révèle une **décision de Will** n'est pas un bug à corriger.
- **`prisma migrate deploy` échoue silencieusement au boot** — vérifier `_prisma_migrations`.
- **Le cache ISR de Next** n'est pas le cache Cloudflare. `?cb=` ne contourne pas l'ISR.
- **Un échec du Gate A saute les gates B/C/D** — un vert partiel n'est pas un vert.
- Ne propose **jamais** le ping sitemap `/ping?sitemap=` (déprécié 2023), ni l'API Indexing
  Google hors `JobPosting`/`BroadcastEvent` (contraire aux règles Google).
- **`redirect()` de `next/navigation` émet un 307, `permanentRedirect()` un 308.** Le
  codebase a déjà été piégé (slug-history, cf. §4.2) — tout redirect SEO-porteur doit être
  308/301. Vérifie le code HTTP réel au `curl`, jamais sur la foi du commentaire.
- **Un document d'audit n'est pas une preuve d'exécution** : le « chantier passif
  éditorial » du 21/07 déclarait explicitement « AUCUNE ÉCRITURE EFFECTUÉE » — ce qui n'a
  pas empêché une session ultérieure de le compter comme purge exécutée. Distingue
  toujours inventaire / décision / exécution, et vérifie l'exécution **en base**.
- N'invente **aucune** métrique GSC absente de l'export : si tu as besoin d'un rapport que
  Will n'a pas fourni (Performance : impressions/clics/positions, Core Web Vitals, Liens),
  **demande-le explicitement** dans une section « données manquantes » plutôt que de spéculer.

---

## 9. DONNÉES MANQUANTES À RÉCLAMER À WILL (à faire dès le début)

L'export fourni couvre l'indexation et l'exploration. Côté **performance**, le repo contient
déjà les exports hebdo par page W21→W31 (`_AUDIT/crawl-stats-2026-W*.csv`, cf. §1) — c'est
une vraie série de visibilité, exploite-la d'abord. Réclame en complément :

1. **GSC → Performances → Résultats de recherche**, export 16 mois, avec la dimension
   **requêtes** (absente des CSV W*, qui n'ont que les pages) + pays + appareils, **et la
   comparaison période sur période**. Indispensable pour distinguer « perte de positions
   sur les requêtes qui comptent » de « longue traîne d'impressions faibles en plus ».
2. **GSC → Indexation des pages → export complet des URLs** par raison (les 1 200 `noindex`,
   les 884 détectées, les 463 × 404 — **les listes d'URLs, pas les compteurs**).
3. **GSC → Sitemaps** : le statut de chaque sitemap soumis (date de lecture, URLs découvertes,
   erreurs).
4. **GSC → Core Web Vitals** et **Ergonomie mobile**.
5. **GSC → Liens** (internes et externes).
6. Confirmation des **propriétés GSC déclarées** (domaine vs préfixe d'URL, apex vs www).
7. Accès en lecture aux **logs serveur** de l'origine (le vrai comportement de Googlebot y est,
   pas dans GSC).

Commence l'audit avec ce que tu as, mais **liste ces manques en tête de rapport** et indique
quelles conclusions resteront provisoires sans eux.

---

## 10. CADRE DE TRAVAIL

- Repo : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`
- Travaille en **lecture seule** pendant tout le diagnostic. Aucune modification de code
  tant que le rapport n'est pas rendu et validé par Will.
- Si tu proposes ensuite des correctifs : **worktree isolé**, une PR par cause racine,
  jamais un patch fourre-tout. Rappel : worktree neuf → `npx prisma generate`, et retirer
  la jonction `node_modules` avec `cmd /c rmdir` avant tout `worktree remove`.
- Respecte AGENTS.md intégralement (contrat `stub.invalid`, budgets Web Vitals, gates CI).
- Lis d'abord les audits existants pour ne pas refaire le travail :
  `_AUDIT/PROMPT-SEO-MASTER-2026.md`, `_AUDIT/PROMPT-SEO-AEO-GEO-2026.md`,
  `_AUDIT/pseo-strategy.md`, `_AUDIT/adr-0004-pseo-villes-PROPOSITION.md`,
  `_AUDIT/VERIF-FRONTEND-F-i18n-seo.md`, et les ADR nommément pertinents dans `docs/adr/` :
  **0006-pseo-villes** (décision fondatrice du plus gros segment d'URLs), 0009 (Hetzner +
  Cloudflare Free — contraint les Page/Transform Rules du §4.13), 0026 (build stub),
  0027 (image-bank), 0033 (observatoire auto-update → `lastmod`), 0021/0023 (content-gen),
  0024 (AI Act / disclaimer).
  **Mais ne prends aucune de leurs conclusions pour argent comptant** : certaines ont
  3 mois et le site a changé. Revérifie ce sur quoi tu t'appuies.

---

## 11. CRITÈRE DE RÉUSSITE

L'audit est réussi si, à sa lecture, Will peut répondre **sans ambiguïté** à ces cinq questions :

1. **Pourquoi** les courbes font des dents de scie — le mécanisme, pas une hypothèse.
2. **Pourquoi** le nombre de pages indexées monte pendant que la visibilité baisse.
3. **Quelles** barrières retirer, **lesquelles renforcer**, et pourquoi ce n'est pas
   la même réponse partout.
4. **Quoi faire cette semaine** (P0), avec le gain attendu et comment le mesurer.
5. **Comment il saura**, dans 30 jours, si ça a marché.

Si une seule de ces cinq questions reste sans réponse prouvée, l'audit n'est pas terminé.
