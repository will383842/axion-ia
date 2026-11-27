VERDICT A CORRIGER sha=0190ec07 (R2) : src/services/fabrication.ts:1070-1073 — garde « vidéo importée » d'estimerRetoucheVideo COPIÉE DEUX FOIS (supprimer les lignes 1072-1073) et non testée (retirer les deux laisse 25/25 vert) : ajouter un test `estimerRetoucheVideo(videoId, ["p1"])` → RETOUCHE_INDISPONIBLE ; et src/services/modifications.ts:160 non testée : le test doit exiger `note: IMPORTEE_PAS_REFABRICABLE`, pas seulement `exemples: []`.

# Relecture R2 indépendante — video/IMPORT-VIDEO-EXTERNE-v21v (3e passage, tête 0190ec07)

- Dépôt : will383842/studio-axion-ia-public, branche `video/IMPORT-VIDEO-EXTERNE-v21v`, tête vérifiée `0190ec0711ff7eb9a2ac9baa6a576f757dcf5222` (conforme, pas de « TÊTE CHANGÉE »).
- Les deux points des passages précédents (sha e112fded, 417eb1a7) sont traités : retouche, modification, réexport et fabrication sont refusés pour une vidéo importée, « Demander une modification » est masqué sur sa page, et les bornes exactes (3 s, 600 s, 1 Go) sont testées.

## Périmètre du diff (13 fichiers, +592 / −7)

Diff petit et cohérent avec le nom de la branche. Rien dans `.github/**`, `deploiement/**`, `outils/gardes/**`, `scripts/echecs-connus.json`, ni aucun secret.
Fichiers : `a-publier/actions-import.ts` (nouveau), `a-publier/page.tsx`, `videos/[id]/page.tsx`, `components/publication/ImporterVideo.tsx` (nouveau), `domaine/import-video-externe.ts` (nouveau), `domaine/types.ts`, `moteurs/ids.ts`, `moteurs/index.ts`, `services/fabrication.ts`, `services/import-video-externe.ts` (nouveau), `services/modifications.ts`, `services/publications.ts`, `tests/import-video-externe.test.ts` (nouveau).

## Vérifications lancées

- `npx vitest run tests/import-video-externe.test.ts` : **25/25 verts**.
- `npx tsc --noEmit -p .` (tas porté à 12 Go, sinon OOM) : 188 lignes d'erreurs sur la branche, **188 identiques sur master** (types Next générés absents, `remotion` non installé). **Aucune erreur neuve.**
- `npx eslint` sur les 12 fichiers touchés : aucune remarque.
- `vitest related` sur les sources touchées : run coupé à 25 min (suite très large), donc **couverture partielle**. Les 14 fichiers vus en échec ont été rejoués sur la branche ET sur master : **34 échecs / 332 réussis des deux côtés, liste des tests en échec identique** (Zernio non relié, etc.). Aucune régression observée sur ce qui a tourné.

## Mutations (13, faites dans une copie, jamais poussées)

Tuées (au moins un test rougit) :
- M1 `moteurs/index.ts:84` : retirer `commande.moteurId !== MOTEUR_IMPORT_EXTERNE &&` → 1 rouge.
- M2 `fabrication.ts:830` : retirer la garde FABRICATION_INDISPONIBLE → 1 rouge.
- M3 `domaine/import-video-externe.ts` : `taille > MAX` → `>=` → 1 rouge.
- M4 `fabrication.ts:1123` (retoucheSousVerrou) : retirer la garde → 1 rouge.
- M5 `publications.ts:251` : retirer `origineVideo === "importee" ||` → 1 rouge.
- M6 `services/import-video-externe.ts:100` : retirer le contrôle « case cochée avant lecture du fichier » → 1 rouge.
- H3 `fabrication.ts:1087` (estimerReexport) : retirer `|| estVideoImportee(video)` → 1 rouge.
- H4 `modifications.ts:260` (proposerModification) : retirer la garde → 1 rouge.
- H5 `fabrication.ts:1197` (reexport) : retirer la garde → 1 rouge.
- H6 domaine : `dureeSec < MIN` → `<=` → 1 rouge.
- H7 domaine : accepter tout type MIME → 2 rouges.

**Survivantes (trous) :**
- **H1** `fabrication.ts:1070-1073` (estimerRetoucheVideo) : retirer LES DEUX gardes identiques → **25/25 verts**. La garde est en plus **dupliquée** (commentaire + `if` copiés deux fois, l. 1070-1071 et 1072-1073). `estimerRetoucheVideo` est exposée par `C-videos-publication-complements.ts:58` et appelée par `modifications.ts:298` : sans garde, une vidéo importée obtiendrait un prix de retouche du moteur de repli.
- **H2** `modifications.ts:160` (exemplesModification) : retirer la garde → **25/25 verts**. Le test vérifie seulement `exemples: []`, que `retouchable()` renvoie aussi. La promesse (phrase `IMPORTEE_PAS_REFABRICABLE` en note) n'est pas testée.

## À corriger

1. `src/services/fabrication.ts:1072-1073` : supprimer le doublon (commentaire et `if`).
2. `tests/import-video-externe.test.ts`, bloc « ni retouchée ni refabriquée » : ajouter `await expect(estimerRetoucheVideo(videoId, ["p1"])).rejects.toMatchObject({ code: "RETOUCHE_INDISPONIBLE" })`, puis vérifier que H1 rougit.
3. Même bloc : `expect(await exemplesModification(videoId)).toMatchObject({ exemples: [], note: IMPORTEE_PAS_REFABRICABLE })`, puis vérifier que H2 rougit.

Mineur, ne bloque pas : `fabrication.ts:7`, l'import est placé avant `import "server-only"` (usage du fichier : `server-only` en tête).

Note de procédure : la branche `verdict/IMPORT-VIDEO-EXTERNE-v21v-R2` existait déjà (deux verdicts précédents). Ce verdict est un commit ajouté par-dessus (pas de force-push), plutôt qu'une branche recréée depuis origin/main.
