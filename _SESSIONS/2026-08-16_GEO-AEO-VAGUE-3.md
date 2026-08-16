# GEO/AEO — vague 3 · journal de reprise

> **Mis à jour en continu.** Si la session se ferme, **repartir de ce fichier**.
> Dernière écriture : 2026-08-16, après le traçage de GEO-094.

---

## 0. Consignes permanentes de Will

- ⛔ **NE PAS MERGER** — « ça bloque les autres déploiements ». Toutes les PR
  restent ouvertes, y compris quand leurs portes sont vertes.
- 🔴 **Plusieurs conversations travaillent sur le même dépôt.** Toujours ouvrir
  un **worktree isolé** ; ne jamais committer sur la branche trouvée dans
  `axionia/` (elle appartient à quelqu'un d'autre).
- Ne pas régénérer les jetons Telegram (décision actée).

---

## 1. État des PR ouvertes (aucune mergée)

| PR                                 | Sujet                                                 | Vague             |
| ---------------------------------- | ----------------------------------------------------- | ----------------- |
| #641, #644, #646, #648, #649, #651 | vagues 1 et 2                                         | 1-2               |
| **#652**                           | EXIF/GPS + orientation + `fileSize` (banque d'images) | 3 — lot 18        |
| **#654**                           | purge edge + liens internes                           | 3 — lots 19 et 13 |
| **(en cours)**                     | gates de mesure (INP, mobile, crawl-stats)            | 3 — lot 16        |

---

## 2. Ce qui est LIVRÉ dans la vague 3

### Lot 18 — banque d'images (PR #652)

- **GEO-091** `withMetadata()` **conserve** l'EXIF (GPS compris) ; c'est son
  **absence** qui strippe. Trois commentaires du dépôt affirmaient l'inverse,
  dont une fonction **nommée** `stripExifPreserveOrientation`.
- **GEO-092** `{orientation:1}` écrasait l'indice de rotation **sans pivoter les
  pixels** → photo portrait publiée couchée. Les deux correctifs sont
  **indissociables** (`meta.width` = pixels stockés → lire `meta.autoOrient`).
- **Annexe** : `fileSize` valait **0 pour toutes les images**
  (`sharp(chemin).metadata().size` = `undefined`, documenté « Stream and Buffer
  input only »). Le `?? 0` en faisait un zéro plausible.
- Le géotag **volontaire** du worker est conservé, via `withExif()` (qui ignore
  l'EXIF d'entrée). ⚠️ `withExifMerge()` rouvrirait la fuite — un test le montre.
- Garde : 8 tests. Contre-épreuve : 2/8 rougissent avec le code fautif.
- **Contexte Will** : aucun GPS aujourd'hui (tout est importé), photos de
  terrain **dans quelques semaines** → préventif, **rien à reprendre**.

### Lots 19 + 13 — caches et liens (PR #654)

- **GEO-120** aucune publication ne purgeait l'edge. `revalidatePath()`
  n'invalide que l'origine → contenu périmé pour le public et les crawlers
  pendant 1 h à 24 h. Helper `revalidateAndPurge` branché sur
  `/api/internal/revalidate` (couvre le worker de publication **et** le job de
  chauffe). 🔑 **Origine d'abord, edge ensuite** — l'inversion est pire que pas
  de purge. Plafond 30 URLs, **écarts journalisés**.
- **GEO-079 / GEO-081** chaque lien interne des corps d'articles redirigeait
  (`/audit` → 301, `/reserver` → 301 → 308, `/implementations` → 301 → 308).
  Corrigé **aux deux bouts** : réécriture au rendu (couvre tout le stock, zéro
  reprise) **et** correction du gabarit du générateur qui _ordonnait_ au modèle
  d'écrire les mauvaises routes.
- Coût client **nul** : la réécriture est un Server Component, 0 octet de JS.
- Gardes : 10 + 13 tests, contre-épreuve faite sur l'ordre de purge.

### Lot 16 — ce qui mesure (PR en cours)

- **GEO-032** le script « crawl stats » n'exportait **aucune donnée
  d'exploration** : il interroge `searchAnalytics`
  (`page,impressions,clicks,ctr,position`). Cause racine : le rapport
  « Statistiques d'exploration » de GSC **n'a pas d'API publique**. La mesure
  promise était **irréalisable**, pas seulement absente.
  → renommés **dans le même commit** : script, workflow, 13 CSV, glob, et les
  **2 exceptions de l'isolation-check** qui pointaient les anciens noms.
  ⚠️ **Le seuil « budget de crawl < 30 % » n'a jamais été mesuré.**
- **GEO-114** le gate bloquant n'assertait **aucun INP** → ajouté, en `warn`
  (en labo l'INP n'existe que s'il y a interaction ; en `error` on échouerait
  sur une absence de mesure).
- **GEO-121** aucune porte ne mesurait le **mobile** alors que Google indexe en
  mobile-first → passe mobile ajoutée, **toutes assertions en `warn`**, le temps
  d'établir une ligne de base (précaution imposée par le plan de l'audit).
- Garde : 9 tests. ⚠️ **Ils verrouillent « le gate MESURE », pas « le gate
  bloque »** — c'est la seule propriété honnête à ce stade.

---

## 3. RESTE À FAIRE dans la vague 3

### Lot 19 — GEO-061 : 11 pages stratégiques non mises en cache 🔴 GROS MORCEAU

**Reproduit en prod le 2026-08-16** : `/fr/avis`, `/fr/presse`, `/fr/carrieres`,
`/fr/observatoire-ia`, `/fr/galerie`, `/fr/blog/page/2`, `/fr/avis/ville/paris`,
`/fr/appel`, `/fr/roi`, `/fr/simulateur`, `/fr/recherche` → toutes en
`cf-cache-status: BYPASS` + `Cache-Control: private, no-store`.
Témoin : `/fr/blog` et `/fr/cas-concrets` (déjà corrigées le 31/07) émettent
`s-maxage=3600` **sans cookie**.

**Cause** : `await searchParams` dans le composant serveur opte la route hors du
rendu statique. **Le patron de sortie existe déjà** dans le dépôt :
`cas-concrets/CaseStudiesFilteredGrid.tsx` — filtrage **CSS côté client**, le
HTML servi garde l'ensemble complet (donc _meilleur_ pour les IA), ~1 KB gz.

**Difficulté par page** (mesurée, pas estimée) :

| Page                            | Filtre                            | Difficulté                                                                                                                                              |
| ------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/carrieres`                    | en mémoire sur liste déjà chargée | **facile** — bonus : le JSON-LD `ItemList` est aujourd'hui construit sur la liste **filtrée**, donc une URL filtrée déclare à Google une liste tronquée |
| `/presse`                       | **requête DB filtrée**            | moyen — il faut charger tout et filtrer côté client                                                                                                     |
| `/avis`                         | lu aussi dans `generateMetadata`  | moyen                                                                                                                                                   |
| `/galerie`                      | 7 lectures, filtre `module=`      | moyen                                                                                                                                                   |
| `/observatoire-ia`              | **agrégation DB live par filtre** | **difficile** — le filtrage client ne peut pas reproduire une agrégation ; il faut une route API + fetch client                                         |
| `/roi`, `/simulateur`, `/appel` | transactionnelles                 | l'audit autorise à les laisser dynamiques **mais alors retirer leur `revalidate` mort** et les sortir de la liste des « pages stratégiques »            |
| `/recherche`                    | —                                 | **à retirer de la liste** (correction H3)                                                                                                               |

Aussi : `generateStaticParams` à ajouter sur `avis/ville/[ville]` (liste statique,
**sans lecture DB** — contrat `stub.invalid`) et un plancher pages 2-5 pour
`blog/page/[num]`. Et corriger les 2 commentaires mensongers
(`galerie/page.tsx:225`, `blog/page/[num]/page.tsx:9-12`).

### Lot 19 — GEO-118

Les ~480 hubs villes ne régénèrent jamais. ⚠️ **NE PAS** baisser `revalidate` à
3600 (×24 rendus origine sur 480 pages pour un contenu figé). Option retenue :
étendre la liste `PATHS` du job `warm` aux hubs villes « chauds ».
**À trancher avant** : compter `Article.mentionedCities`.

### Lot 13 — reste

- **GEO-088** hub `/connaissances` orphelin : **48** fiches liées sur **507**.
  Paginer (ne pas allonger la liste — budget Web Vitals).
- **GEO-082** l'historique de slugs est écrit pour tous les types mais consommé
  par `/guides` seul → un renommage ailleurs = 404 sec.
  **À trancher par SQL** : `SELECT "oldType", count(*) FROM "KnowledgeSlugHistory" GROUP BY 1`.

### Lot 16 — reste

- **GEO-030** monitoring d'indexation inexistant (HCU-monitor = stub,
  `gscInspectUrl` sans appelant).
- **GEO-133** bouton admin « Ping IndexNow » structurellement mort.
  ⚠️ **Vérifié : aucune occurrence d'IndexNow dans le code admin** — le finding
  demande une relecture avant patch.
- **GEO-134** communiqués de presse : aucune notification aux moteurs.
- **GEO-100 / GEO-078** pilotage GSC aveugle aux images, ne couvre que les
  Articles blog/news.
- **GEO-155** créer un capteur d'UA (⚠️ ne PAS relâcher `sendDefaultPii: false`).
- **GEO-104** chaîne de soumission GSC morte (token OAuth `readonly`) →
  **hors-code, reste Will**.
- **GEO-105/106** Bing : la fonction de soumission est livrée dans **#651**
  (non mergée). Une fois #651 dans `main`, la brancher sur la publication est
  une ligne.

### Lot 18 — reste

- **GEO-089** le seed écrase `alt`/`title`/`caption` par une dérivation du slug,
  et l'enrichissement ne les régénère jamais.
  🔴 **Test à écrire AVANT le patch** (imposé par le plan) : assertion statique
  sur `seed-images.cjs` — `alt`, `title`, `caption` dans le bloc `create`
  et **pas** dans le bloc `update` de l'upsert.
  ⚠️ **Ne PAS relancer l'enrichissement avant ce patch** : le seed se déclenche
  à chaque déploiement et dégraderait 288 pages galerie.
  ❓ Question ouverte : **pourquoi le `workflow_run` du seed ne se déclenche-t-il
  jamais** (24 runs, tous en mai 2026) ?
- **GEO-093** 75 `thumbnailUrl` en 404.
- **GEO-094** 🔴 **TRACÉ LE 2026-08-16 — bien plus profond que « 3 défauts
  divergents ». C'est une DÉCISION DE STOCKAGE, pas un correctif de ligne.**

  Trois écarts qui s'empilent, chacun vérifié dans le code :

  1. **Chemin d'écriture ≠ chemin de lecture.**
     `utils/paths.ts:69` (import, écrit) → `/var/data/image-bank` ;
     `galerie/[slug]/telecharger/route.ts:101` (lit) → `/data/image-bank`.
     La variable n'est déclarée ni dans `env.ts` ni dans aucun `.env*.example`,
     donc en prod **les deux défauts s'appliquent réellement**.
  2. **Le nom du dossier ne correspond pas non plus.** L'import crée
     `join(base, randomUUID())` et ne renvoie ce `uuid` que dans `ImportResult` ;
     `upload.action.ts` ne le passe PAS comme `id` à `imageBankService.create()`.
     La ligne reçoit donc un `id` Prisma distinct. Or la route lit
     `join(base, image.id, …)` → elle cherche un dossier qui n'a jamais existé.
  3. **`filePath` est malformé en production.** `publicUrlFromLocalPath()` ne
     retire que le préfixe `public/` et rajoute `/`. En prod le chemin est déjà
     absolu (`/var/data/image-bank/<uuid>/image-lg.webp`) → le résultat est
     `//var/data/image-bank/…`, c'est-à-dire une **URL protocole-relative** que
     le navigateur résout en `https://var/data/…`.

  🔑 **Conséquence** : les images téléversées depuis la console n'ont jamais pu
  ni s'afficher ni se télécharger en production. Les visuels visibles
  aujourd'hui sont ceux du seed (chemin `public/`, branche `isSlugBased`), qui
  emprunte un tout autre code.

  ⛔ **NON PATCHÉ VOLONTAIREMENT.** Réparer suppose de choisir comment les
  fichiers sont servis (volume Docker derrière une route, CDN, ou `public/`) —
  c'est une décision d'architecture. La corriger à moitié (aligner seulement le
  chemin de base) laisserait les téléchargements en 404 tout en donnant
  l'impression que c'est réglé. **À trancher avec Will avant patch.**
- **GEO-095** `trackUsage()` sans appelant — 🔴 **bloqué : lot 9 d'abord**,
  sinon il fabrique la pollution de `lastmod` qu'on vient de corriger.
- **GEO-098 / GEO-102 / GEO-015** contenu des visuels (hero hors-sujet, `alt` en
  anglais, « RECOMMANDATIONS CONCRÉTÉS ») → largement hors-code.
- ⛔ **NE PAS ajouter `image-bank:isolation-check` à la CI** avant d'avoir soldé
  les 18 violations existantes : il bloquerait **toutes** les PR.

---

## 4. Pièges d'outillage retrouvés (ne pas les repayer)

- `sed -n '13p;30p'` restitue les lignes **dans l'ordre du fichier**, pas dans
  l'ordre demandé → m'a fait écraser 2 entrées de l'index mémoire (restaurées).
- `prettier --check .` signale **4 864 fichiers** sous Windows : ce sont les
  **fins de ligne CRLF**, pas du formatage. **Jamais** `--write` sur le dépôt.
- `git push … | tail` peut rendre `EXIT=0` **sans rien pousser** → vérifier avec
  `git ls-remote --heads origin`.
- Les worktrees neufs n'ont **pas** de `node_modules` → faire tourner les portes
  dans le worktree principal, puis **copier** les fichiers et rendre le
  principal à son état d'origine (`git checkout --`).
- Python sous Windows : `PYTHONIOENCODING=utf-8` obligatoire dès qu'on imprime
  du français, sinon `UnicodeEncodeError` **après** une écriture partielle.
