VERDICT A CORRIGER sha=417eb1a7 (R2) : src/moteurs/index.ts:84 + src/services/fabrication.ts:1124 (lancerRetouche) — une vidéo importée (moteurId "import-externe") est retouchable via le moteur de SIMULATION mais déclarée « pas un essai » : refuser retouche et réexport quand origineVideo === "importee" (ou commande.moteurId === MOTEUR_IMPORT_EXTERNE), masquer « Demander une modification » sur sa page, et tester ; plus ajouter les tests de bornes exactes (3 s, 600 s, 1 Go) que 3 mutations ont traversés.

# Relecture R2 indépendante — video/IMPORT-VIDEO-EXTERNE-v21v

- Dépôt : will383842/studio-axion-ia-public, branche `video/IMPORT-VIDEO-EXTERNE-v21v`.
- Tête vérifiée : `417eb1a7a82cb41502d24e41dd6e5006635d4d00` (conforme, tête inchangée).
- Aucune fiche fournie (dépôt des plans privé) : le diff est jugé seul.

## 1. Périmètre du diff

`git diff --stat origin/master...origin/video/IMPORT-VIDEO-EXTERNE-v21v` : 10 fichiers, +511 / −4.

```
src/app/(studio)/a-publier/actions-import.ts |  16 ++
src/app/(studio)/a-publier/page.tsx          |   2 +
src/components/publication/ImporterVideo.tsx |  93 +++
src/domaine/import-video-externe.ts          |  62 ++
src/domaine/types.ts                         |   2 +
src/moteurs/ids.ts                           |   3 +
src/moteurs/index.ts                         |   4 +-
src/services/import-video-externe.ts         | 105 +++
src/services/publications.ts                 |   4 +-
tests/import-video-externe.test.ts           | 224 +++
```

- Petit, cohérent avec le nom de la branche. ✅
- Ne touche ni `.github/**`, ni `deploiement/**`, ni `outils/gardes/**`, ni `scripts/echecs-connus.json`. ✅
- Aucun secret (le hash argon2 du test est calculé à la volée depuis un mot de passe de test). ✅

## 2. Contrôles lancés

| Contrôle | Résultat |
| --- | --- |
| `pnpm install --frozen-lockfile` | OK |
| `npx vitest run tests/import-video-externe.test.ts` | **20/20 verts** |
| `npx tsc --noEmit -p .` (branche vs `origin/master`, `--max-old-space-size=8192`) | 154 erreurs des deux côtés, **même liste** (deux lignes ne diffèrent que par l'ordre des unions). **Aucune erreur neuve**, aucune dans un fichier touché ✅ |
| `npx eslint` sur les 8 fichiers touchés | 0 erreur ✅ |

## 3. Mutations (code remis à `417eb1a7` après chaque mutation, `git status` propre, rien de poussé)

| # | Mutation | Résultat |
| --- | --- | --- |
| M1 | `commandeEnEssai` : retirer `commande.moteurId !== MOTEUR_IMPORT_EXTERNE` | 🔴 1 rouge ✅ |
| M2 | `videoEnEssai` : retirer `video.origineVideo === "importee" \|\|` | 🔴 1 rouge ✅ |
| M3 | service : garde `valide !== true` désactivée | 🔴 1 rouge ✅ |
| M4 | service : `fichierEnvoye` sans `entiteId` | 🔴 1 rouge ✅ |
| M5 | domaine : `dureeSec > DUREE_MAX` → `>=` (600 s refusé) | 🟢 **20/20 : TROU** |
| M6 | domaine : `dureeSec < DUREE_MIN` → `<=` (3 s refusé) | 🟢 **20/20 : TROU** |
| M7 | domaine : `taille > TAILLE_MAX` → `>=` (1 Go pile refusé) | 🟢 **20/20 : TROU** |
| M8 | domaine : MIME vide plus toléré | 🔴 1 rouge ✅ |
| M9 | domaine : garde « case cochée » neutralisée | 🔴 1 rouge ✅ |
| M10 | domaine : titre non coupé à 120 | 🔴 1 rouge ✅ |
| M11 | service : `journaliser` supprimé | 🔴 1 rouge ✅ |
| M12 | service : `exigerSession()` retiré de `importerVideoExterne` | 🟢 20/20 — mutation **équivalente** pour la promesse testée (`fichierEnvoye` exige aussi la session) ; seul effet : sans session, `valide:false` répond `NON_VALIDEE` au lieu de rediriger. Pas bloquant. |
| M13 | `mentionIA.incrustee: true` | 🔴 1 rouge ✅ |
| M14 | `etapeEditoriale: "a_relire"` | 🔴 2 rouges ✅ |

**Trois trous (M5, M6, M7)** : la doc du domaine promet « de 3 secondes à 10 minutes, 1 Go au plus » (bornes incluses), mais les tests n'essaient que `1`, `MAX+1` et `TAILLE_MAX+1`. Une borne décalée d'un cran passe au vert.

## 4. Défaut bloquant : la vidéo importée passe dans le moteur de simulation sans être « essai »

`commandeEnEssai` (src/moteurs/index.ts:84) — décrit comme « CE test qui décide partout : refus, prix, pastilles,
notification, envoi à Buffer » — est désormais `false` pour `moteurId: "import-externe"`. Mais
`idMoteurDeCommande` (src/moteurs/ids.ts:20) ne connaît pas ce moteur et retombe sur `"simulation"`, donc
`moteurDeCommande()` rend le **moteur de simulation** (`retoucheParPlan: true`, src/moteurs/simulation.ts:226).

Preuve (sonde vitest temporaire, supprimée ensuite) sur une vidéo créée par `creerVideoImportee`, session ouverte :

```
lancerRetouche(videoId, [], "Demande : coupe")
→ RETOUCHE LANCEE { retoucheId, travailId }   (étapes « voix », « visage »… du moteur de simulation)
→ NOUVELLE VERSION moteurId= import-externe  essai= false  moteur reel= simulation
```

Conséquence : une retouche (bouton « Demander une modification », affiché sur la page vidéo car
`prete && !facecam`, src/app/(studio)/videos/[id]/page.tsx:226) fabrique une version de **démonstration** qui
remplace la vraie vidéo importée, et cette version est déclarée **non-essai** — donc éligible à l'envoi réel
(Buffer/Zernio), ce que le garde-fou `commandeEnEssai` existait précisément pour empêcher. En plus,
`proposerModification` appelle le fournisseur `script` (Claude, payant en réel) alors que la vidéo n'a aucun plan.
(`appliquerSousTitres` est en revanche bien refusé : « ne peut pas recevoir la correction sans être refaite ».)

**À faire :**
1. Refuser toute refabrication d'une vidéo importée : dans `retoucheSousVerrou` (src/services/fabrication.ts ~1124),
   `proposerModification` (src/services/modifications.ts ~249) et les réexports, `if (video.origineVideo === "importee")`
   → `ErreurStudio("RETOUCHE_INDISPONIBLE", …)` AVANT tout appel fournisseur ; ou, à la racine, faire que
   `moteurDeCommande` refuse `MOTEUR_IMPORT_EXTERNE` au lieu de retomber sur la simulation.
2. Masquer « Demander une modification » (et tout bouton de refabrication) sur la page d'une vidéo importée.
3. Test : « une vidéo importée ne peut pas être retouchée et aucun fournisseur n'est appelé » (aucune nouvelle version,
   `sondes.fournisseurs` vide).
4. Tests de bornes exactes : 3 s acceptée, 600 s acceptée, `TAILLE_MAX_IMPORT_OCTETS` acceptée (et `MIN − ε`
   refusée), pour tuer M5/M6/M7.

## 5. Remarques non bloquantes

- `ImporterVideo.tsx` n'a aucun contrôle de taille/format côté navigateur : un fichier de 3 Go (sous le plafond de 4 Go
  de `/api/depots`) est entièrement envoyé avant d'être refusé « trop lourde », et reste orphelin dans le stockage.
  Un pré-contrôle client (mêmes constantes du domaine) éviterait l'envoi.
- La durée est celle annoncée par le navigateur (`dureeSec`) : le serveur la borne mais ne la vérifie pas.
- `lireMetadonnees` n'a pas de délai d'abandon : si ni `loadedmetadata` ni `error` ne se déclenche, le bouton reste
  « Envoi en cours… ».
- Le même `fichierId` peut être importé deux fois (deux vidéos sur le même fichier).
- Le composant client n'a pas de test (acceptable pour un formulaire, les décisions sont côté serveur et testées).

## 6. Promesses ↔ tests

Chaque comportement ajouté a un test au nom explicite (formats, bornes, case cochée, création « prête/validée/importée »,
présence dans `listerAPublier`, aucun fournisseur, pas un essai, session, fichier réellement arrivé, journal, ratio) —
**sauf** les bornes exactes (§3) et l'interdiction de refabriquer une vidéo importée (§4), qui n'existe pas.
