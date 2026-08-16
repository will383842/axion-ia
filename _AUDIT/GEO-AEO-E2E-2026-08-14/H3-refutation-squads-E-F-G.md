# H3 — Contre-vérification adversariale des squads E, F et G

- **Date des mesures** : 2026-08-15, **01:40 → 02:15 UTC**.
- **Fenêtre de déploiement** : dernier run `deploy-coolify.yml` = `31830868520`
  (sha `f51d544b`), **atterri ~19:50 UTC le 2026-08-14, workflow terminé 20:00:36 UTC**.
  Aucun run depuis. Toutes mes mesures tombent donc **≥ 5 h 40 après l'atterrissage**,
  c'est-à-dire **très au-delà de la fenêtre ISR/edge d'une heure**. C'est le principal
  levier de cette contre-vérification : tout finding décrit comme « fenêtre post-deploy »
  a pu être re-testé **hors** de sa fenêtre, ce qui permet de séparer ce qui est
  *transitoire* de ce qui est *permanent*. Le build servi pendant mes mesures est
  `x-axion-build-sha: f51d544b64c8ad50fc870d87b9941d6ce5419d7e`.
- **Périmètre** : les **71 findings P0 et P1** des 15 rapports E1→E4, F1→F7, G1→G4.
- **Méthode** : (1) relecture ligne à ligne du code cité (déléguée à deux vérificateurs
  en lecture seule, résultats recoupés) ; (2) **re-mesure live indépendante** en GET/HEAD
  seuls ; (3) re-tirage des mesures fragiles (Google Suggest, moteur de réponse IA,
  registre SIRENE, fiches tierces) ; (4) recherche active d'un code compensatoire, d'un
  test verrou ou d'une décision actée contredisant le finding ; (5) arithmétique refaite
  à la main sur les CSV GSC.

---

## Résumé exécutif

**64 CONFIRMÉS · 1 RÉFUTÉ (partiel) · 6 INCERTAINS**, sur 71 findings P0/P1.

Le corpus E/F/G résiste très bien à l'attaque : les mesures live sont reproductibles,
les citations de code sont majoritairement exactes, et plusieurs findings se révèlent
**plus graves** que ne le disaient leurs auteurs. Mais l'exercice élimine un faux
positif net et **casse cinq root-causes** qui, si on les avait suivies, auraient produit
des patches inutiles ou dangereux :

1. **RÉFUTÉ — F1-P1d, volet `guides`.** « Les fiches enfants ne sont déclarées dans
   aucun sitemap » est **faux pour les guides** : `sitemap-blog.xml` déclare bien les
   `/fr/guides/<slug>`, et c'est un **choix documenté** (`src/app/sitemap.ts:131-133` :
   « Les guides individuels restent émis via sub-sitemap `blog` … Le sub-sitemap `guides`
   ne contient que le hub lui-même »). Seul le volet `glossaire` est un vrai bug.
2. **Root-cause RÉFUTÉE — E1-P0b (« 490 € »).** L'affiche métro ne contient **aucun
   montant** (inspection visuelle du fichier servi). Le prix mort ne vient pas d'un OCR
   Vision de l'image : il est **injecté dans le prompt système**
   (`scripts/enrich-images.cjs:41` : « Axion-IA : Formations IA · **Audits IA 490€** ·
   Implémentations IA · 1-to-1 »). Le patch (3) prescrit — « dépublier/retoucher
   l'affiche source » — est donc sans objet pour le prix.
3. **Root-cause RÉFUTÉE — E1-P0a (« écrasement à chaque déploiement »).** Le workflow
   `image-bank-seed.yml` totalise **24 runs, tous `workflow_dispatch`, tous des 20-21 mai
   2026, zéro run `workflow_run`** — malgré des dizaines de déploiements réussis depuis,
   un `name:` qui correspond exactement et un état `active`. L'écrasement est
   **historique et non récurrent**. Corollaire pratique : la mise en garde « ne pas
   relancer l'enrich sans le patch (a), sinon nouvelle perte au prochain seed » tombe.
4. **Mécanisme corrigé — F5-P0b / F3-P1a / G3-P0 (chauffe qui épingle la version stub).**
   La mesure de F5 se contredit elle-même : `/fr/mentions-legales` était en
   `cf-cache-status: MISS` à 19:09:38, soit **43 min après le deploy et 34 min après la
   fin du job `warm`**. Le sweep de chauffe n'avait donc **pas** mis cette page en cache
   sur le PoP interrogé. Explication la plus probable : **le cache Cloudflare est par
   datacenter** — un warmer qui tourne depuis un runner GitHub ne chauffe pas le PoP
   (MRS/Marseille) que voient les visiteurs français et Googlebot-EU. Le fond des trois
   findings tient (les listes `PATHS`/`FILES` oublient `/fr` et `/fr/mentions-legales`),
   mais « c'est le warmer qui fige » n'est **pas** établi ; c'est le **premier
   visiteur/crawler du PoP** qui fige.
5. **Prémisse fragilisée — F7-P1a (Sentry).** L'absence de `user-agent` dans
   `SENSITIVE_HEADER_KEYS` (vérifiée : la liste est `authorization, cookie, set-cookie,
   x-csrf-token, x-auth-token, x-api-key, proxy-authorization`) **ne prouve pas** que
   l'UA est capté : avec `sendDefaultPii: false` (vérifié, `sentry.server.config.ts:37`),
   le SDK n'attache normalement pas les en-têtes de requête. La « télémétrie de crawl
   gratuite que personne n'exploite » n'existe donc probablement pas encore — le patch
   reste bon, mais c'est une **création**, pas une exploitation.
6. **Gravité à corriger — F6-P0a.** Conformément à l'addendum LinkedIn, l'identité du
   titulaire de `/company/axion-ia` reste derrière l'authwall. L'incohérence interne est
   confirmée (3 occurrences `axion-ia` contre 8 `axion-ia-france`, les deux URL
   coexistant dans le HTML de la home — re-mesuré). La qualification **P0 n'est pas
   établie** : à requalifier **P1** tant que Will n'a pas ouvert le permalien numérique.

À l'inverse, ma contre-hypothèse la plus prometteuse **a échoué** et le finding en sort
renforcé : sur **F2-P0**, j'ai testé l'idée que la dégradation de position moyenne soit un
simple artefact de composition (185 pages neuves qui ranquent bas tirent la moyenne).
Restreint à la **cohorte des 83 pages présentes en W31 *et* en W33**, le résultat est
**pire** que l'agrégat global : position pondérée **23,19 → 30,17**, clics **15 → 8**, à
impressions en hausse (436 → 666). La dégradation est réelle **sur les mêmes pages**.

---

# Findings — verdicts détaillés

## Squad E — Images

### E1-P0-a — « Le seed post-deploy écrase alt/titre/légende des 133 images »
**VERDICT : CONFIRMÉ — avec une réfutation majeure de la root-cause et de la portée.**

- **Symptôme confirmé live** (01:50 UTC). `/fr/galerie/axion-ia-audit-entreprise-metro-…-affiche` :
  `alt="Axion-IA — Audit Entreprise Metro Gagner Temps Reduire Couts Affiche"`.
  `sitemaps/images-fr.xml` : les `<image:title>` sont bien tous de la forme
  `Axion-IA — TitleCase(slug)` (échantillon de 12 vérifié, 100 % mécaniques).
- **Code confirmé** : `seed-images.cjs:298-305` réécrit bien `title`/`alt`/`caption` dans
  le bloc `update` ; `enrich-images.cjs:219-221` exclut les lignes ayant un `metaTitle`,
  que le seed ne réinitialise pas → la perte est bien définitive. Le bloc `update` de
  l'enrich est en réalité l.169-179 et le `create` l.180-197 (`title` en l.184) — décalage
  de numérotation sans effet sur le fond.
- 🔴 **RÉFUTÉ — la récurrence.** `gh run list -L 30 --workflow image-bank-seed.yml`
  (02:00 UTC) : **24 runs au total, 100 % `workflow_dispatch`, tous entre le 2026-05-20 et
  le 2026-05-21. Zéro run déclenché par `workflow_run`.** Le déclencheur est pourtant
  syntaxiquement correct (`image-bank-seed.yml:36-39` référence
  `"Build & Deploy · GHCR + Coolify (axion-ia.com)"`, qui est exactement le `name:` de
  `deploy-coolify.yml:1`), le workflow est `state: active`, et le `if:` du job n'est pas
  bloquant. **Empiriquement, il ne s'est jamais déclenché en production.** L'écrasement
  est donc un **événement unique de mai 2026**, pas une boucle vivante.
- 🔴 **Correction de portée de l'impact.** L'impact revendiqué s'appuie pour moitié sur
  les `<image:title>`/`<image:caption>` du sitemap images. Or **E2-P2 du même audit
  établit que Google a déprécié ces extensions en 2022** (seul `<image:loc>` compte) —
  et E4-P2 confirme que l'URL indexée n'est même pas celle déclarée. **Cette moitié de
  l'impact est nulle.** Reste le vrai dommage : l'`alt` du DOM et le `<title>` des
  288 pages galerie.
- **Conséquences sur le patch** : les points (a) et (b) restent utiles en prévention,
  mais ils ne sont **plus urgents** ; le point (d) (re-run `force_enrich`) devient
  **immédiatement sûr** puisque rien ne le réécrasera. Et il faut ajouter au patch une
  question neuve : *pourquoi le `workflow_run` ne se déclenche-t-il jamais ?* — car si on
  le « répare » sans appliquer (a), on **crée** la boucle que le rapport croyait décrire.

### E1-P0-b — « Prix mort 490 € gravé dans un `<title>` indexable et dans le sitemap »
**VERDICT : CONFIRMÉ (symptôme) — root-cause RÉFUTÉE, patch (3) à retirer.**

- **Live 01:52 UTC** : `<title>Audit IA en Entreprise — 490 € | Axion-IA · Axion-IA</title>`
  sur la page galerie de l'affiche. `sitemaps/images-fr.xml` : 2 `<image:caption>` portant
  « audit IA à **490 €** » (l.3037) et « Audit IA Axion-IA (**490 € PME**) » (l.3112).
  `pricing.ts` confirmé : suppression du 490 € distanciel le 2026-05-31, `audit-flash`
  `priceFlat: 1190`, `isFromPrice: true`.
- 🔴 **RÉFUTÉ — « le prix vit dans le pixel de l'affiche, donc il ressort à chaque OCR
  Vision ».** J'ai **regardé le fichier**
  (`public/images/axion-ia-audit-entreprise-metro-gagner-temps-reduire-couts-affiche.webp`) :
  l'affiche ne porte **aucun montant**, ni en €, ni en $. Elle porte « AUDIT EN
  ENTREPRISE », un pictogramme `$` (icône de coût, pas un prix), et le cartouche
  « GAINS MESURABLES ASSURÉS ».
- **Vraie root-cause, trouvée en vérification** : `scripts/enrich-images.cjs:41` injecte
  dans le **prompt système** la ligne
  `Axion-IA : Formations IA · Audits IA 490€ · Implémentations IA · 1-to-1.`
  Le modèle n'a pas lu le prix dans l'image : **on le lui a dicté**.
- **Correction du patch** : (1) nettoyage DB → inchangé ; (2) gate anti-montant →
  inchangé et toujours pertinent ; **(3) « dépublier/retoucher l'affiche source » →
  SANS OBJET pour le prix** (elle reste à traiter pour E3-P1a, autre motif) ; **(4) NOUVEAU
  et prioritaire : corriger `enrich-images.cjs:41` en dérivant le prix de `pricing.ts`
  ou en le supprimant du prompt** — sans quoi tout ré-enrichissement regravera 490 €.
- **Portée réelle** : 1 `<title>` indexable + 2 légendes de sitemap (dont l'extension est
  dépréciée). Gravité P0 défendable au titre du « mensonger », mais la surface est étroite.

### E1-P1 — « Zéro EXIF/XMP/IPTC, `embedCopyrightMetadata()` sans appelant »
**VERDICT : CONFIRMÉ.** Grep exhaustif `src/` + `scripts/` : `embedCopyrightMetadata`,
`stripExifPreserveOrientation`, `validateUploadBuffer`, `generateAllVariants`,
`assertBudget` n'ont **aucun appelant hors du fichier** (seul usage interne :
`image-utils.ts:251`). Module intégralement mort, aucun test verrou.

### E1-P1 — « `withMetadata({orientation:1})` conserve l'EXIF au lieu de le stripper »
**VERDICT : CONFIRMÉ — une imprécision de forme à corriger.**
`node_modules/sharp/lib/index.d.ts:749-756` dit littéralement « **Include all metadata
(EXIF, XMP, IPTC) from the input image** … the default behaviour, when withMetadata is
not used, is to **strip all metadata** ». Le commentaire RGPD de
`image-import.service.ts:72-81` affirme donc **l'exact inverse** du comportement réel.
⚠️ **Correction** : `withMetadata()` n'est **pas** annoté `@deprecated` ; les `@deprecated`
de l.1216/1221 portent sur les **propriétés** `icc` et `exif` de `WriteableMetadata` — que
c'est `embedCopyrightMetadata()` (mort) qui utilise. Ne pas justifier le patch par une
dépréciation qui n'existe pas.

### E1-P1 — « Dimensions et poids fictifs (78/160 faux, `fileSize = 0`) »
**VERDICT : CONFIRMÉ (mécanisme) — les comptages restent au niveau [À CONFIRMER].**
Table `DIMENSIONS` statique (`seed-images.cjs:12-21`) + `detectType(slug)` (l.34-45)
confirmés ; `fileSize: 0` est en **l.243** et `width`/`height` en **l.245-246** (et non
l.234/236-241). Le mécanisme « dimensions devinées depuis le suffixe du slug » est
prouvé. Les chiffres « 78/160 » et « 14 orientations inversées » proviennent d'un balayage
disque local que je n'ai pas rejoué — je les laisse en l'état, ils ne changent pas la
nature du défaut.

### E1-P1 — « 75 `thumbnailUrl` en 404 dans les JSON-LD »
**VERDICT : CONFIRMÉ.** Live 01:48 UTC :
`/images/axion-ia-audit-entreprise-metro-…-affiche-thumb.webp` → **404**, alors que le
`.webp` de base répond 200. `image-seo.service.ts:125-128` émet bien `thumbnailUrl` +
nœud `thumbnail` sans vérifier l'existence. Preuve interne supplémentaire :
`paths.ts:95-99` documente le même constat vérifié en prod le 2026-08-02 et le contourne
**côté console uniquement**. Le comptage « 75 » vient d'un inventaire disque non rejoué.

### E1-P1 — « Chaîne d'upload admin cassée de bout en bout »
**VERDICT : CONFIRMÉ — et plus grave que décrit.**
Les 4 défauts sont exacts. Trois ajouts issus de la vérification :
- `IMAGE_BANK_STORAGE_PATH` a **trois valeurs par défaut divergentes** dans le dépôt :
  `/var/data/image-bank` (`paths.ts:69`, `scripts/backup-image-bank-r2.sh`),
  `/data/image-bank` (`telecharger/route.ts:101`) et `/data/image-bank`
  (`docs/image-bank/README.md:128`). La variable est **absente de `src/env.ts` et de tous
  les `.env*`** → en prod elle est indéfinie, les défauts divergent réellement.
- `telecharger/route.ts:87` teste `!image.filePath.startsWith("/image-bank")` : une URL
  produite en prod (`//var/data/image-bank/…`) tombe dans la branche « slug-based » → 404
  systématique. Défaut non listé par E1.
- **Compensation partielle trouvée** : le chemin **Server Action**
  (`src/server/actions/image-bank/upload.action.ts:100-117`) fait bien l'insert DB avec
  dédup par `fileHash`. C'est le chemin **API route + BullMQ** qui n'est pas compensé.
  Le patch doit le dire, sinon on réécrit une logique qui existe déjà.

### E1-P1 — « `trackUsage()` n'est appelée nulle part »
**VERDICT : CONFIRMÉ.** Grep sur `src/`, `scripts/`, `prisma/`, `tests/` : une seule
occurrence, sa propre définition (`image-bank.service.ts:353`). Zéro appelant.

### E2-P0 — « `acquireLicensePage` → `/fr/cgu` = 404 »
**VERDICT : CONFIRMÉ.** Live 01:47 UTC : `/fr/cgu` → **404**,
`/fr/conditions-generales` → 200. `seo.ts:2089` porte bien
`` acquireLicensePage: `${SITE_URL}/${locale}/cgu` ``. Recherche de compensation
**négative sur les trois voies** : aucune route `src/app/[locale]/cgu/**`, **aucune
redirection `/cgu` dans `next.config.ts`**, aucune entrée dans `routing.ts` (qui ne
connaît que `/conditions-generales`). Nuance de gravité, à porter au plan : le badge
« Licensable » n'a de toute façon jamais été atteignable (E1 prouve zéro IPTC) — la perte
est une **opportunité jamais réalisée**, pas une visibilité perdue. Le caractère
mensonger de la métadonnée justifie néanmoins le P0.

### E2-P1 — « 9 images déclarées ne sont plus affichées (/roi, /formations/entreprise) »
**VERDICT : CONFIRMÉ — et aggravé.** Les 4 entrées `grid` de `/roi`
(`page-images.ts:1474-1521`) ne sont consommées par aucun slot de la page (l.124-126) ;
les 7 entrées de `/formations/entreprise` (l.313-403) pour 2 slots rendus (l.127-129).
**Aggravation** : à `page.tsx:532-559`, quand `ofPublic` est vrai — l'état actuel — le
héros est **remplacé par le logo Qualiopi**, si bien que l'image marquée
`representativeOfPage: true` **n'est pas rendue du tout**. La page déclare 7 images, en
rend 2, et son image « représentative » est un faux.

### E2-P1 — « 5 pages éditoriales au sitemap mais sans graph ImageObject »
**VERDICT : CONFIRMÉ.** Les 5 `page.tsx` (`methodologie`, `centre-aide`, `comparaisons`,
`stack-ia`, `guide-ia`) n'importent ni `buildPageImageGraphJsonLd`, ni
`buildPrimaryImageOfPage`, ni `getPageImages` (grep : aucun fichier).

### E2-P1 — « Organization divergente sous le même `@id` (foundingDate 2024 vs 2026) »
**VERDICT : CONFIRMÉ live.** Sur la page galerie mesurée à 01:52 UTC, le HTML contient
**à la fois** `"foundingDate":"2024"` et `"foundingDate":"2026"`, et **tous** les nœuds
Organization de la page portent `"@id":"https://axion-ia.com/#organization"`. Le conflit
est donc bien sous un identifiant unique. Grep : exactement 2 occurrences de
`foundingDate` dans `src/`, et elles se contredisent
(`image-jsonld-graph.service.ts:88` vs `seo.ts:917`).

### E3-P1 — « Garanties de résultat incrustées dans des visuels publiés »
**VERDICT : CONFIRMÉ par inspection visuelle directe.**
- `public/villes-hero/grenoble.jpg` : cartouche bas **« 100% GAGNANT — moins de
  complexité, plus de performance »**. Vu.
- L'affiche métro : **« GAINS MESURABLES ASSURÉS »** en bas à gauche. Vu.
- ⚠️ **Correction de comptage** : `hero-images-map.ts` contient **59 slugs** (l.11 → l.69),
  pas 58. Le commentaire du code lui-même se trompe
  (`implantations/[region]/[ville]/page.tsx:524` : « 58 villes ») — l'audit a repris
  l'erreur du commentaire.
- **Deux défauts non relevés, visibles sur les mêmes visuels** : la faute
  « RECOMMANDATIONS **CONCRÉTÉS** » sur l'affiche, et le fait que les deux visuels
  affichent la marque sous la forme **« Axion-IA.com »** — la même graphie que celle qui
  pose problème sur LinkedIn (F5-P1) alors que la raison sociale est « AXION IA ».

### E3-P1 — « Héros Unsplash hors-sujet + alt ANGLAIS sur les articles content-gen »
**VERDICT : CONFIRMÉ (volet alt, sans échappatoire).**
`unsplash.ts:354` = `chosen.alt_description || chosen.description || query` ;
`select-hero-image.ts:120` = `selected.alt || query` ;
`inject-body-images.ts:122` = `photo.alt || "Illustration"`. Grep exhaustif de
`src/server/content-gen/` : **aucune normalisation, aucune traduction FR de l'alt nulle
part**. `alt_description` vient d'Unsplash et est toujours en anglais. Contradiction
frontale avec la décision actée n°1 (site français uniquement) — ce qui, ici, **renforce**
le finding au lieu de le réfuter. Le volet « hors-sujet » repose sur un article témoin que
je n'ai pas ré-inspecté visuellement ; il ne porte pas le patch (qui est l'inversion de
priorité de l'alt).

### E3-P1 — « Sitemaps images villes : l'image déclarée n'est pas celle rendue »
**VERDICT : CONFIRMÉ live.** `sitemap-images-villes-t1.xml` (01:55 UTC) : les 6 premiers
`<image:loc>` déclarent **tous** la même bannière générique
`/images/axion-ia-formation-acculturation-ia-tpe-pme-eti-2026-photo-banniere.webp`,
alors que `/fr/implantations/auvergne-rhone-alpes/grenoble` rend `villes-hero/grenoble`.
Le code le reconnaît lui-même (`sitemap-images-villes-t1.xml/route.ts:8-9` :
« Optimisation future : mapper les ~10 villes à bannière dédiée »).

### E4-P1 — « Zéro instrument ne mesure la recherche d'images (`type: "image"` absent) »
**VERDICT : CONFIRMÉ.** `export-gsc-crawl-stats.mjs:105-111` : corps de requête
`{ startDate, endDate, dimensions:["page"], rowLimit:1000, dataState:"all" }`, **aucun
champ `type`** → défaut `web`. Grep `searchType|type: "image"` : les 5 seuls hits sont des
blocs vision Anthropic, sans rapport avec la Search Console.

### E4-P1 — « Les 129 `<image:loc>` du sitemap blog pointent tous vers `images.unsplash.com` »
**VERDICT : CONFIRMÉ live.** `sitemap-images-blog.xml` (01:55 UTC) : **129 occurrences de
`<image:loc>https://images.unsplash.com`, 0 sur `axion-ia.com`**. `absoluteImage()`
(`route.ts:59-62`) recopie bien les URL externes telles quelles ; `next.config.ts:144-147`
autorise `images.unsplash.com` en `remotePatterns` (l.146), donc l'option 1 du patch
(passer par l'optimiseur) est techniquement praticable.

---

## Squad F — Présence & entité

### F1-P1 — « `/api/markdown/centre-aide/*` répond 404 »
**VERDICT : CONFIRMÉ live.** 01:47 UTC :
`/api/markdown/centre-aide/perimetre-audit-ia` → **404**. Contre-épreuve dans la même
rafale : `/api/markdown/faq/atelier-ia-equipe` → **200** — la branche FAQ corrigée le
2026-08-10 fonctionne bien, ce qui confirme que le patch prescrit (calquer FAQ) est le bon
patron.

### F1-P1 — « `/api/markdown/cas-concrets/*` répond 200 mais VIDE »
**VERDICT : CONFIRMÉ live, corps intégral relevé.** 01:48 UTC, réponse complète :
```
# Industriel · -32% temps administratif comptable

---
Source: https://axion-ia.com/fr/cas-concrets/industrie-comptabilite
Last modified: 2026-06-16T03:41:11.586Z
```
Titre + séparateur + pied de page. **Zéro ligne de contenu.** Diagnostic exact.

### F1-P1 — « Type `glossaire` annoncé mais jamais enregistré → 404 »
**VERDICT : CONFIRMÉ.** `/api/markdown/glossaire/agent` → **404** ;
`/fr/glossaire/agent` → **200** (mêmes secondes). Code :
`route.ts:48-55` — `ALLOWED_TYPES = {blog, actualites, guides, cas-concrets,
centre-aide, faq}`, `glossaire` absent, garde l.243-248.

### F1-P1 — « `guides.xml` et `glossaire.xml` déclarent 1 seule URL, enfants absents »
**VERDICT : ❌ RÉFUTÉ pour `guides` · ✅ CONFIRMÉ pour `glossaire`.**

C'est le faux positif de ce lot.

- **Fait live** : `sitemap/guides.xml` → 1 `<loc>` ; `sitemap/glossaire.xml` → 1 `<loc>`.
  Exact.
- 🔴 **Mais la conclusion « les fiches enfants ne sont déclarées dans aucun sitemap » est
  FAUSSE pour les guides.** `sitemap-blog.xml` (téléchargé 02:05 UTC) contient bien des
  `https://axion-ia.com/fr/guides/<slug>` — relevés :
  `guide-audit-ia-grenoble`, `guide-agence-web-ia-auvergne-rhone-alpes`,
  `guide-integration-ia-grenoble`.
- 🔴 **Et c'est une décision d'architecture documentée**, pas un oubli :
  `src/app/sitemap.ts:131-133` — « Sprint S+3 P0-7 (audit 18-TYPE-7) — hub `/guides` dans
  son propre sub-sitemap. **Les guides individuels restent émis via sub-sitemap `blog`**
  (continuité Articles). Le sub-sitemap `guides` ne contient que le hub lui-même. »
  Complété par l.53-56 : `buildBlogSitemap` route explicitement les slugs `guide-…` vers
  `/guides/[slug]`, leur URL canonique.
- **Le volet `glossaire`, lui, est un vrai bug** : `sitemap.ts:135-137` annonce
  « sub-sitemap dédié glossaire (**hub /glossaire + 60 termes** `/glossaire/[slug]`) »
  et l.196-199 retire même `/glossaire` de `pages.xml` au motif qu'il est « canonique »
  dans `glossaire.xml`. Le live n'en sert qu'**une** : l'intention documentée n'est pas
  tenue, et les ~60 fiches ne sont dans aucun sitemap.
- **Conséquence sur le patch** : ne PAS toucher au builder `guides` (on créerait des
  doublons avec `sitemap-blog.xml`). Le patch se réduit au builder `glossaire`, et son
  effort passe de M à S. Le risque « volume d'URLs ajouté d'un coup » tombe aussi (~60 au
  lieu de plusieurs centaines).

### F2-P0 — « Le drainage de visibilité continue sans inflexion »
**VERDICT : CONFIRMÉ — et renforcé par l'échec de ma contre-hypothèse.**

Arithmétique refaite à la main sur les CSV (01:58 UTC) :

| Semaine | pages | impressions | clics | CTR | position pondérée |
|---|---:|---:|---:|---:|---:|
| W31 | 196 | 805 | 19 | 2,360 % | 22,15 |
| W32 | 249 | 1 292 | 14 | 1,084 % | 25,26 |
| W33 | 268 | 1 515 | 13 | 0,858 % | 25,46 |

Reproduction **exacte** des chiffres de F2 (22,2 / 25,5 / 2,36 % / 0,86 %).

**Contre-hypothèse testée puis abandonnée.** J'ai cherché à réfuter en supposant un effet
de composition : 185 pages neuves ranquant bas suffiraient à dégrader la moyenne pondérée
sans qu'aucune page existante ne recule, et 19 → 13 clics reste dans le bruit de Poisson
(≈ 1,1 σ). Test décisif — **cohorte des 83 pages présentes en W31 ET en W33** :

| Cohorte stable (83 pages) | impressions | clics | position pondérée |
|---|---:|---:|---:|
| W31 | 436 | 15 | **23,19** |
| W33 | 666 | 8 | **30,17** |

La dégradation est **plus forte** sur les mêmes pages que sur l'ensemble. L'effet de
composition n'explique rien ; il **masquait** en réalité l'ampleur du recul.
Réserve honnête à conserver : sur 15 → 8 clics, le signal de clics reste faible ;
c'est la **position sur cohorte fixe** qui porte la preuve.

### F2-P1 — « Chaîne de soumission GSC morte (token `readonly`) »
**VERDICT : CONFIRMÉ.** `gh run list --workflow gsc-submit-main-sitemap.yml` (02:00 UTC) :
les **6 derniers runs `schedule`, du 2026-07-06 au 2026-08-10, sont tous `failure`**.
Aucun succès sur la période. Réserve mineure : le motif HTTP 403 « insufficient
authentication scopes » vient du log lu par F2, que je n'ai pas rouvert — la panne, elle,
est reproduite.

### F2-P1 — « Bing : observabilité zéro »
**VERDICT : CONFIRMÉ.** Grep `bingWmt|bing-wmt-client` sur `src/` : les 3 fonctions
(`bingWmtGetCrawlStats:58`, `bingWmtGetUrlInfo:98`, `bingWmtGetQuota:134`) n'apparaissent
que **dans leur propre fichier**. Zéro consommateur.

### F2-P1 — « Monitoring d'indexation inexistant (HCU-monitor stub + URL Inspection morte) »
**VERDICT : CONFIRMÉ.** `gscInspectUrl` : **un seul hit dans tout `src/` et `scripts/`**,
sa définition (`gsc-client.ts:326`). Le volet « état du flag `GSC_HCU_MONITOR_ENABLED` en
prod » reste non vérifié (nécessite SSH) — il ne change pas le verdict, le corps du worker
étant un stub par construction.

### F3-P0 — « Top 10 sur 119 pages, mais sur des requêtes sans demande »
**VERDICT : CONFIRMÉ, avec re-tirage indépendant de la preuve la plus fragile.**
Google Suggest re-interrogé à **02:02 UTC**, ~7 h après la mesure de F3 :
`audit ia grenoble` → `["audit ia grenoble",[]]` — **liste vide**, reproduite à
l'identique. La famille `implantations` recalculée sur le CSV W33 : **117 pages,
481 impressions, 1 clic** — chiffres identiques à ceux de F3.

### F3-P0 — « `/fr/audit` quasi absente de la SERP (1 impression/semaine) »
**VERDICT : CONFIRMÉ, ligne CSV à l'appui.**
`crawl-stats-2026-W33.csv:19` : `"https://axion-ia.com/fr/audit",1,0,0.0000,17.00`.
Une impression, zéro clic, position 17. Les lignes 20-26 montrent en outre que les
**7 déclinaisons `/fr/audit/par-ville/*` cumulent 29 impressions** — soit 29× le hub —
ce qui documente la dilution mieux encore que le rapport ne le fait.

### F3-P1 — « Fenêtre d'une heure post-deploy : home sans bloc avis »
**VERDICT : CONFIRMÉ — portée strictement bornée à la fenêtre, mécanisme à corriger.**

- **Contre-mesure hors fenêtre (01:46 UTC, T+5 h 56)** : `GET /fr` →
  `cf-cache-status: HIT`, `Age: 62`, `x-nextjs-cache: HIT`, `x-nextjs-prerender: 1`,
  et le HTML contient **`aggregateRating`, `"ratingValue":4.9`, `"reviewCount":77`**.
  Le défaut est donc **transitoire**, pas permanent — à distinguer explicitement du volet
  `vatID`/SIRET de B1-P0 que H1 a établi comme **permanent et site-wide**. Ces deux
  familles ne doivent pas être fusionnées dans le plan de patches.
- **Note technique** : `x-nextjs-prerender: 1` est présent **avec** l'`aggregateRating`.
  Cet en-tête ne peut donc pas servir de détecteur de « version stub » ; seul le contenu
  fait foi.
- **Code confirmé** : `deploy-coolify.yml:747` (`PATHS`) et `:778` (`FILES`) contiennent
  exactement les 5 mêmes chemins et **pas `/fr`**. En revanche `/fr` **est** le premier
  élément de `STRATEGIC` (l.808, 15 chemins) — la formulation du finding est donc exacte.
- 🔴 **Mécanisme partiellement réfuté — voir F5-P0-b ci-dessous** : « c'est le warmer qui
  fige la version périmée » n'est pas établi (cache Cloudflare par PoP).

### F3-P1 — « Titres SERP : double marque sur les fiches FAQ »
**VERDICT : CONFIRMÉ live.** 01:57 UTC, `/fr/faq/atelier-ia-equipe` :
`<title>Qu'est-ce qu'un atelier IA pour une équipe ? · FAQ Axion-IA · Axion-IA</title>`
— 80 caractères, marque deux fois. Le mécanisme décrit (`seo.ts:271-279` ne neutralise le
template racine que sur le suffixe exact `" · Axion-IA"`) explique exactement l'observé.
Les volets **quantitatifs** — « ~30 fiches concernées » et « Guide complet 2025 » sur les
134 URLs blog — restent au statut `[À CONFIRMER]` que F3 leur donnait ; je ne les ai pas
comptés.

### F3-P1 — « Google ne reconnaît pas la marque et corrige "axion-ia" en "action ia" »
**VERDICT : CONFIRMÉ — reproduction octet pour octet sur un second tirage.**
Google Suggest, **02:02 UTC** (F3 avait mesuré à 19:20 UTC la veille) :
```json
["axion-ia",["axion-ia","action ia","axion iasi",
"international axion observatory iaxo","action gino iannucci",
"iaxo axion","axion 1 ianuarie"],[]…]
```
Liste **identique**, dans le **même ordre**. La 2ᵉ suggestion est bien la correction
orthographique « action ia », et aucune expansion de marque n'existe. C'est la mesure
« fragile » qui s'est révélée la plus stable de tout l'audit.

### F4-P0 — « Requête brand : le moteur de réponse parle d'Axion-IA sans citer axion-ia.com »
**VERDICT : CONFIRMÉ — re-tiré indépendamment, conclusion identique, mix de sources différent.**
Requête « Qui est Axion-IA ? » rejouée à **02:05 UTC** : **9 liens, 0 sur axion-ia.com.**
Sources retournées : jaimelesstartups (#1), actuia/**Axionable** (homonyme), Crunchbase,
Wikipédia « Axion (disambiguation) », wispra, f6s, Google Play « Axion: AI Voice Planner »,
Wikipédia « AX », axionai.us. Le mix diffère de celui de F4 (Crunchbase était #1) — c'est
précisément ce qui rend la reproduction probante : **le classement bouge, le verdict non.**
La réponse générée reste correcte sur le fond (« créé en 2026 ») et ne mentionne **ni
Grenoble ni Qualiopi** — ce qui corrobore au passage F4-P2.
⚠️ **Réserve de portée à conserver dans la synthèse** : ceci mesure **un** moteur de
réponse (le même que F4). Ce n'est pas une preuve sur Perplexity, ChatGPT Search ou
Gemini, que ni F4 ni moi n'avons pu interroger.

### F4-P1 — « Requêtes commerciales : 0 citation, captation par des listicles tiers »
**VERDICT : CONFIRMÉ — reproduit.** « meilleur organisme formation IA pour PME à
Grenoble », **02:06 UTC** : 7 sources — Arkavia, **Almera ×2**, Proxiformation,
formateur-ia-grenoble, Mister IA, Algomind. **Axion-IA : 0 mention, 0 citation.**
Recouvrement élevé avec la mesure de F4 (Arkavia, Almera, Proxiformation, Mister IA), avec
un entrant (Algomind) et deux sortants (IAvenir, DataScientest) — variabilité normale, la
conclusion tient sur les deux tirages. La réponse insiste sur « tous ces organismes
proposent des formations **certifiées Qualiopi** » : le différenciateur revendiqué par
Axion-IA est précisément le critère de tri du moteur, ce qui relie ce finding à F5-P0-a.

### F4-P1 — « llms.txt ne dit ni le siège ni le SIREN »
**VERDICT : CONFIRMÉ.** `llms.txt` téléchargé 01:49 UTC : `SIREN` = 0, `108018631` = 0,
`AXION IA SAS` = 0, `Grenoble` (capitalisé) = **0** — la seule occurrence est le
`grenoble` minuscule d'une URL de page commerciale. La ligne 20 porte bien le claim
maximal (« organisme de formation certifié Qualiopi … finançables (OPCO, France Travail) »)
et renvoie aux mentions légales, sans aucun identifiant.

### F4-P1 — « Intent "avis" : l'homonyme Axion Formations capte la réputation »
**VERDICT : CONFIRMÉ — reproduit.** « Axion-IA avis clients formation », **02:08 UTC** :
Indeed « **Axion Formation** » (#1), Indeed « **Axion Formations - Saint-Quentin (02)** »
(#3), topformation « **Axio Formation** » (#4). Les pages axion-ia.com présentes sont
exactement du type décrit par F4 — blog Maurepas, implantations Carcassonne / Perpignan /
Auxerre, FAQ général, home — et **aucune page `/fr/avis/**`**. Le mécanisme de captation
par homonyme est reproduit tel quel.

### F5-P0 — « Le statut Qualiopi n'est corroboré par aucun registre public »
**VERDICT : CONFIRMÉ — vérification indépendante au registre.**
`recherche-entreprises.api.gouv.fr/search?q=108018631`, **02:03 UTC** :
`"nom_complet":"AXION IA (AXION IA)"`, `"libelle_commune":"GRENOBLE"`,
`"code_postal":"38100"`, `"date_creation":"2026-09-01"`,
**`est_organisme_formation": false`**, **`est_qualiopi": false`**,
**`liste_id_organisme_formation": null`**.
Le verrou est bien fermé. La qualification « STOP & ASK Will » est la bonne : le code ne
peut pas trancher entre « certificat obtenu mais non saisi » et « drapeau en avance de
phase ». Corroboration croisée avec F4-P1 ci-dessus : le moteur de réponse trie les
organismes de formation **sur le critère Qualiopi** — c'est donc le verrou qui pèse le
plus directement sur la citation commerciale.

### F5-P0 — « La page d'ancrage d'identité sert la version stub, et le sweep de chauffe la fige 1 h »
**VERDICT : CONFIRMÉ sur le fond · MÉCANISME PARTIELLEMENT RÉFUTÉ.**

- **Contre-mesure hors fenêtre (01:47 UTC)** : `/fr/mentions-legales` contient bien
  `108018631` (×5) et `FR51108018631` (×4), **zéro « communiqué sur demande »**. Le
  symptôme est donc **bien transitoire**, comme pour la home.
- **La correction que F5 apporte à B1 est exacte, et je la valide** : `/fr/mentions-legales`
  **est** dans le sitemap. `sitemap/pages.xml` téléchargé à 02:12 UTC contient
  6 occurrences `mentions-legales` / `conditions-generales`. Les deux pistes suggérées par
  le root-cause erroné de B1 (« ajouter la page au sitemap », « augmenter le cap ») sont
  bien sans effet. ✅
- **Code confirmé** : `deploy-coolify.yml:747` et `:778` ne contiennent ni
  `/fr/mentions-legales` ni `/fr/conditions-generales`. Le patch prescrit reste le bon.
- 🔴 **RÉFUTÉ — « le job `warm` fait précisément ce GET unique et grave la version stub
  chez Cloudflare ».** La preuve est **dans le tableau de F5 lui-même** : à **19:09:38**,
  `/fr/mentions-legales` répondait `cf-cache-status: **MISS**`. Or le job `warm` s'était
  terminé à **18:35:25** (chronologie F7) et F5 a répliqué le sweep en trouvant la page au
  rang 1 540 d'une liste de 1 641, très en-deçà du `cap=4000`. **Si le warmer avait mis la
  page en cache, F5 aurait mesuré un HIT avec un `Age` d'environ 2 000 s, pas un MISS.**
  C'est donc le **premier GET de F5** qui a peuplé le cache — puis le HIT stub de 19:23:29.
- **Explication la plus probable, à porter au plan** : le **cache Cloudflare est par
  datacenter**. Le job `warm` s'exécute depuis un runner GitHub (PoP américain ou
  européen du runner) ; F5, F3, F7 et moi tapons le PoP **MRS** (mes en-têtes :
  `CF-RAY: …-MRS`). Le warmer ne chauffe donc **pas** le PoP que voient les visiteurs
  français et Googlebot-EU. Ce constat se propage aux **trois** findings jumeaux
  (F3-P1, F5-P0-b, G3-P0) : ce qui fige la version périmée n'est pas le warmer ni le
  LHCI, c'est **le premier crawler ou visiteur de chaque PoP**.
- **Conséquence sur les patches** : ajouter `/fr` et `/fr/mentions-legales` aux listes
  `PATHS` + `FILES` reste **le bon patch et devient même le seul qui marche** (la purge CF
  ciblée est globale à la zone, elle n'est pas PoP-dépendante ; le `revalidatePath`
  agit sur l'origine). En revanche, **ne pas** prescrire « faire chauffer davantage
  d'URLs par le warmer » en croyant régler le problème d'edge : la chauffe depuis un
  runner ne couvre pas les PoP utiles.

### F5-P1 — « LinkedIn contredit le registre sur trois attributs »
**VERDICT : CONFIRMÉ — re-fetch indépendant.** `linkedin.com/company/axion-ia-france`,
**02:00 UTC**, 200 / 163 070 octets : nom **« Axion-IA.com »**, **« Paris »**,
**« Founded 2025 »**. Registre (02:03 UTC) : **GRENOBLE 38100**, création **2026-09-01**,
raison sociale **AXION IA**. Trois contradictions frontales confirmées. Le lien retour vers
axion-ia.com est bien présent. Le patch est hors code (reste Will) et le « do-not-touch »
sur l'URL du profil est justifié.

### F5-P1 — « `sameAs` à 3 entrées, zéro nœud registre ; Wikidata à zéro item »
**VERDICT : CONFIRMÉ.** Wikidata `wbsearchentities?search=Axion-IA` (**02:10 UTC**) :
`{"searchinfo":{"search":"Axion-IA"},"search":[],"success":1}` — **liste vide**. Le point
important de F5 est validé : la variable `WIKIDATA_QNUMBER_AXIONIA` n'est **pas** le
blocage, puisqu'il n'existe aucun item à référencer. `seo.ts:906-911` porte bien
exactement 3 URL (LinkedIn `axion-ia-france`, about.me, IndieHackers) et aucun spec ne
verrouille la longueur du tableau — l'ajout est libre.

### F5-P1 — « NAP sans "P" : aucun téléphone, aucun GBP »
**VERDICT : CONFIRMÉ.** Le nœud `#organization` servi sur la home (01:46 UTC) ne porte
aucune clé `telephone` ; `seo.ts:952` la conditionne à `env.COMPANY_PHONE`, déclarée
`optional()` dans `src/env.ts:255` et jamais renseignée. Aucun `g.page`/`maps.app.goo.gl`
dans `src/`.

### F5-P1 — « `llms.txt` affirme le maximum sans ancre vérifiable et désambiguïse le mauvais homonyme »
**VERDICT : CONFIRMÉ.** Mesure identique à F4-P1 ci-dessus. Le bloc l.4 vise bien
`axionai.fr` (« ⚠️ NE PAS CONFONDRE avec axionai.fr — site distinct, non affilié »), alors
que les deux collisions qui captent réellement sont **AXION FORMATIONS** (mesurée par F4
et re-mesurée par moi sur l'intent avis) et « **action ia** » (mesurée par F3 et
re-mesurée par moi en autocomplete).

### F6-P0 — « Le lien LinkedIn sitewide et deux `sameAs` pointent vers une société HOMONYME canadienne »
**VERDICT : CONFIRMÉ sur l'incohérence interne · INCERTAIN sur l'attribution ·
🔴 GRAVITÉ P0 NON ÉTABLIE → requalifier P1.**

- **Incohérence interne CONFIRMÉE par grep indépendant** : 3 occurrences `axion-ia`
  (`Footer.tsx:447` sitewide, `presse/page.tsx:230`, `image-jsonld-graph.service.ts:65`)
  contre 8 `axion-ia-france` (dont `seo.ts:908`, `job-posting.ts:21`,
  `ville-service-jsonld.ts:198`, `_layout.tsx:55` + son test, `memo-isere`,
  `implantations/[…]/[ville]`, `carrieres`).
- **CONFIRMÉE live** : le HTML de `/fr` (01:46 UTC) contient **les deux URL, 2 fois
  chacune**. Deux `sameAs` LinkedIn contradictoires dans le même document.
- **INCERTAIN — l'identité du titulaire de `/company/axion-ia`.** Réponse **200** au HEAD
  (02:00 UTC) mais corps vide côté public : la page existe et est derrière l'authwall.
  Conformément à l'addendum, je ne tente pas d'authentification et **je ne confirme pas**
  la qualification « Les Automatisation Axion IA Inc. / axionia.ca ».
- **Conséquence** : le correctif est le même dans les deux cas (constante unique dans
  `brand.ts` + 3 remplacements + test statique), mais la **gravité** dépend de la réponse
  de Will. Tant qu'elle est inconnue, le classer **P1** — un P0 non étayé fausserait le
  scoring de S1.

### F6-P0 — « Le boilerplate presse annonce "fondé en 2024" »
**VERDICT : CONFIRMÉ — fichier lu intégralement.** `GET /press/axion-ia-boilerplate-fr-en.txt`
(01:47 UTC), ligne 6 : « Axion-IA est un cabinet de conseil IA opérationnel **fondé en
2024**. » ; ligne 20 : « **founded in 2024** ». Aucune occurrence de « Grenoble », de
« SIREN », ni du nom du fondateur dans tout le fichier. Contradiction binaire avec
`seo.ts:917` (`foundingDate: "2026"`) et avec le registre (création 2026-09-01).
**Note utile pour le patch** : le fichier ne contient **aucune** mention Qualiopi — le
point 1 du patch prescrit propose d'en ajouter une ; à **subordonner explicitement** à la
résolution de F5-P0-a, sous peine de propager dans un asset « libre de droits » un claim
que les registres ne corroborent pas.

### F6-P1 — « `sameAs` du graphe images : `x.com/AxionIA` inexistant (404) sur 289 pages »
**VERDICT : CONFIRMÉ.** `curl -L -I https://x.com/AxionIA` (01:59 UTC) → **404**.
`image-jsonld-graph.service.ts:65` est bien la seule occurrence.

### F6-P1 — « Les 8 citations tierces réelles ne sont déclarées nulle part »
**VERDICT : CONFIRMÉ.** Grep : `LOCAL_CITATIONS_FR`, `buildLocalBusinessSameAsFR` et
`getLocalCitationsCoverage` n'ont **aucun consommateur applicatif** — seul
`local-citations.spec.ts` les importe, et son test **LC6 verrouille `listed = 0`**
(l.40-41), exactement comme décrit. Corroboration indépendante de l'existence des profils :
ma recherche brand de 02:05 UTC a fait remonter d'elle-même **jaimelesstartups,
Crunchbase, wispra et f6s** — quatre des huit citations inventoriées par F6.

### F6-P1 — « Les 2 fiches tierces les plus visibles ancrent l'entité à PARIS »
**VERDICT : CONFIRMÉ — re-fetch indépendant.** `lespepitestech.com/…/axion-ia`
(02:00 UTC) : **« 138 … Champs-Élysées … 75008 … PARIS »** présent, et le fondateur y est
nommé **« William Jullin »** — sans « s », conformément au finding (le SSOT dit
« Williams Jullin »). LinkedIn « Paris » confirmé ci-dessus. La boucle causale décrite
(les moteurs lisent Paris sur les fiches tierces) est cohérente avec mes propres tirages
F4, où ces mêmes fiches sont les sources retournées.

### F6-P1 — « Le "moteur de backlinks passif CC BY" est du code mort »
**VERDICT : CONFIRMÉ.** Grep `EmbedCodeButton` sur tout `src/` : **3 hits, tous dans
`EmbedCodeButton.tsx` lui-même** (commentaire l.4, interface l.15, export l.26).
**Zéro import.** Le commentaire du composant qui affirme être « importé depuis la page
Server `galerie/[slug]/page.tsx` » est faux.

### F7-P0 — « Redémarrage des conteneurs HORS pipeline → zéro remédiation »
**VERDICT : CONFIRMÉ sur le mécanisme · INCERTAIN sur l'événement du 18:49:06.**

- **Mécanisme CONFIRMÉ par le code** : toutes les remédiations vivent exclusivement dans
  `deploy-coolify.yml` (purge l.510-530 dans le job `deploy`, revalidate l.747, purge
  ciblée l.768-799, chauffe l.801-825, sweep l.827-866) ; **aucun `cacheHandler`** dans
  `next.config.ts` et **aucun volume monté sur `.next/cache`** dans le `Dockerfile` ni
  dans les 6 fichiers compose du dépôt — le `Dockerfile:180` note même que le cache mount
  `.next/cache` a été **retiré** au sprint recovery du 2026-05-16. Un redémarrage de
  conteneur repart donc bien d'une ISR froide, sans compensation.
- **Conséquence transitoire vérifiée** : `/fr/actualites` re-mesurée à **01:53 UTC**
  contient **32 liens d'articles** (contre 1 seul dans la mesure de F7 à 19:22:23). Le hub
  vide était donc bien un état de fenêtre, pas un état permanent.
- **INCERTAIN** : je n'ai pas d'accès SSH dans ce rôle ; je ne peux pas re-vérifier le
  `StartedAt` de 18:49:06 ni identifier le déclencheur (auto-deploy Coolify vs action
  manuelle). F7 marquait déjà ce point `[À CONFIRMER]` ; il le reste.
- **Alerte pour H4** : le volet 3 du patch (« fermer le chemin hors pipeline ») est
  correctement marqué STOP & ASK — le conserver ainsi, il touche la voie de secours de
  déploiement.

### F7-P0 — « Zéro observabilité du crawl réel — aucun access log HTTP nulle part »
**VERDICT : INCERTAIN (non re-vérifiable dans mon rôle) — fortement corroboré côté code.**
La chaîne de preuve de F7 repose sur des inspections SSH (Traefik, `/var/log`, drivers
Docker) que je ne peux pas rejouer. Ce que je peux corroborer indépendamment : aucun
middleware de log de requête dans `src/`, aucune table de hits, et **le fait décisif du
finding est vérifié par mes propres mesures** — le HTML est bien servi depuis l'edge
(`cf-cache-status: HIT` sur `/fr`, `EXPIRED`/`HIT` sur `sitemap-index.xml`), donc un
access log d'origine sous-compterait structurellement le crawl des pages chaudes. Le
caveat que F7 impose à toute lecture future de ces logs est juste, et **mon constat de
cache par PoP (cf. F5-P0-b) le renforce** : le comptage serait non seulement partiel, mais
partiel de façon variable selon le PoP.

### F7-P1 — « Sentry : une télémétrie de crawl gratuite que personne n'exploite »
**VERDICT : INCERTAIN — la prémisse est fragilisée, le patch reste valide.**
Vérifié : `sentry.server.config.ts:18` → `tracesSampleRate: NODE_ENV === "production" ?
0.02 : 1.0` ; `:37` → `sendDefaultPii: false` ; `SENSITIVE_HEADER_KEYS`
(`sentry-pii-scrub.ts:41-49`) = `authorization, cookie, set-cookie, x-csrf-token,
x-auth-token, x-api-key, proxy-authorization` — **`user-agent` en est effectivement
absent**.
🔴 **Mais l'inférence ne tient pas** : l'absence d'une clé de la liste de *scrub* ne prouve
pas la *présence* de la donnée. Avec `sendDefaultPii: false`, le SDK Sentry n'attache
normalement pas les en-têtes de requête aux transactions. F7 l'avait honnêtement marqué
`[À CONFIRMER]`. Je ne peux pas trancher sans l'UI Sentry → **INCERTAIN**, mais la
formulation du finding (« une source existe déjà, en ligne, financée ») est probablement
**fausse**. Conséquence pour S2 : présenter le patch comme la **création** d'un capteur
(tracesSampler bot-aware **+** attachement explicite de l'UA), pas comme le branchement
d'une donnée déjà collectée. L'effort passe de S à S-M et le gain n'est pas immédiat.

### F7-P1 — « Les CSV hebdo "crawl-stats" ne contiennent pas de crawl stats »
**VERDICT : CONFIRMÉ.** `head -1 _AUDIT/crawl-stats-2026-W33.csv` (01:59 UTC) →
`page,impressions,clicks,ctr,position`. Ce sont des données Search Analytics.
Le patch (renommer script + workflow + glob de commit dans le même commit, ne pas
supprimer l'historique) est correct — j'ajoute que **F2 et F3 s'appuient tous deux sur
ces CSV**, donc tout renommage doit être annoncé dans les deux rapports.

### F7-P1 — « `gscInspectUrl` est du code mort »
**VERDICT : CONFIRMÉ.** Un seul hit dans `src/` + `scripts/` : sa définition
(`gsc-client.ts:326`).

---

## Squad G — Performance & rendu

### G1-P0 — « Les deux gates de budget annoncés bloquants ne bloquent rien »
**VERDICT : CONFIRMÉ.** `ci.yml` : `continue-on-error: true` confirmé sur les trois steps
(Bundle size l.278, Bundle delta l.288, Lighthouse CI l.308), chacun avec un commentaire
assumant la mise en reporting (« NON-BLOQUANT (2026-05-29) », « NON-BLOQUANT (2026-07-01) »).
Les deux buckets `**/reserver/**` existent bien (`package.json:238-243` et `:244-249`)
alors que `next.config.ts:285-289` redirige `/fr/reserver` → `/fr/appel` en 301 permanent
depuis le 2026-06-26.
⚠️ **Corrections à porter** : la plage réelle du bloc `size-limit` est **l.225-283**
(7 buckets), pas l.223-258. Et surtout — **l'exception d'`AGENTS.md` porte sur `/appel`,
pas sur `/reserver`** (`AGENTS.md:19` du dépôt). C'est le fichier `AGENTS.md` **global**
de `C:\Users\willi` qui est périmé sur ce point, pas celui du dépôt. Le patch 2 (créer un
bucket `/appel`) est donc encore plus justifié : `/appel` retombe aujourd'hui dans
« Pages standard » à 75 KB alors que la doctrine lui promet 110 KB.
**Un point non vérifiable ici** : le caractère « required » du job `gate-b` relève de la
protection de branche GitHub, hors dépôt. Sans effet sur le verdict (les steps sont
non bloquants quoi qu'il arrive).

### G1-P0 — « First Load JS ≈ 240 KB gz sur 100 % des routes »
**VERDICT : CONFIRMÉ (dépassement) — chiffre re-mesuré partiellement, écart mineur.**
Mesure directe des chunks servis par le build `f51d544b` (02:12 UTC, `Accept-Encoding: gzip`) :

| chunk | gz mesuré |
|---|---:|
| `18966-8be3fe38add1b188.js` | **72 292 o** |
| `e5f456b7-e637271fd2966e03.js` (React) | **65 598 o** |
| `polyfills-42372ed130431b0a.js` (`noModule`) | 41 106 o |
| `37177-…js` | 15 584 o |
| `48974-…js` | 13 410 o |

Les **5 plus gros chunks à eux seuls** pèsent **167 KB gz hors polyfills**, soit déjà
**×2,2 le budget de 75 KB**, et la home en charge **16 au total**. Le dépassement est donc
confirmé au-delà de tout doute. Écart mineur avec G1 (qui mesurait 68,0 KB pour `18966`) :
build différent. Le levier identifié par G1 — `18966` est le plus gros chunk et n'a jamais
été analysé — est confirmé : il pèse **plus** que le runtime React lui-même.

### G1-P1 — « 11+ URLs publiques stratégiques rendues dynamiquement (`no-store`, BYPASS) »
**VERDICT : CONFIRMÉ — reproduit intégralement hors fenêtre de déploiement.**
HEAD à **01:50 UTC** sur 6 des URLs citées, résultat **identique sur les 6** :
`Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` +
`cf-cache-status: BYPASS` + les 3 `Set-Cookie` (`NEXT_LOCALE`,
`__Host-authjs.csrf-token`, `__Secure-authjs.callback-url`), aucun `x-nextjs-cache` :
`/fr/avis`, `/fr/galerie`, `/fr/presse`, `/fr/carrieres`, `/fr/observatoire-ia`,
`/fr/blog/page/2`. À comparer à `/fr` au même moment : `s-maxage=3600`,
`x-nextjs-cache: HIT`, `cf-cache-status: HIT`, **aucun `Set-Cookie`**.
Le code est confirmé page par page (`avis:66/180`, `galerie:227/125`,
`observatoire-ia:57/98`, `roi:89/119`, `simulateur:30/56`, `appel:30/78`, `presse:75/88`,
`carrieres:41/83`), et `blog/page.tsx:9-15` porte bien le commentaire du correctif
2026-07-31 jamais propagé. `avis/ville/[ville]` et `blog/page/[num]` n'ont bien **aucun**
`generateStaticParams`.
⚠️ **Deux corrections** : `/fr/galerie` a `revalidate = 60` (pas 3600) et `/fr/appel`
`revalidate = 900`. Et **`/fr/recherche` doit sortir de la liste** : cette page n'a
**aucun** `export const revalidate` — il n'y a donc pas de « `revalidate` mort » — et elle
est `robots: index:false` (l.35), donc son impact SEO est nul. Retirer cette entrée évite
un patch inutile.

### G1-P1 — « Le seul gate bloquant : 5 URLs, desktop seul, sans assertion INP »
**VERDICT : CONFIRMÉ.** `deploy-coolify.yml:600-606` (5 URLs), `:607`
(`--settings.preset=desktop`) ; `lighthouserc.postdeploy.json` : `assertMatrix` = 2 blocs
de 6 assertions (`categories:performance`, LCP, CLS, TBT, FCP, Speed Index) —
**`interaction-to-next-paint` absent des deux branches** ; `lighthouserc.json:32` : INP en
`warn` à 80 ms, jamais en `error`. Aucune configuration du dépôt n'assertit l'INP en
erreur. Le parallélisme `lhci` ⇄ `warm` est confirmé (voir G3-P0).

### G1-P1 — « Les deux pages les plus lourdes ne sont dans aucune gate »
**VERDICT : CONFIRMÉ.** `lighthouserc.json:4-17` = 12 URLs, contenant bien **3 pages
villes** `/fr/implantations/<region>/<ville>` mais **ni le hub `/fr/implantations`
ni `/fr/faq`** — la formulation de G1 était précise sur ce point. `dom-size-insight: off`
et `dom-size: off` confirmés (l.41-42). Corroboration indirecte du poids : le document
`/fr` que j'ai téléchargé fait **1 750 744 octets** décodés, à 0,3 % de la mesure de G2
(1 745 912) et cohérent avec G1 — les mesures de volume des deux agents se recoupent.
**À conserver impérativement** : le point 2 (paginer `/fr/implantations`) est marqué
STOP & ASK Will et arbitrage avec C4/D4 — c'est justifié, la découvrabilité de ~4 300
pages en dépend.

### G1-P1 — « ~90 % du poids de chaque document est de la charge non-contenu »
**VERDICT : CONFIRMÉ.** Taille de `/fr` reproduite à 0,3 % près (1 750 744 o).
`inlineCss: true` confirmé (`next.config.ts:215`). Le patch est correctement gardé
(mesurer avant d'arbitrer, STOP & ASK + ADR pour la bascule `inlineCss`) — le conserver
tel quel.

### G2-P1 — « 920 Ko de CSS dupliqués 4 fois — 76 à 81 % du document »
**VERDICT : CONFIRMÉ.** Trois corroborations indépendantes :
(1) taille de `/fr` reproduite (1 750 744 o) ; (2) `4 × 228 829 ≈ 915 Ko`, soit **52,3 %**
de ce document — l'exact chiffre annoncé par G2 pour `/fr` (52,7 %) ; (3) le chunk CSS est
bien unique et volumineux : `/_next/static/css/366c33068f15aaf4.css` = **35 100 o gzippés**
(≈ 223 Ko décodés). Les 3 imports de `globals.css` (layout l.26, `not-found.tsx:10`,
`global-error.tsx:8`, plus `maintenance/layout.tsx:14`) sont confirmés — la piste de la
triple copie RSC tient. J'ai par ailleurs **confirmé la fuite admin** dans la feuille
publique : `color-admin` est présent **à la fois** dans le `<style>` du `<head>` et dans
le flux RSC du HTML servi, et `@source` n'apparaît **nulle part** dans `src/`
(`globals.css:1` = `@import "tailwindcss";` seul). L'ordre du patch (commencer par 1 et 2,
ne pas commencer par la bascule `inlineCss`) est le bon.

### G2-P1 — « Le JSON-LD des familles pSEO est absent du HTML servi »
**VERDICT : CONFIRMÉ par renvoi.** G2 déclare explicitement qu'il s'agit d'une
**corroboration** de B2/B4/D4 et non d'un finding neuf. Il ne doit donc **pas** être
compté une seconde fois dans le scoring de S1 ni dans le plan de S2 — sa valeur est la
mesure famille par famille, pas le constat.

### G3-P0 — « Le job `lhci` refige la home stub à l'edge (course `lhci` ⇄ `warm`) »
**VERDICT : CONFIRMÉ sur la course · mécanisme d'épinglage à nuancer (cf. F5-P0-b).**

- **Course CONFIRMÉE par lecture exhaustive des `needs`** :
  `deploy` → `needs: build` ; **`lhci` → `needs: deploy`** (l.556) ;
  **`warm` → `needs: deploy`** (l.716) ; `indexnow` → `needs: deploy` (l.650) ;
  `notify` → `needs: [build, deploy]`. **Trois jobs démarrent simultanément après
  `deploy`, sans aucune sérialisation.** C'est exactement le constat de G3, et il
  **valide l'apport de H1** : le patch « 2 lignes YAML » d'A3/F3 ne ferme pas la course.
- **Le patch de G3 est le bon et il est meilleur que l'alternative** : déplacer les deux
  steps revalidate + purge ciblée **à la fin du job `deploy`** les place avant le
  démarrage de `lhci` **et** de `warm` **et** d'`indexnow`, pour ~5 s de section critique.
  L'alternative `lhci: needs: [deploy, warm]` (proposée par G1-P1) allonge le pipeline de
  ~8 min. **Les deux findings prescrivent le même correctif sous deux formes — S2 doit
  n'en retenir qu'une, et la variante G3 est préférable.**
- 🔴 **À nuancer** : « `lhci` remplit le cache edge avec le prerender stub » suppose que la
  requête Lighthouse peuple le PoP que verront ensuite les crawlers. Le cache Cloudflare
  étant **par datacenter** (cf. F5-P0-b), la passe LHCI ne pollue que son propre PoP. Le
  patch reste néanmoins pleinement justifié : ce qu'il corrige vraiment, c'est que
  **l'origine** serve encore la version stub au moment où n'importe qui la demande.

### G3-P1 — « Les ~480 hubs villes ne régénèrent JAMAIS »
**VERDICT : CONFIRMÉ sur le mécanisme · INCERTAIN sur l'amplitude.**
- **Live 01:53 UTC**, `/fr/implantations/auvergne-rhone-alpes/grenoble` : **une seule
  occurrence de `href="/fr/blog/…"`, et c'est `/fr/blog/categorie`** (lien de pied de
  page). Zéro article ancré. La page rend bien `villes-hero/grenoble`.
- **Mécanisme prouvé** : `revalidate = 86400` (l.99) + aucun `cacheHandler` + aucun volume
  sur `.next/cache` (le `Dockerfile:180` documente son retrait) → l'horloge ISR repart à
  zéro à chaque déploiement, et avec la cadence observée (4 runs le 2026-08-14) aucune
  entrée ville n'atteint jamais 24 h. Un GET du warmer ne régénère pas une entrée encore
  « fraîche ». **Ma propre mesure tombe à T+6 h d'un déploiement : la page ne pouvait
  structurellement pas avoir régénéré**, ce qui rend l'observation cohérente sans la
  démontrer.
- **INCERTAIN** : le `[À CONFIRMER]` de G3 sur `Article.mentionedCities` reste ouvert (pas
  d'accès DB dans mon rôle). Si le champ était vide pour tout le corpus, le bloc serait
  vide même après régénération : le mécanisme d'ISR gelée resterait vrai, seule l'ampleur
  du gain attendu changerait. **À trancher avant de chiffrer le bénéfice du patch (a).**

### G3-P1 — « Cloudflare réécrit `max-age` 300 → 3600 et ignore `s-maxage=600` »
**VERDICT : CONFIRMÉ — reproduit, et sur un cas plus probant que celui de G3.**
`sitemap-index.xml`, **01:50 UTC** :
`Cache-Control: public, max-age=3600, s-maxage=600, stale-while-revalidate=3600` avec
`cf-cache-status: **EXPIRED**`. Le point fort : la réponse **ne vient pas du cache** (elle
a été revalidée à l'origine) et porte **quand même** `max-age=3600` alors que
`sitemap-index.xml/route.ts:354` et `next.config.ts:703-720` émettent tous deux
`max-age=300`. Seul `max-age` est modifié, les deux autres directives sont intactes :
signature nette d'un réglage « Browser Cache TTL » côté Cloudflare, pas d'un bug
applicatif. Le « do-not-touch » (ne pas remonter `max-age` à 3600 dans le code pour coller
au live) est le bon réflexe.

### G3-P1 — « Aucune mutation de contenu ne purge l'edge »
**VERDICT : CONFIRMÉ.** `api/internal/revalidate/route.ts:69-92` n'appelle que
`revalidatePath` (l.72) et `revalidateTag` (l.86). Grep `purge_cache` sur tout `src/` :
**une seule occurrence**, `observatoire-snapshot-worker.ts:36` — le contre-exemple cité
par G3, qui prouve que le motif est connu et maîtrisé ailleurs. Le garde-fou du patch
(borner à 30 URLs/publication, quota CF Free 1 000/jour, helper best-effort) est pertinent.

### G4-P0 — « Le logo Qualiopi est un PNG de 1,27 Mo servi brut sur 100 % des pages »
**VERDICT : CONFIRMÉ — pesée live.** `GET /qualiopi/axion-ia-qualiopi.png` (01:47 UTC) :
**1 304 554 octets**, `content-type: image/png`, `Cache-Control: public, max-age=14400`.
Chiffre identique à celui de G4. `QualiopiBadge.tsx:95-105` et `:126-139` confirmés
(`<img>` brut 210×140 et 180×120), avec un `eslint-disable` motivé par la règle d'usage de
la marque ; la source vient bien de la console admin (`identity.logoPath`), pas d'un
chemin en dur — le « do-not-touch » sur `registry.ts` est donc justifié.
**Observation neuve, à signaler à Will hors périmètre GEO** : le fichier embarque un
manifeste **C2PA** déclarant `softwareAgent: GPT-4o`, `c2pa.actions.v2 / trainedAlgorithmicMedia`
et `dc:title: image.png`. Un logo de certification officielle portant une signature
« média généré par IA » est un point de conformité de marque à examiner — et il pèse dans
l'octet. Le STOP & ASK Will du patch prend ici tout son sens.

### G4-P0 — « L'avatar auteur est un PNG de 1,44 Mo affiché en 64 × 64 »
**VERDICT : CONFIRMÉ — pesée live.** `GET /auteurs/manon.png` (02:00 UTC) :
**1 513 427 octets**. `AuthorByline.tsx:62-70` confirmé, et sa justification en commentaire
(l.55-60 : « `next.config.ts` `images.remotePatterns: []` n'autorise pas l'optimizer »)
est bien **périmée** : `next.config.ts:144-147` déclare `images.unsplash.com`.
⚠️ **Correction de la preuve code** : `manon-person.ts:29` est une ligne de JSDoc.
L'avatar n'est pas un littéral dans ce fichier — il vient de `author.photoUrl256`
(l.48), **lu en base** ; le littéral `/auteurs/manon.png` n'existe que dans le seed
(`prisma/seeds/content-gen/author-profile.ts`). La valeur servie en prod **est** bien un
chemin local (vérifié dans le HTML), mais rien ne le garantit au niveau du type. **Cela
ne casse pas le patch** — la condition proposée (`authorAvatarUrl.startsWith("/")`) gère
précisément ce cas et devient même **la** bonne formulation.

### G4-P1 — « Aucune gate ne mesure le mobile »
**VERDICT : CONFIRMÉ.** `playwright.config.ts:20-26` déclare bien `mobile-chrome`
(Pixel 7, l.24) et `mobile-safari` (iPhone 14 Pro, l.25) ; les deux seules invocations
Playwright de la CI sont `nightly.yml:94` et `ci.yml:293`, **toutes deux
`--project=chromium`**. Le gate post-deploy est desktop-only (`deploy-coolify.yml:607`).
Aucun projet mobile n'est exécuté nulle part. La prudence du patch (WARN d'abord, sinon
blocage immédiat des déploiements) est justifiée et doit être conservée par H4.

### G4-P1 — « `aria-label` plus court que le texte visible (WCAG 2.5.3) »
**VERDICT : CONFIRMÉ.** `ServicesGrid.tsx:205` = `aria-label={cardAriaLabel?.(ctx) ?? ariaName}`
avec `ariaName` calculé l.197. Le finding est doublement étayé — code **et** audit
Lighthouse nocturne (`label-content-name-mismatch` score 0 sur `/fr` et sur la page ville,
3 runs) — et l'explication de l'angle mort d'axe (règle expérimentale donc
`enabled: false`, non réactivée par un filtrage par tags) est techniquement exacte.
C'est un des findings les mieux construits du lot : il explique **pourquoi** la garde
existante ne rougit pas.

### G4-P1 — « Deux `<main>` sur ~291 pages publiques »
**VERDICT : CONFIRMÉ — et sous-évalué.** Les 4 emplacements cités sont exacts
(`layout.tsx:305`, `appel:135`, `galerie:183`, `galerie/[slug]:243`). La vérification en
trouve **trois de plus**, tous descendants du même layout : `espace-ressources/layout.tsx:66`
et `(admin)/[adminPrefix]/layout.tsx:386` **et** `:398` — soit **7 `<main>` imbriqués** au
total, contre 4 annoncés. À l'inverse, le bon patron existe déjà dans le dépôt
(`connaissances/[slug]`, `blog/[slug]`, `guides/[slug]` portent un commentaire disant
qu'ils s'appuient sur le `<main id="main">` du layout) : le patch 2 (garde statique) est
donc à la fois faisable et déjà à moitié documenté.

### G4-P1 — « Outline de titres cassé (`h1 → h3`) »
**VERDICT : CONFIRMÉ.** `cas-concrets/page.tsx` : `<h1>` l.192 puis `<CardTitle>` l.284,
rendu en `<h3>` par `card.tsx:27-30`, sans aucun `h2` intermédiaire (les `<Section>`
l.268/279 ne passent qu'un `eyebrow`, rendu en `<p>`). Même chaîne sur
`comparaisons/page.tsx` (h1 l.103 → CardTitle l.207). `Footer.tsx:325` (`h3`) et `:331`
(`h4`) confirmés. Le patch est sans risque visuel (les tailles viennent des classes).

### G4-P1 — « La home mobile télécharge 62 Ko d'image hero jamais affichée »
**VERDICT : CONFIRMÉ — avec une correction de localisation qui change le patch.**
`page.tsx:425` = `<div className="hidden lg:block">` et `priority` en l.441 : confirmés.
⚠️ **Mais le `sizes` n'est pas écrit sur la page** : il vient du défaut du composant,
`src/components/visual/Illustration.tsx:54` (`"3:2": "(max-width: 1024px) 100vw, 600px"`),
appliqué l.97 via `sizes={sizes ?? defaultSizes[aspectRatio]}`.
**Conséquence directe sur le patch** : l'option 1 (« corriger `sizes` en `600px` »)
ne doit **pas** être appliquée dans `Illustration.tsx` — ce défaut sert tous les visuels
3:2 du site, y compris ceux réellement affichés en mobile. Le correctif doit **passer un
`sizes` explicite depuis la home**, en surcharge locale. Sans cette précision, le patch
« 1 ligne » dégraderait le responsive d'autres pages.

### G4-P1 — « `/fr/faq` : 13 174 nœuds DOM et 1 646 éléments interactifs hydratés »
**VERDICT : CONFIRMÉ.** `faq/page.tsx:99-107` : `explorerItems = faqs.map(...)` **sans
aucun `.slice()`** ; `:138/145` : `SCHEMA_MAX = 50` appliqué au seul JSON-LD, avec un
commentaire l.132-133 reconnaissant que « le corpus prod peut dépasser **1000 Q/R** » ;
`FaqHubExplorer.tsx:2` dimensionne explicitement le composant sur « **~88 FAQ** ».
L'asymétrie est nette : le cap a été posé là où on l'a cherché (le balisage) et pas là où
il coûte (le payload client). ⚠️ **Le garde-fou du patch est capital et doit survivre à
S2** : toute solution qui sort les Q/R du HTML initial est une **régression AEO nette** ;
la forme sûre (rendu serveur pur + index de recherche réduit côté client) doit être
reprise mot pour mot dans le plan.

---

## Contradictions inter-rapports relevées au passage (pour H6)

1. **E1 vs E2/E4 sur la valeur des balises de sitemap images.** E1-P0-a fonde la moitié de
   son impact sur les `<image:title>`/`<image:caption>`, qu'E2-P2 déclare **dépréciées par
   Google depuis 2022** et qu'E4-P2 montre porter sur des URL que l'index ne retient
   jamais. À arbitrer en faveur d'E2/E4 ; l'impact d'E1-P0-a se réduit à l'`alt` du DOM et
   au `<title>`.
2. **F3-P1, F5-P0-b et G3-P0 décrivent le même mécanisme sur trois URL différentes**
   (`/fr`, `/fr/mentions-legales`, `/fr` à nouveau) et prescrivent deux variantes du même
   patch YAML. **Un seul lot de patch**, variante G3 (déplacer revalidate + purge à la fin
   du job `deploy`), qui couvre les trois.
3. **G1-P1 et G3-P0 prescrivent deux ordonnancements incompatibles** pour le même
   problème : `lhci: needs: [deploy, warm]` (G1) vs déplacement des steps (G3). Retenir
   G3 — G1 reconnaît d'ailleurs que sa variante allonge le pipeline de ~8 min.
4. **E3-P1-a compte 58 héros villes, le code en déclare 59** — et le commentaire du code
   (`implantations/[…]/[ville]/page.tsx:524`) porte la même erreur, ce qui est
   vraisemblablement sa source.
5. **`AGENTS.md` du dépôt (`/appel`) diverge de `AGENTS.md` global de `C:\Users\willi`
   (`/reserver`)** — le global est périmé. Tout agent qui raisonne sur le fichier global
   travaille sur une exception de budget qui n'existe plus.

---

## Mesures brutes

| # | Heure UTC | Mesure | Résultat |
|---|---|---|---|
| 1 | 01:45 | `gh run list deploy-coolify.yml` | dernier succès `31830868520`, terminé **20:00:36 le 14/08** ; aucun run depuis |
| 2 | 01:46 | `GET /fr` | 200, `HIT`/`Age 62`, `x-nextjs-cache: HIT`, `x-nextjs-prerender: 1`, sha `f51d544b`, **`ratingValue 4.9` + `reviewCount 77` présents**, 1 750 744 o |
| 3 | 01:46 | `/fr` — occurrences LinkedIn | `company/axion-ia` ×2 **et** `company/axion-ia-france` ×2 |
| 4 | 01:47 | `GET /fr/cgu` · `/fr/conditions-generales` | **404** · 200 |
| 5 | 01:47 | `GET /fr/mentions-legales` | `108018631` ×5, `FR51108018631` ×4, 0 « communiqué sur demande » |
| 6 | 01:47 | `GET /press/axion-ia-boilerplate-fr-en.txt` | 200 — « **fondé en 2024** » / « **founded in 2024** », 0 Grenoble, 0 SIREN |
| 7 | 01:47 | `/qualiopi/axion-ia-qualiopi.png` | **1 304 554 o**, `max-age=14400`, manifeste **C2PA / GPT-4o** |
| 8 | 01:47 | `/api/markdown/centre-aide/perimetre-audit-ia` | **404** |
| 9 | 01:48 | `/api/markdown/cas-concrets/industrie-comptabilite` | **200, corps = titre + pied de page, 0 contenu** |
| 10 | 01:48 | `/api/markdown/glossaire/agent` · `/api/markdown/faq/atelier-ia-equipe` | **404** · **200** |
| 11 | 01:48 | `…-affiche-thumb.webp` | **404** |
| 12 | 01:49 | `GET /llms.txt` | 0 `SIREN`, 0 `108018631`, 0 `AXION IA SAS`, 0 `Grenoble` |
| 13 | 01:50 | HEAD ×6 (`avis`, `galerie`, `presse`, `carrieres`, `observatoire-ia`, `blog/page/2`) | **6/6** `private, no-store` + `BYPASS` + 3 `Set-Cookie` authjs |
| 14 | 01:50 | `HEAD /sitemap-index.xml` | `max-age=**3600**, s-maxage=600, swr=3600`, `cf-cache-status: EXPIRED` |
| 15 | 01:52 | `/fr/galerie/…-affiche` | `<title>Audit IA en Entreprise — **490 €** …</title>` ; `foundingDate 2024` **et** `2026` sous `@id #organization` ; `alt="Axion-IA — Audit Entreprise Metro …"` |
| 16 | 01:53 | `/fr/implantations/…/grenoble` | 1 seul `href="/fr/blog/…"` = `/fr/blog/categorie` ; `villes-hero/grenoble` présent |
| 17 | 01:53 | `/fr/actualites` | **32 liens d'articles** (vs 1 mesuré par F7 en fenêtre) |
| 18 | 01:54 | `sitemap/guides.xml` · `sitemap/glossaire.xml` | **1 `<loc>`** chacun |
| 19 | 01:55 | `sitemap-images-blog.xml` | **129 `<image:loc>`, 129 sur `images.unsplash.com`, 0 sur axion-ia.com** |
| 20 | 01:55 | `sitemap-images-villes-t1.xml` | 6/6 premiers `<image:loc>` = même bannière générique |
| 21 | 01:57 | `/fr/faq/atelier-ia-equipe` | `<title>… ? · FAQ Axion-IA · Axion-IA</title>` (80 car., marque ×2) |
| 22 | 01:58 | CSV GSC W31/W32/W33 (awk) | 805/19/22,15 → 1 292/14/25,26 → 1 515/13/25,46 |
| 23 | 01:58 | CSV, **cohorte 83 pages communes W31∩W33** | 436 imp / 15 clics / pos **23,19** → 666 / 8 / pos **30,17** |
| 24 | 01:59 | `crawl-stats-W33.csv:19` | `/fr/audit` = **1 imp, 0 clic, pos 17,00** ; famille implantations = 117 pages / 481 imp / 1 clic |
| 25 | 01:59 | en-tête CSV | `page,impressions,clicks,ctr,position` |
| 26 | 01:59 | `curl -L -I https://x.com/AxionIA` | **404** |
| 27 | 02:00 | `gh run list gsc-submit-main-sitemap.yml` | 6 derniers `schedule` (06/07 → 10/08) = **6 × failure** |
| 28 | 02:00 | LinkedIn `axion-ia-france` | 200 / 163 070 o — « Axion-IA.com », **Paris**, **Founded 2025** |
| 29 | 02:00 | LinkedIn `axion-ia` | HEAD **200**, corps vide (authwall) → identité **non établie** |
| 30 | 02:00 | lespepitestech.com/…/axion-ia | Champs-Élysées / 75008 / PARIS ; « **William** Jullin » |
| 31 | 02:00 | `/auteurs/manon.png` | **1 513 427 o** |
| 32 | 02:00 | `gh run list image-bank-seed.yml -L 30` | **24 runs, 100 % `workflow_dispatch`, 20-21 mai 2026, 0 `workflow_run`** ; workflow `state: active` |
| 33 | 02:02 | Google Suggest `axion-ia` | `["axion-ia","action ia","axion iasi",…]` — **identique à F3** |
| 34 | 02:02 | Google Suggest `audit ia grenoble` | `[]` |
| 35 | 02:03 | API recherche-entreprises `q=108018631` | AXION IA / GRENOBLE 38100 / création 2026-09-01 / **est_organisme_formation false** / **est_qualiopi false** |
| 36 | 02:05 | Moteur de réponse — « Qui est Axion-IA ? » | 9 liens, **0 sur axion-ia.com** |
| 37 | 02:06 | Moteur de réponse — « meilleur organisme formation IA PME Grenoble » | 7 sources, **0 mention Axion-IA** |
| 38 | 02:08 | Moteur de réponse — « Axion-IA avis clients formation » | Indeed *Axion Formation* #1, Indeed *Axion Formations Saint-Quentin* #3 ; **aucune page `/fr/avis`** |
| 39 | 02:10 | Wikidata `wbsearchentities?search=Axion-IA` | `"search":[]` — **0 item** |
| 40 | 02:05 | `sitemap-blog.xml` | contient bien `/fr/guides/<slug>` (3 relevés) → **réfute F1-P1d volet guides** |
| 41 | 02:12 | `sitemap/pages.xml` | 6 occurrences `mentions-legales`/`conditions-generales` → **valide la correction de F5 sur B1** |
| 42 | 02:12 | 5 plus gros chunks JS (gzip) | 72 292 + 65 598 + 41 106 + 15 584 + 13 410 o (16 chunks au total sur `/fr`) |
| 43 | 02:12 | `/_next/static/css/366c33068f15aaf4.css` | 35 100 o gzippés |
| 44 | 01:52 | Inspection visuelle `villes-hero/grenoble.jpg` | **« 100% GAGNANT »** visible |
| 45 | 02:14 | Inspection visuelle affiche métro | **« GAINS MESURABLES ASSURÉS »** visible ; **aucun montant** dans l'image |
| 46 | 02:14 | `scripts/enrich-images.cjs:41` | `Axion-IA : Formations IA · **Audits IA 490€** · …` (dans le prompt système) |

---

## Limites

- **Aucun accès SSH ni DB prod** dans ce rôle : F7-P0-b (absence d'access log), le
  `StartedAt` du restart de 18:49:06, l'état du flag `GSC_HCU_MONITOR_ENABLED`, le contenu
  de `Article.mentionedCities` et le volume d'`image_usage_logs` n'ont pas pu être
  re-vérifiés. Ils sont marqués INCERTAIN et non réfutés.
- **Pas d'accès à l'UI Sentry** : l'attachement effectif de `request.headers.user-agent`
  aux transactions reste à trancher (F7-P1-a).
- **Pas d'authentification LinkedIn** (conformément à la consigne) : l'identité du
  titulaire de `/company/axion-ia` reste ouverte.
- **Un seul moteur de réponse interrogé** (le même que F4). Les conclusions F4 valent pour
  ce moteur et son backend de recherche ; elles ne sont pas transposables telles quelles à
  Perplexity, ChatGPT Search ou Gemini.
- **Comptages non rejoués** : « 78/160 dimensions fausses », « 75 vignettes manquantes »,
  « ~30 fiches FAQ à double marque », « 289 pages galerie ». J'ai vérifié le mécanisme et
  au moins un cas de chacun, pas l'inventaire.
- **Aucun build, aucun Lighthouse, aucune suite de tests exécutés** (machine partagée,
  consigne). Les mesures de First Load JS sont des pesées de chunks servis en prod, pas un
  rapport Lighthouse.
- **Pas de vérification visuelle** des 59 héros villes ni des articles content-gen :
  1 héros ville et 1 affiche inspectés, extrapolation assumée sur le template commun.
