VERDICT A CORRIGER sha=0190ec07 (R1) : src/services/fabrication.ts:1070-1073 garde « vidéo importée » d'estimerRetoucheVideo écrite DEUX fois (supprimer le doublon) et non testée (mutation M2 survit) → ajouter un test nommé « estimerRetoucheVideo refuse une vidéo importée (RETOUCHE_INDISPONIBLE) » ; src/services/modifications.ts:160 garde d'exemplesModification non testée (M7 survit) → asserter note === IMPORTEE_PAS_REFABRICABLE

Tête vérifiée : 0190ec0711ff7eb9a2ac9baa6a576f757dcf5222 (origin/video/IMPORT-VIDEO-EXTERNE-v21v), comparée à origin/master. Aucune fiche fournie : diff jugé seul.

## Périmètre du diff (13 fichiers, +592 −7) : conforme
- src/domaine/import-video-externe.ts (règles pures), src/services/import-video-externe.ts (création), action serveur
  src/app/(studio)/a-publier/actions-import.ts, composant src/components/publication/ImporterVideo.tsx, bouton sur « À publier »,
  gardes de non-refabrication (fabrication.ts, modifications.ts), commandeEnEssai / videoEnEssai, type Video.origineVideo,
  tests/import-video-externe.test.ts.
- Rien sous .github/**, deploiement/**, outils/gardes/**, scripts/echecs-connus.json ; aucun secret. Taille cohérente avec le nom.

## Contrôles lancés
- `npx vitest run tests/import-video-externe.test.ts` : 25/25 verts.
- Suites existantes qui importent les modules touchés (fabrication, publications, modifications, @/moteurs, moteurs/ids,
  a-publier) : 246 fichiers, 3 206 tests. 29 échecs dans 18 fichiers, rejoués en série : **ensemble IDENTIQUE sur
  origin/master** (même 29 tests, mêmes noms ; cause Zernio non relié / inventaire des interrupteurs, sans lien avec la branche).
  Aucune régression.
- `npx tsc --noEmit -p .` : 154 erreurs sur la branche, 154 sur master, **diff vide** (erreurs d'environnement : `remotion`
  absent, `RouteContext`/`LayoutProps` sans `next typegen`). Aucune erreur neuve.
- `npx eslint` sur les 13 fichiers touchés : propre.

## Mutations (tests/import-video-externe.test.ts seul)
Tuées : M1 garde lancerSousVerrou · M3 estimerReexport → 0 · M4 retoucheSousVerrou · M5 reexportSousVerrou · M6 case cochée
avant lecture du fichier · M8 proposerModification · M9 videoEnEssai(origine) · M10 commandeEnEssai(import-externe) ·
M11 borne 600 s · M12 MIME vide toléré · M13 ligne de journal · M14 origineVideo · M15 mention IA non incrustée.
**Survivent :**
- **M2** — neutraliser les DEUX gardes de `estimerRetoucheVideo` (fabrication.ts:1071 et 1073) : tout reste vert.
  La fonction n'est appelée par aucun test de la branche. Pour une vidéo importée, sans garde, l'estimation tomberait sur le
  moteur de repli (simulation) et afficherait un prix pour une retouche que le lancement refuse ensuite.
- **M7** — neutraliser la garde d'`exemplesModification` (modifications.ts:160) : vert, car le test n'asserte que
  `exemples: []` (que `retouchable` rend déjà) et jamais la `note` IMPORTEE_PAS_REFABRICABLE, qui est la promesse ajoutée.

## À corriger (bloquant)
1. src/services/fabrication.ts:1070-1073 — commentaire + `if (estVideoImportee(video)) throw …` copiés deux fois. Garder un seul.
2. Ajouter dans tests/import-video-externe.test.ts un test NOMMÉ pour `estimerRetoucheVideo(videoId, [])` sur une vidéo
   importée → rejet `RETOUCHE_INDISPONIBLE`, aucun fournisseur demandé (le placer AVANT le `if (!planIds.length)` est bien la
   promesse : le tester aussi avec `planIds` vide).
3. Dans le test « retouche, modification, nouveau format et fabrication refusés… », asserter
   `toMatchObject({ exemples: [], note: IMPORTEE_PAS_REFABRICABLE })`.

## Remarques non bloquantes (à arbitrer)
- La durée (`dureeSec`) et la taille d'image viennent du navigateur ; le serveur borne la valeur ANNONCÉE sans la vérifier
  (le commentaire de ImporterVideo.tsx le dit). Acceptable pour un studio mono-utilisateur, à écrire comme limite connue.
- Le fichier part au stockage AVANT les contrôles de format, poids et durée : un refus laisse un fichier orphelin, et un
  fichier de plus de 1 Go est envoyé en entier avant d'être refusé. Un pré-contrôle côté navigateur (extension, `file.size`)
  éviterait l'envoi inutile.
- Pas d'idempotence sur `fichierId` : deux appels avec le même fichier créent deux vidéos qui partagent la même Sortie/fichier
  (le bouton désactivé pendant l'envoi protège seulement le double clic).
- src/services/fabrication.ts:7 : l'import ajouté est placé AVANT `import "server-only"` ; le mettre après, comme dans
  modifications.ts.
- Le masquage de « Demander une modification » sur la fiche (src/app/(studio)/videos/[id]/page.tsx:132 et 227) n'a pas de
  test de rendu ; la garde serveur (M8 tuée) couvre l'essentiel.
- Vérifié sans défaut : `appliquerSons`/`appliquerSousTitres` refusent (le moteur de repli simulation n'a pas `recalquer`) ;
  le chat de retouche n'a pas de porte pour le format `video-importee` (routeDuFormat → « aucune ») ; `lancerVideoDeVersion`
  et `confirmerFabricationComplete` passent par `lancerFabrication`, gardée (M1 tuée).
