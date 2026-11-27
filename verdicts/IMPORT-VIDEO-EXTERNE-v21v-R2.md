VERDICT A CORRIGER sha=a3236655 (R2) : src/components/publication/ImporterVideo.tsx:54-56 et src/services/import-video-externe.ts:101-102 — un import refusé (format, > 1 Go, durée illisible/hors bornes, titre, réseaux) laisse le fichier déjà envoyé (jusqu'à 4 Go) orphelin au stockage R2 et en base ; appeler `controlerImportVideo` dans le navigateur AVANT `envoyerFichier` (et ne pas envoyer si la durée n'a pas pu être lue), et côté serveur, en cas de refus après `fichierEnvoye`, passer le Fichier en « refuse » et `stockage.supprimer(cleStockage)` (même patron que `tutoriel-capture-auto.ts:415-418`), avec un test « un import refusé ne laisse aucun fichier au stockage ».

## Contrôles

- Tête : `a323665520f5b6d0ee23cd08957a7897eaeda54a` (= a3236655, inchangée).
- Diff `origin/master...origin/video/IMPORT-VIDEO-EXTERNE-v21v` : 13 fichiers, +591/−7, cohérent avec le nom de branche. Ne touche ni `.github/**`, ni `deploiement/**`, ni `outils/gardes/**`, ni `scripts/echecs-connus.json`, aucun secret.
- `npx vitest run tests/import-video-externe.test.ts` : **25/25 verts**.
- Non-régression (modules touchés) : `tests/a-publier*`, `tests/modifications`, `tests/fabrications*`, `d1-moteur`, `miniatures-essai-sans-rendu`, `facecam-retouche`, `c1-argent-b1-retouche-avocat`, `e2e-verif1-a2-publication` : **20 fichiers, 238/238 verts**.
- `npx tsc --noEmit -p .` (heap 7 Go) : 154 erreurs sur la branche, **154 sur master, mêmes fichiers et lignes** (remotion absent, `RouteContext`/`LayoutProps` sans `next typegen` ; deux lignes ne diffèrent que par l'ordre d'affichage d'unions). **Aucune erreur neuve.**
- Installation : `pnpm install --frozen-lockfile --store-dir <tmp> --ignore-scripts` (le magasin pnpm partagé est en lecture seule).

## Mutations (23 faites, code remis à chaque fois, arbre propre vérifié)

Tuées (au moins un test rouge) :
M1 `commandeEnEssai` sans exclusion `import-externe` · M2 garde `lancerFabrication` retirée · M3 borne durée min `<` → `<=` · M4 borne taille `>` → `>=` · M5 `importerVideoExterne` ne vérifie plus la case avant de lire le fichier · M6 `estimerReexport` sans garde · M7 `videoEnEssai` sans `origineVideo` · M8 `exemplesModification` sans garde · M9 `reexportSousVerrou` sans garde · M10 `proposerModification` sans garde · M11 MIME vide refusé · M12 réseaux non dédoublonnés · M13 étape `a_relire` au lieu de `validee` · M14 domaine sans contrôle de la case · M15 `retoucheSousVerrou` sans garde · M16 `estimerRetoucheVideo` sans garde · M18 mention IA incrustée · M19 `video/x-m4v` accepté pour tout format · M20 ratio le plus lointain · M21 pas de ligne de journal · M22 titre non coupé à 120 · M23 `entiteId` non vérifié.

Survivante : M17 (retrait de `exigerSession()` dans `importerVideoExterne`) — **mutant équivalent** : `fichierEnvoye` (`src/services/fichiers.ts:30`) exige déjà la session, et l'action serveur aussi. Pas un trou.

## Pourquoi « à corriger »

1. **Fichier orphelin après refus (bloquant).** `ImporterVideo.tsx:54-56` lit les métadonnées puis envoie le fichier **quoi qu'il arrive** (même `dureeSec: 0` quand la lecture échoue) ; tous les contrôles (format, 1 Go, 3 s–10 min, titre, réseaux) n'ont lieu qu'après, dans `creerVideoImportee`. `/api/depots` accepte jusqu'à 4 Go pour `typeEntite: "video"` (`src/services/envois.ts:19,49`). Un refus laisse donc l'objet R2 et la ligne `Fichier` « pret » sans aucune entité ni nettoyage, alors que le message dit « Rien n'a été ajouté ». Le dépôt s'interdit ailleurs explicitement les orphelins (`site-videos.ts:622,716`, `tutoriel-capture-auto.ts:416`). Aucun test ne couvre ce cas.
2. **À traiter avec (non bloquant seul)** :
   - la durée est celle **annoncée par le navigateur** ; le serveur ne la mesure pas. Le commentaire `ImporterVideo.tsx:20` (« le serveur borne ensuite la durée annoncée ») est exact mais la borne est contournable : à dire tel quel ou à mesurer côté serveur ;
   - `import-video-externe.ts:103` journalise `donnees.titre` brut au lieu de `controle.titre` (titre contrôlé) ;
   - les masquages d'interface (`videos/[id]/page.tsx:132,227`, `!estVideoImportee(v)`) et l'action `actions-import.ts` n'ont pas de test propre ; les refus serveur qu'ils doublent, eux, sont tous testés et tués par mutation.

Ce qui est bien prouvé : création prête/validée/marquée importée sans mention IA, une ligne « À publier » par réseau, aucun fournisseur appelé, pas d'essai (ni commande ni vidéo), refus de toute retouche/modification/réexport/fabrication sans version, travail ni dépense, bornes exactes incluses, fichier vérifié (destination, entité, origine, statut).

## Note

`pnpm-lock.yaml` d'axion-ia identique entre la branche verdict et `origin/main`.
