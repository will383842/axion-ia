VERDICT A CORRIGER sha=e112fded (R2) : tests/import-video-externe.test.ts — 8 mutations sur 15 survivent : ajouter des tests (1) importerVideoExterne : session exigée, NON_VALIDEE avant fichierEnvoye, fichier refusé si mauvais type/entiteId (src/services/import-video-externe.ts:98-100) ; (2) ratioDeLaTaille 16:9/1:1/4:5 (:31) ; (3) refus TAILLE vide, TITRE vide, RESEAUX vides ou inconnus, mime vide toléré (src/domaine/import-video-externe.ts:40,53,58-60)

## Contrôles

- Tête vérifiée : `e112fdedf35ce1bbe438a633ccd6a86b498d84d1` (= e112fded).
- Diff `origin/master...origin/video/IMPORT-VIDEO-EXTERNE-v21v` : 7 fichiers, +376 lignes, aucune suppression. Il est petit et va avec le nom de la branche : un domaine pur, un service, une action serveur, un composant client, un bouton dans la page « À publier », le champ `origineVideo?: "importee"` dans `Video`, un fichier de test. Aucun fichier touché dans `.github/**`, `deploiement/**`, `outils/gardes/**` ni `scripts/echecs-connus.json`. Aucun secret.
- `pnpm install --frozen-lockfile` : OK.
- `npx vitest run tests/import-video-externe.test.ts` : 7 tests sur 7 passent.
- Non-régression des tests qui appellent `listerAPublier` : `tests/a-publier.test.ts`, `tests/usine/ap-01-a-publier-formats.test.ts`, `tests/tutoriel-outil/contrat-usine.test.ts` → 28 tests sur 28 passent. La suite complète n'a pas été lancée jusqu'au bout : elle dépasse 9 minutes ici et a été coupée.
- `npx tsc --noEmit -p .` (avec `--max-old-space-size=7000`, sinon le processus manque de mémoire) : 154 erreurs sur la branche comme sur `origin/master`. Les deux listes `fichier(ligne,col): code` sont identiques, donc **aucune erreur neuve**. Les seules différences de texte viennent de l'ordre d'affichage des unions dans les messages. Aucune erreur ne porte sur un fichier du diff.

## Mutations (15, code remis à l'identique après chacune, `git status` vide à la fin)

| # | Mutation | Résultat |
|---|----------|----------|
| M1 | domaine : garde `valide !== true` neutralisée | tuée (« sans case cochée rien n'est créé ») |
| M2 | domaine : borne taille `> MAX` → `> MAX + 1` | tuée |
| M3 | domaine : borne durée max `> 600` → `>= 602` | tuée |
| M9 | domaine : durée min 3 → 1 | tuée |
| M13 | service : `etapeEditoriale` validée → `a_relire` | tuée (2 tests) |
| M14 | service : `mentionIA.incrustee` → true | tuée |
| M4 | domaine : type MIME vide refusé (`m === ""` retiré) | **SURVIT** |
| M5 | domaine : garde `taille <= 0` retirée | **SURVIT** |
| M6 | domaine : refus `TITRE` (titre vide) retiré | **SURVIT** |
| M7 | domaine : refus `RESEAUX` (aucun réseau) retiré | **SURVIT** |
| M8 | domaine : filtre des réseaux inconnus retiré | **SURVIT** |
| M10 | service : `await exigerSession()` retiré de `importerVideoExterne` | **SURVIT** |
| M11 | service : garde NON_VALIDEE avant `fichierEnvoye` retirée | **SURVIT** |
| M12 | service : `ratioDeLaTaille` renvoie toujours 9:16 | **SURVIT** |
| M15 | service : `fichierEnvoye` (contrôle type `video` + `entiteId` + statut) remplacé par une lecture brute | **SURVIT** |

## À corriger (tests à ajouter, le code lui-même paraît juste)

1. `src/services/import-video-externe.ts:97-103` (`importerVideoExterne`) n'est jamais testé. Les tests n'appellent que `creerVideoImportee`, donc la session, la case cochée avant tout et le contrôle du fichier réellement arrivé ne sont pas prouvés. Ajouter des tests : sans session → refus ; `valide: false` → NON_VALIDEE **sans lire le fichier** ; fichier d'un autre `typeEntite`, d'un autre `entiteId` ou au statut différent de `pret` → FICHIER_INCONNU / ENVOI_INCOMPLET, sans rien créer ; cas nominal → vidéo créée et ligne de journal écrite.
2. `src/services/import-video-externe.ts:31` (`ratioDeLaTaille`) : seul 1080×1920 est essayé. Tester 1920×1080 → 16:9, 1080×1080 → 1:1, 1080×1350 → 4:5, et une taille absente ou nulle → 9:16.
3. `src/domaine/import-video-externe.ts` : tester les refus `TAILLE` (taille 0), `TITRE` (titre vide ou fait d'espaces), `RESEAUX` (liste vide, ou seulement des réseaux inconnus), la tolérance du type MIME vide et de `video/x-m4v` pour un mp4, le titre coupé à 120 caractères et les réseaux en double fusionnés.
4. Les noms de tests doivent dire la promesse. Exemples : « un réseau inconnu est ignoré, et sans réseau connu rien n'est créé », « l'import exige une session et un fichier réellement arrivé pour cette vidéo ».

## Remarques sans blocage

- `ImporterVideo.tsx` : la case est vérifiée côté client avant l'envoi du fichier, et le serveur revérifie, ce qui est cohérent. Le composant n'a pas de test, ce qui est acceptable pour l'interface puisque les décisions sont prises côté serveur.
- `formatId: "video-importee"` ne correspond à aucun format du registre. Les tests « À publier » existants passent, mais aucun test ne couvre l'ouverture de la fiche vidéo d'une vidéo importée.
