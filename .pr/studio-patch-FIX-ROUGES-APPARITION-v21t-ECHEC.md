Aucun correctif produit pour FIX-ROUGES-APPARITION-v21t (PR #1748, commit 640f9f22) : rien de rouge à réparer.
CI du commit 640f9f22 : 7 checks sur 8 verts ; « eslint et tsc différentiels » encore `in_progress` après ~2 min de relevé, sans conclusion lisible. PR `mergeable: true`.
Fusion d'essai avec origin/master (88a2dc52, plus récent que la branche) : sans conflit ; aucun fichier modifié, donc patch vide, pas de commit factice.
Impossible de rejouer tsc/eslint/vitest : `pnpm install --frozen-lockfile` dans /tmp/studio échoue en EROFS (magasin pnpm en lecture seule). À relancer quand le check eslint/tsc conclut ; s'il est rouge, relancer la tâche.
