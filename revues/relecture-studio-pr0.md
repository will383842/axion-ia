# Relecture · Studio PR #1766 « Pinterest, PR 0 » (branche `feat/pinterest-pr0`)

- Rôle : auditeur, lecture seule. Aucune ligne du Studio n'a été modifiée.
- PR relue : `will383842/studio-axion-ia-public#1766`, commit `2a068df6`, base `10d60d33` (#1752). `git diff origin/master...FETCH_HEAD`
  (master à `65dcd08f` au moment de la relecture ; aucun des 4 fichiers n'y a bougé depuis la base).
- Référence : `revues/critique-plan-pinterest-studio.md` (branche `verdict/critique-plan-pinterest-studio` de ce dépôt), § 2, § 3 et
  § 7 « PR 0 ».
- Lu dans le Studio : `docs/adr/0004`, `0010`, `0012`, liste des ADR, `docs/zernio/openapi-extrait-1.418.1.json` (chaque pointeur
  du relevé résolu par script), `src/domaine/cadence/reglages.ts`, `src/domaine/site-videos/contrat.ts:100`, occurrences de CAL-23.
- **Test lancé** : `tests/reseaux/regles-officielles.test.ts` sur la branche de la PR, avec le Vitest de ce dépôt et une config
  minimale (les dépendances du Studio ne sont pas installées ici) → **7 réussis, 1 sauté** (`MOTS_FONDATEUR` non fourni : le
  contrôle des noms privés par liste n'a donc **pas** tourné, il est fait à la main plus bas).

Diff : 4 fichiers, documents et un test seulement (`docs/adr/0015-pinterest-epingles.md` nouveau,
`docs/reseaux/REGLES-OFFICIELLES.md`, `docs/reseaux/regles-officielles.json`, `tests/reseaux/regles-officielles.test.ts`).
Aucun code, aucun interrupteur, aucun appel réel. ✅

---

## 1. Conformité au « PR 0 » du plan corrigé (§ 7)

| Attendu (§ 7, PR 0)                                                                                                         | Dans la PR                                                                                                                                  | Verdict            |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| ADR-0015, statut « brouillon, à valider par le fondateur »                                                                  | `0015-pinterest-epingles.md:3` ; numéro libre (0005-0009 n'existent pas, 0015 suit 0014) ; même statut que 0010 à 0014                      | ✅                 |
| D6 : `+ GET /v1/accounts/{id}/pinterest-boards` ; refusés `PUT`/`POST` même route, `posts/{id}/edit`, `connect/pinterest/*` | `:16`, mot pour mot                                                                                                                         | ✅                 |
| D8 : `isAiGenerated: true` si `epingle.contenuIA === true`, rien sinon                                                      | `:18` ; justifié par l'extrait (`PinterestPlatformData.isAiGenerated` : « Pinterest offers no "not AI" value ») ; porté par l'épingle (B-6) | ✅                 |
| D9 : `<accountId>:pin:<boardId>`, jamais le premier tableau, `PUBLIC` seulement                                             | `:20`                                                                                                                                       | ✅                 |
| D10 : 1 image JPEG/PNG/WebP, ≤ 20 Mo, 2:3 ± 1 %, ≥ 1 000 px ; alt 1-500 Pinterest seul ; lien https, hôte égal              | `:22` (ajoute titre 1-100 et description ≤ 800, conformes au § 3)                                                                           | ✅ (voir C-2)      |
| ADR-0010 : lot « à valider », « Valider ce lot » = validation datée, créneau par créneau ; rien avant le tour               | `:24` ; cohérent avec ADR-0010 « Rien ne part sans la validation du fondateur »                                                             | ✅                 |
| ADR-0012 : anti-répétition (empreinte de l'image, couple lien + tableau)                                                    | `:26`, mais « refuse » là où ADR-0012 dit « signalé, le fondateur tranche »                                                                 | ⚠️ C-3             |
| Limites : pas de modification après envoi ; publié hors Studio non rapatrié                                                 | `:32-34` ; « avant envoi, CAL-23 » conforme à I-7 et au code (`services/deplacer-programmation.ts:2`, `FicheEntree.tsx:260`)                | ✅                 |
| Relevé `.json` + `.md` : section `pinterest`, 2 couches, constantes `IMAGES_MAX.pinterest`, `ALT_MAX_PINTEREST`             | présents ; test vert                                                                                                                        | ✅ (voir C-1, C-5) |
| Cellules Zernio « officiel » : 1 média, description 800, titre 100, alt 500, 32 Mo, débit                                   | titre 100 ✅, alt 500 ✅, 25 posts/h ✅ ; **1 média, 800, 32 Mo → « inconnu »** (absents de l'extrait)                                      | ⚠️ C-6             |
| Extrait OpenAPI : chemin `pinterest-boards` régénéré par une session qui joint zernio.com                                   | **non fait**, écrit en « Points laissés ouverts » (`0015:61`) et dans « À valider » (`REGLES-OFFICIELLES.md:211`)                           | ⚠️ C-6             |
| Test : `ACTIFS` + `pinterest`, constantes confrontées                                                                       | `regles-officielles.test.ts:36,98,136`                                                                                                      | ✅                 |
| Point de contrôle hors dépôt (fichiers patchés sur le serveur)                                                              | `0015:62`                                                                                                                                   | ✅                 |

## 2. Décisions imposées par la consigne

| Décision                                          | Dans la PR                                                                               | Verdict                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------- |
| Texte alternatif 500 pour Pinterest **seulement** | `0015:22` « 1 à 500 signes pour Pinterest seulement (les autres réseaux restent à 125) » | ✅ (mais C-1 dans le relevé) |
| Lien sur le **seul domaine du site**              | `0015:22` « hôte égal … ni sous-domaine, ni autre domaine » ; alternative écartée `:50`  | ✅ (voir C-2)                |
| Mention IA selon `contenuIA`                      | `0015:18`, « si et seulement si »                                                        | ✅                           |
| Créneaux 08:30 / 12:30 / 17:30 / 21:00, Paris     | `0015:28`                                                                                | ✅ (voir C-4)                |
| Un seul compte Pinterest                          | `0015:28` « Un seul compte Pinterest est prévu (le code en tolère plusieurs) »           | ✅                           |

Aucune contradiction franche avec ces cinq décisions.

## 3. Exactitude face au code et à l'extrait (pointeurs résolus un par un)

| Cellule Pinterest (couche Zernio)        | Pointeur                                           | Ce que dit l'extrait                                                                                                                                             | Verdict                                                                                         |
| ---------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `premier_commentaire`                    | `PinterestPlatformData/properties`                 | 7 champs (`title`, `boardId`, `boardSectionId`, `link`, `coverImageUrl`, `coverImageKeyFrameTime`, `isAiGenerated`), aucun premier commentaire                   | ✅                                                                                              |
| `duplication`                            | `paths/~1v1~1posts/post/responses/409`             | `(platform, accountId, content-hash)` 24 h ; `idempotency_conflict`                                                                                              | ✅ (voir C-7)                                                                                   |
| `statistiques`                           | `paths/~1v1~1analytics/get`                        | le texte « saves … (Instagram, Pinterest, X) » est dans `components/schemas/PostAnalytics/properties/saves/description`, pas sous ce chemin (atteint par `$ref`) | ⚠️ nit, même convention que les 5 autres réseaux (`regles-officielles.json:41,120,280,440,600`) |
| `plafond_posts`                          | `responses/429`                                    | « velocity limit (25 posts/hour per account) … daily platform limits »                                                                                           | ✅                                                                                              |
| `plafond_texte`                          | `PinterestPlatformData/properties/title/maxLength` | 100                                                                                                                                                              | ✅                                                                                              |
| `plafond_mots_dieses`                    | `…/properties/hashtags/description`                | « NOT automatically appended »                                                                                                                                   | ✅                                                                                              |
| `texte_alternatif`                       | `MediaItem/properties/altText/description`         | « Pinterest (max 500 chars) » ; **rien sur 125**                                                                                                                 | ⚠️ C-1                                                                                          |
| Couche 1 (réseau Pinterest), 11 cellules | —                                                  | toutes « inconnu », `url`/`date`/`copie_depot` à `null`                                                                                                          | ✅ honnête (aucune page Pinterest lue)                                                          |

## 4. Contenu privé

Balayage du diff (IP, adresses, identifiants numériques ≥ 8 chiffres, `urn:li`, prix, nom du compte GitHub, noms) : **rien**.
Les cibles restent des gabarits (`<accountId>`, `<boardId>`) ; « les identifiants vivent en base, jamais dans le dépôt » (`0015:20`). ✅
Rappel : le contrôle par `MOTS_FONDATEUR` n'a pas tourné ici (variable absente) ; il doit tourner dans la CI du Studio.

---

## 5. Corrections demandées

**C-1 (à corriger) · Une cellule « officiel » affirme ce que sa source ne dit pas.**
`docs/reseaux/REGLES-OFFICIELLES.md:181` et `regles-officielles.json` (cellule `pinterest.zernio.texte_alternatif`) :
« 500 signes au plus sur Pinterest **(125 sur les autres réseaux du Studio)** ». La source pointée (`MediaItem.altText`) ne donne
aucun 125 (elle donne X 1000, Pinterest 500, rien pour les autres) ; le 125 est un choix du Studio que le même document range
lui-même en « aucune source trouvée, à prouver ou à retirer » (`REGLES-OFFICIELLES.md`, section « À valider », 3e ligne). Une
cellule de niveau « officiel » ne doit porter que la source. → Valeur : « 500 signes au plus sur Pinterest ». Le rappel du 125
reste à sa place dans la note de la constante (`:198`), qui parle du code.

**C-2 (à corriger) · `site.domaine` est présenté comme un réglage existant.**
`0015:22` « (réglage `site.domaine`) ». Aucun réglage de ce nom dans `src/` (seul `site.reglages`, `services/source-axion.ts:37`).
La critique (§ 5) prévoit : domaine lu dans un réglage, **défaut = hôte de `BASE_PUBLIQUE`** (`domaine/site-videos/contrat.ts:100`).
→ Écrire : « réglage `site.domaine`, créé en PR 3, défaut = hôte de `BASE_PUBLIQUE` », et rappeler que la garde réutilise
`lienDeChezNous` (`fournisseurs/publication/zernio-inbox-corps.ts:76`) avec égalité stricte d'hôte (I-9), plutôt qu'une garde neuve.

**C-3 (à corriger) · ADR-0012 durcie sans le dire.**
`0015:26` « L'import d'épingles **refuse** un doublon ». ADR-0012 (`0012:15`) : « Un contenu trop proche est **signalé** au
fondateur, **qui tranche** ». Refuser une empreinte d'image identique est défendable, mais c'est un amendement : l'écrire
« Amendement ADR-0012 » avec sa raison, ou s'aligner sur « signale, le fondateur tranche ». Préciser aussi que la comparaison
porte sur les contenus **déjà publiés ou programmés** (texte d'ADR-0012), pas seulement sur le lot importé.

**C-4 (à corriger) · Un chiffre nouveau, non sourcé, et le lieu des heures absent.**
`0015:28` « 210 minutes d'écart minimum ». Ni le plan corrigé ni la consigne ne posent ce chiffre (210 = écart 17:30 → 21:00, le
plus petit des quatre créneaux). Dans le code, `ecartMinMinutes` est un « écart **conseillé** » qui produit un message
(`domaine/cadence/reglages.ts:27-28,223-224`), pas un refus. → Soit dire « 210 min = plus petit écart entre deux créneaux décidés,
appliqué comme écart conseillé de la cadence », soit le retirer. Et écrire, comme le demande I-4, que les quatre heures vivent dans
`REGLAGES_CADENCE_DEFAUT.reseaux.pinterest` (lues par l'import, jamais codées dans la page).

**C-5 (à corriger) · Deux constantes « confrontées » qui n'existent pas encore.**
`REGLES-OFFICIELLES.md:197-198` / `regles-officielles.json:867-880`, sous le titre « Constantes de `zernio-corps.ts` confrontées à
leur source (Fichier lu seulement) ». `valeur_code` vaut `1` et `500 signes`, et `ALT_MAX_PINTEREST` est « **conforme** », alors
qu'aucune de ces constantes n'est dans le code (la note le dit). → `valeur_code` : « 1 (à poser en PR 3) » et « 500 signes (à poser
en PR 3) », pour qu'un lecteur du tableau seul ne croie pas le code déjà conforme.

**C-6 (accepté tel quel, à tenir) · Extrait OpenAPI non régénéré ⇒ trois cellules « officiel » en « inconnu ».**
Le § 7 voulait 1 média, description 800 et 32 Mo en « officiel ». Le test exige une `copie_depot` résolue dans un `docs/*.json`
(`regles-officielles.test.ts:73-79`) et l'extrait ne se modifie pas à la main (`docs/zernio/LISEZMOI.md`) : « inconnu » est la
seule valeur honnête, et c'est écrit trois fois (`REGLES-OFFICIELLES.md:11,211`, `0015:61`). **Condition** : la régénération de
l'extrait est un préalable de la PR 3 (route des tableaux dans D6) ; à inscrire comme tel dans `0015:61` (« avant la PR 3 »).

**C-7 (nit) · Incohérences mineures.**

- `0015:34` affirme « pas de boîte de réception côté Zernio », alors que le relevé laisse `reponses_commentaires` et
  `messages_prives` en « inconnu » (`REGLES-OFFICIELLES.md:11` le dit même « non couvert par l'extrait »). Ajouter « (doc
  `reference.mdx`, hors extrait) » dans l'ADR.
- Cellule `duplication` : l'extrait dit aussi « Content variations are recommended for X and Pinterest to avoid duplicate flags »
  (`components/schemas/RecyclingConfig/description`) ; utile pour 500 épingles, à ajouter.
- `REGLES-OFFICIELLES.md:211` liste « débit » parmi les inconnus alors que `plafond_posts` est rempli (25/h) ; préciser « débit en
  rafale (≥ 10) ».
- La PR fusionne deux lignes existantes de « À valider » (25/h et 24 h) : nécessaire pour rester sous la limite de 10 lignes du
  test (`regles-officielles.test.ts:131`), sens conservé. Rien à corriger, à mentionner dans la description de PR.

---

## 6. Bilan

La PR fait ce que demande le PR 0, sans code ni appel réel, et respecte les cinq décisions de la consigne. Ses « inconnu » sont
honnêtes et le test passe. Il reste quatre corrections de fond, toutes dans des documents : une cellule « officiel » qui attribue
à Zernio un 125 que la source ne donne pas (C-1), un réglage présenté comme existant (C-2), ADR-0012 durcie sans le dire (C-3), et
un chiffre de 210 min sans source (C-4). S'y ajoute une précision dans le tableau des constantes (C-5). Ce sont des corrections de
quelques lignes, mais le relevé sert de preuve aux PR 3 à 7 : il doit être exact avant la fusion.

VERDICT: A CORRIGER
