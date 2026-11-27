VERDICT A CORRIGER sha=417eb1a7 (R1) : src/services/import-video-externe.ts:69 — retirer `reseau: controle.reseaux[0]` (les réseaux de la Sortie doivent faire foi) et ajouter un test NOMMÉ sur `vueAPublier` qui exige une ligne par réseau coché ; aujourd'hui, cocher Instagram + LinkedIn + TikTok ne donne qu'UNE ligne (Instagram) dans « À publier ».

# Relecture R1 — IMPORT-VIDEO-EXTERNE-v21v (Studio, branche `video/IMPORT-VIDEO-EXTERNE-v21v`)

- Tête vérifiée : `417eb1a7a82cb41502d24e41dd6e5006635d4d00` (pas de « TÊTE CHANGÉE »).
- Aucune fiche fournie (dépôt des plans privé) : diff jugé seul.
- Lecture seule sur le Studio : aucun commit, aucun push ; les mutations et les tests jetables ont été retirés.

## Périmètre du diff (`git diff --stat origin/master...`)

10 fichiers, +511 / −4 : `actions-import.ts`, `a-publier/page.tsx`, `ImporterVideo.tsx`, `domaine/import-video-externe.ts`,
`domaine/types.ts`, `moteurs/ids.ts`, `moteurs/index.ts`, `services/import-video-externe.ts`, `services/publications.ts`,
`tests/import-video-externe.test.ts`. Le diff est petit et correspond au nom de la branche. Il ne touche ni `.github/**`, ni `deploiement/**`,
ni `outils/gardes/**`, ni `scripts/echecs-connus.json`, et ne contient aucun secret.

## Ce qui a été lancé

- `npx vitest run tests/import-video-externe.test.ts` : **20/20 verts**.
- Suites voisines (13 fichiers qui lisent `commandeEnEssai`, `videoEnEssai`, `vueAPublier` ou `listerAPublier`) : **172/172 verts**.
- `npx tsc --noEmit -p .` (avec `--max-old-space-size=10240` : sans ce réglage, tsc meurt par manque de mémoire) : **154 erreurs sur la branche,
  154 sur `origin/master`, aux mêmes emplacements**. Aucune erreur neuve. Les seules différences de texte sont l'ordre d'affichage des unions dans
  deux tests `image-video`. Les erreurs préexistantes viennent de l'environnement : `remotion` absent, `RouteContext`/`LayoutProps` sans `next typegen`.
- Dépendances : `pnpm install --frozen-lockfile` (magasin temporaire, `--ignore-scripts`).

## Mutations (sur `tests/import-video-externe.test.ts`)

| # | Mutation | Résultat |
|---|----------|----------|
| M1 | `commandeEnEssai` : on retire l'exception `MOTEUR_IMPORT_EXTERNE` | tuée (1 échec) |
| M2 | `videoEnEssai` : on retire `origineVideo === "importee"` | tuée (1 échec) |
| M3 | `importerVideoExterne` : on retire le refus `NON_VALIDEE` placé avant la lecture du fichier | tuée (1 échec) |
| M5 | `importerVideoExterne` : on retire `exigerSession()` | **survit**. Sans gravité : `fichierEnvoye` exige déjà la session (services/fichiers.ts:30) et l'action aussi. La promesse tient, le test ne prouve pas quelle couche la tient. |
| M6 | on retire la tolérance `video/x-m4v` | tuée |
| M7 | on neutralise la borne `DUREE_MIN_IMPORT_SEC` | tuée |
| M8 | on n'enregistre plus la Sortie | tuée (3 échecs) |
| M9 | on n'écrit plus de ligne de journal | tuée |

## Défaut bloquant : seul le premier réseau coché arrive dans « À publier »

`creerVideoImportee` pose `video.reseau = controle.reseaux[0]` (src/services/import-video-externe.ts:69). Or `vueAPublier`, qui est la source
réelle de la page `/a-publier`, lit les réseaux par `reseauxDeVideoStockee` → `reseauxDeLaVideo` (src/domaine/reseaux-video.ts:43). Cette fonction
donne la **priorité à `video.reseau`** sur `Sortie.reseaux`. Le champ `Video.reseau` sert d'ailleurs à marquer une « version par réseau »
(variante) : il n'a pas à être posé sur une vidéo importée.

Reproduction (test jetable, dépôts en mémoire, session ouverte) : on importe avec `reseaux: ["instagram", "linkedin", "tiktok"]`.

- Tête `417eb1a7` : `vueAPublier().lignes` → **1 seule ligne** (`instagram`, `reseauxVideo: ["instagram"]`). LinkedIn et TikTok disparaissent
  sans aucun message, alors que la Sortie porte bien les trois.
- Même code **sans** la ligne `reseau: controle.reseaux[0]` : une ligne par réseau (`linkedin`, `instagram`, …, `reseauxVideo` à trois réseaux).

Pourquoi les tests ne l'ont pas vu : « la vidéo importée apparaît dans listerAPublier » teste `listerAPublier` (une carte par vidéo), pas
`vueAPublier` (une ligne par réseau), alors que la page appelle `vueAPublier` (src/app/(studio)/a-publier/page.tsx:25). Le test
« crée une vidéo prête… » vérifie `Sortie.reseaux`, que l'écran ne lit pas dans ce cas.

**À faire** :
1. retirer `reseau: controle.reseaux[0]` dans `creerVideoImportee` ;
2. ajouter un test nommé du genre « chaque réseau coché a sa ligne dans À publier ». Il appelle `vueAPublier()` après une session ouverte et exige
   `lignes.filter(l => l.videoId === id).map(l => l.reseau)` égal, à l'ordre près, aux réseaux cochés ;
3. renommer ou compléter « la vidéo importée apparaît dans listerAPublier » pour qu'il porte sur ce que la page affiche réellement.

## Promesse dont le test ne prouve pas ce que son nom dit

« la vidéo importée n'est pas un essai **et peut partir** » ne vérifie que `commandeEnEssai` et `videoEnEssai`. Rien ne passe par le chemin
d'envoi ni par la ligne « À publier ». Ma sonde montre que la ligne n'a pas de `blocage` et pas d'`origineUsine` (la commande porte
`origine: "studio"`). Il faut que le test le prouve : soit en vérifiant sur `vueAPublier` l'absence de `blocage` et de `blocageVideo`, soit en
retirant « et peut partir » de son nom.

## Points non bloquants, à trancher (observés en sondant les chemins aval, hors diff)

- **Retouche acceptée sur une vidéo importée.** Comme `idMoteurDeCommande({ moteurId: "import-externe" })` retombe sur `"simulation"`,
  `lancerRetouche(videoId, [], …)` est **acceptée**. La vidéo passe `en_fabrication` (elle sort donc d'« À publier » pendant ce temps), puis le
  travail finit en `echec` et la vidéo revient à `prete`. `proposerModification` interroge `fournisseur("script").interpreterDemande`, qui est un
  appel Claude payant en production, pour une vidéo qui n'a aucun plan. Un refus net (« vidéo importée : pas de retouche ») serait plus juste.
  On peut le poser dans `retouchable` et `retoucheSousVerrou` sur `origineVideo === "importee"`, ou par un `moteurDeCommande` qui ne retombe pas
  sur la simulation.
- `lancerFabrication` sur cette vidéo jette `Error("Format inconnu : video-importee")`, une erreur brute et non une `ErreurStudio` en français.
  C'est inoffensif si aucun bouton « Refaire » ne s'affiche, mais je ne l'ai pas vérifié dans l'interface.
- Les cases « avant de publier » restent `["image","son","sousTitres","mentionIA","droits"]` : on demande de cocher « sous-titres » et
  « mention IA » sur une vidéo à laquelle on n'en a délibérément pas ajouté.
- Le fichier est envoyé (jusqu'à 1 Go) **avant** que le serveur contrôle taille, durée et format. Un refus laisse un fichier orphelin dans le
  stockage, et le navigateur ne fait aucun contrôle préalable de taille ni de durée.
- `ImporterVideo.tsx` : le `catch` attribue toute erreur à « Le fichier n'a pas pu être envoyé », y compris une erreur jetée par l'action
  (au-delà d'`essayer`).

## Ce qui est prouvé et juste

- Refus avec un message simple et rien d'écrit : format, vide, trop lourd, trop long, trop court, durée illisible, titre vide, aucun réseau
  connu, case non cochée (compteurs avant/après).
- La case non cochée est refusée **avant** la lecture du fichier (M3 tuée).
- Une vidéo importée n'est pas un essai, et le garde-fou reste en place pour `simulation` et pour un moteur inconnu (M1 et M2 tuées).
- Fichier d'une autre vidéo, d'une autre destination, de démonstration ou incomplet : refusé.
- Ratio déduit de la taille, résolution posée, ligne de journal écrite (M9 tuée), aucun fournisseur appelé hors stockage.
