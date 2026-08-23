# Console éditoriale — rapport des lots 0 à 6

_Session du 21 août 2026. Branche `feat/console-editoriale`, base `09f7500fa`._

Ce document complète `2026-08-21_CONSOLE-EDITORIALE-LOT-0-RAPPORT.md`, qui ne
couvrait que le lot 0. Il vaut pour l'ensemble.

---

## 1. Ce qui est livré

**13 commits · 73 fichiers · ~18 500 lignes · 423 tests unitaires éditoriaux.**

| Lot   | Objet                   | Critères | État                                 |
| ----- | ----------------------- | :------: | ------------------------------------ |
| **0** | Voir les quatre mois    |   6/6    | ✅                                   |
| **1** | Remplacer le tableur    |  18/18   | ✅                                   |
| **2** | La médiathèque          |   5/5    | ✅                                   |
| **3** | La mesure               |   4/4    | ✅                                   |
| **4** | L'équipe                |   3/3    | ✅                                   |
| **5** | Publication automatique |    —     | ⚠️ **contrat livré, portes fermées** |
| **6** | Achat média             |    —     | ⚠️ **crochets livrés**               |

Les lots 5 et 6 n'avaient **pas de critères écrits** : le plan dit « à écrire au
moment du lot : ils dépendent des portes ouvertes à cette date ». Voir §4.

---

## 2. L'état des vérifications

| Vérification     | Résultat                                                                 |
| ---------------- | ------------------------------------------------------------------------ |
| `pnpm typecheck` | **0 erreur**                                                             |
| `pnpm lint`      | **0 erreur, 39 avertissements** — la baseline exacte de `main`           |
| `pnpm test`      | **822 fichiers, 23 702 tests, 0 échec** (baseline `main` : 814 / 23 403) |
| `pnpm build`     | vert — 11 310 pages générées                                             |
| E2E Playwright   | 17 tests, 15/17 au mieux — instable en local, voir §5                    |
| Base vierge      | volume Docker **détruit**, 192 migrations, amorçage et import rejoués    |

### Poids des routes, mesuré

Le tableau des routes de ce projet **n'imprime pas le First Load JS** : la
mesure est faite depuis les manifestes, en gzippant réellement les chunks.

| Route                                                     | First Load JS |         Delta vs témoin `alerts` |
| --------------------------------------------------------- | ------------: | -------------------------------: |
| `/kit`                                                    |   163,8 kB gz |     **+2,03 kB** (bouton copier) |
| `/calendrier`                                             |   163,0 kB gz | **+1,26 kB** (grille déplaçable) |
| `/publications/[id]`                                      |   162,6 kB gz |  **+0,88 kB** (dépôt de fichier) |
| tableau de bord, publications, idées, recherche, création |   161,8 kB gz |                     **+0,00 kB** |

**~4,2 kB gz de JavaScript client pour toute la console**, répartis sur trois
composants dont chacun porte sa justification `use-client`.

Les 161,8 kB de base sont le coût **préexistant** du shell d'administration,
payé à l'identique par `alerts` et `activity-logs`.

---

## 3. Les défauts trouvés — et ce qu'ils auraient coûté

### Trois auraient atteint la production en silence

1. **Le diff Prisma voulait supprimer les index HNSW pgvector.** Dérive
   préexistante entre migrations et schéma. Embarquée, elle détruisait la
   recherche sémantique en production **au nom d'un lot éditorial**. Parade :
   diffuser schéma contre schéma, puis `grep -c DROP` → 0.
2. **Un `\s` gourmand vidait le premier commentaire des 61 publications.**
   `\s` contient le saut de ligne ; le marqueur débordait sur la ligne
   suivante et avalait le texte qu'il devait introduire. Trouvé par un test.
3. **La fixture E2E partagée était morte.** Locator ambigu sur le mot de passe
   - vérification d'URL exigeant un `/fr` que l'application n'émet pas.
     **Tout** test authentifié du dépôt se sautait en silence.

### Trois attrapées par les gardes du dépôt

Ni le typecheck ni le lint ne les voyaient :

- deux **jetons CSS inventés** (`.admin-code`, `--color-admin-accent-soft`) —
  du style qui n'aurait rien peint ;
- **`admin-input w-full`** : l'utilitaire Tailwind est inerte derrière une
  classe hors couche… et redondant, `.admin-input` porte déjà `width: 100%` ;
- un **`<div>` récepteur muet**, sans rôle ni nom accessible.

### Deux d'arithmétique silencieuse

- `JSON.stringify` ne sérialise pas un `BigInt`, et `EdAsset.poidsOctets` en
  est un : la sauvegarde levait au premier asset pesé, c'est-à-dire au moment
  précis où l'on essaie de sortir ses données.
- `toLocaleString` en `fr-FR` insère un espace **insécable** avant le `€`,
  produisant l'échec le plus déroutant qui soit — « expected '0 €' to be
  '0 €' ».

### Témoin négatif

Comme l'exige le §1 du protocole, l'évaluateur de conformité a été **cassé
volontairement** en deux endroits → **11 tests ont rougi**, puis restauré. Les
gardes gardent réellement.

---

## 4. ⚠️ Ce qui n'est PAS livré, et pourquoi

### Le lot 5 ne peut pas être codé aujourd'hui

Le plan le dit : les critères « dépendent des **portes ouvertes** à cette
date ». Une porte n'est pas une ligne de code — c'est un accès délivré par une
plateforme après demande, revue ou audit.

| Plateforme                 | Porte                           | Lot | Ouverte ? |
| -------------------------- | ------------------------------- | --- | --------- |
| LinkedIn profil            | `w_member_social`, self-serve   | 5a  | ❌        |
| Meta (Facebook, Instagram) | application + jeton de page     | 5b  | ❌        |
| YouTube                    | API Data v3, 10 000 unités/jour | 5c  | ❌        |
| LinkedIn page              | revue partenaire                | 5d  | ❌        |
| **TikTok**                 | **audit**                       | 5e  | ❌        |

Ce qui EST livré : le contrat `AdaptateurPublication` du §10 à la lettre,
l'adaptateur **`Manuel`** (le seul que le §10 attribue au lot 1, et celui que
Will utilise réellement), et un registre qui **dit** quelle porte manque.

> 🔴 **TikTok mérite d'être répété.** Sans l'audit, la plateforme force TOUTES
> les publications de l'application **en privé**. Un adaptateur qui publierait
> quand même aurait l'air de fonctionner — statut « publié », référence rendue,
> aucune erreur — et **personne ne verrait jamais les vidéos**. Un test vérifie
> qu'aucune porte n'est marquée ouverte, pour que l'ouvrir soit un geste
> délibéré.

### L'import n'a jamais vu les vraies données

`Linkedin complet.zip`, `02-calendrier-publication.csv`, `10-LES-61-POSTS.md`
restent **introuvables** sur cette machine. Tout repose sur une fixture fidèle
au format du §6 (BOM UTF-8, CRLF, `;`). **Les critères 2, 3 et 4 du lot 0 sont
à rejouer** dès que les fichiers seront fournis.

### `ffprobe` n'est pas dans le projet

La durée d'une vidéo déposée n'est donc pas extraite. `dureeSec` reste `null`,
et la règle `spec-plateforme` rend « non évaluée » sur ces assets **au lieu de
les déclarer conformes**. Ajouter `ffprobe` est un choix d'infrastructure — un
binaire dans l'image Docker — pas une ligne de code.

### Les passes 4, 5 et 6 du protocole

Adversariale, croisée à l'aveugle, bout en bout cumulé. Elles exigent un
vérificateur **qui n'a pas écrit le code** ; un seul agent a tenu tous les
rôles. C'est la limite la plus sérieuse de cette session.

---

## 5. Points ouverts pour Will

| #   | Sujet                                                                                             | Décision attendue                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | **La fixture E2E réparée démasque 2 tests préexistants** (`admin-booking-flow`, `admin-nav-clic`) | Aucun ne concerne ce lot. À rejouer en CI (`pnpm start`) avant de conclure : les causes sentent le serveur de dev             |
| 2   | **§14 #4 — la liste des piliers**                                                                 | 0 pilier semé, volontairement. Aucun critère livré n'en dépend                                                                |
| 3   | **§14 #1 — TikTok perso ou pro**                                                                  | Emplacement gardé, compte inactif                                                                                             |
| 4   | **§14 #5 — outil d'envoi de la newsletter**                                                       | Jalon du 11 octobre                                                                                                           |
| 5   | **`EDITORIAL_STORAGE_PATH`**                                                                      | Volume dédié choisi par défaut. À déclarer sur Coolify avant tout dépôt de fichier en production                              |
| 6   | **`prisma/migrations_fts/editorial_fts.sql`**                                                     | S'applique à la main (`psql -f`), comme les autres FTS du dépôt. La recherche fonctionne sans, en mode dégradé, **et le dit** |

### L'instabilité E2E en local

`pnpm dev` compile à la demande et renvoie des **404 transitoires** pendant
qu'il reconstruit son arbre de routes. À chaque exécution un test différent
rougit, capture à l'appui montrant le 404 du site public. Une passe à 15/17 a
eu tous les écrans au vert, et les routes ont été sondées directement (302
sans session, 200 avec).

🔑 **Un rouge de `console-editoriale.spec.ts` en local se vérifie d'abord en
regardant la capture.** Si elle montre « Erreur d'aiguillage », c'est le
serveur de dev, pas le code.

---

## 6. Rollback

Le lot est **entièrement additif** : 24 tables neuves, 13 énumérations neuves,
zéro modification d'une table existante.

| Si…                                          | Alors                                                                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Les écrans cassent                           | Supprimer `src/app/**/console-editoriale/`. Rien d'autre n'en dépend                                              |
| La migration doit être annulée               | `DROP TABLE ed_*` (24) puis `DROP TYPE "Ed*"` (13). Aucune perte hors console éditoriale                          |
| L'import a versé de mauvaises données        | `DELETE FROM ed_publications WHERE ref_import LIKE 'linkedin-2026-q4-%'` puis supprimer le marqueur `SiteSetting` |
| Le correctif de la fixture E2E pose problème | Il est isolé dans `tests/e2e/fixtures/admin-auth.ts`, en deux lignes                                              |

**Un déploiement inachevé ne casse rien** : sans amorçage, les écrans affichent
leur état vide, qui explique quoi lancer.
