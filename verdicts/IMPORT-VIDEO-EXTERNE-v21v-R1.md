VERDICT A CORRIGER sha=e112fded (R1) : src/services/import-video-externe.ts:77 — `moteurId: "import-externe"` n'est pas un moteur inscrit, `idMoteurDeCommande` retombe sur « simulation » : la vidéo importée est classée ESSAI et `a-publier-zernio.ts:132` / `publications.ts:776` refusent de la publier (« C'est une vidéo d'essai ») ; faire reconnaître `origineVideo: "importee"` comme non-essai (ou inscrire un moteur dédié) + test nommé « la vidéo importée n'est pas un essai et peut partir » ; et ajouter les tests manquants TITRE, RESEAUX, TAILLE vide, `importerVideoExterne` (4 mutants survivent).

# Relecture R1 : IMPORT-VIDEO-EXTERNE-v21v

- Dépôt relu : `will383842/studio-axion-ia-public`, branche `video/IMPORT-VIDEO-EXTERNE-v21v`.
- Tête vérifiée : `e112fdedf35ce1bbe438a633ccd6a86b498d84d1` (pas de « TÊTE CHANGÉE »). Base de fusion = `origin/master` `85d71124`.
- Aucune fiche fournie (dépôt des plans privé) : le diff est jugé seul.

## 1. Périmètre du diff : conforme

7 fichiers, +376 lignes, aucune suppression :

| Fichier                                        | Rôle                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| `src/domaine/import-video-externe.ts`          | règles pures (format, taille, durée, titre, réseaux, case cochée)          |
| `src/services/import-video-externe.ts`         | création vidéo + version + sortie ; action avec session et `fichierEnvoye` |
| `src/app/(studio)/a-publier/actions-import.ts` | action serveur (`exigerSession`, `essayer`, `revalidatePath`)              |
| `src/components/publication/ImporterVideo.tsx` | bouton et formulaire client                                                |
| `src/app/(studio)/a-publier/page.tsx`          | +2 lignes : branchement du bouton                                          |
| `src/domaine/types.ts`                         | +2 lignes : `origineVideo?: "importee"` (facultatif, additif)              |
| `tests/import-video-externe.test.ts`           | 7 tests                                                                    |

Rien dans `.github/**`, `deploiement/**`, `outils/gardes/**`, `scripts/echecs-connus.json`. Aucun secret. Pas de changement de `pnpm-lock.yaml`. Le diff est petit et correspond au nom de la branche.

## 2. Ce qui a été lancé

- `pnpm install --frozen-lockfile` (magasin local) : OK.
- `npx vitest run tests/import-video-externe.test.ts` : **7/7 réussis**.
- `npx tsc --noEmit -p .` (avec `--max-old-space-size=8192`, sinon OOM) : **188 lignes d'erreurs sur la branche, 188 sur `origin/master`**. Le seul écart est l'ordre d'affichage des membres d'unions dans 5 messages (`"neutre" | "vert"` ↔ `"vert" | "neutre"`) : **aucune erreur neuve**. Les erreurs préexistantes viennent de `remotion` absent et de `RouteContext`/`LayoutProps` (types générés par Next).
- Tests existants qui touchent « À publier » / `listerAPublier` (30 fichiers, 371 tests) : 370 réussis, 1 échec `tests/usine/inventaire/publication-et-mesures.test.ts` (recensement `lireParametre`), **qui échoue aussi sur `origin/master`** : préexistant, pas imputable à la branche.

## 3. 🔴 Bloquant : la vidéo importée est classée « essai » et ne peut pas être publiée

`creerVideoImportee` fige dans la version une commande avec `moteurId: "import-externe"` et `formatId: "video-importee"` (`src/services/import-video-externe.ts:77`). Aucun des deux n'existe :

- `idMoteurDeCommande` (`src/moteurs/ids.ts:16-19`) : moteur inconnu, puis format inconnu, donc **`"simulation"`** ;
- `commandeEnEssai` renvoie donc `true`, et `videoEnEssai` (`src/services/publications.ts:250`) aussi.

Sonde jetable lancée dans le clone (non poussée) sur une vidéo créée par `creerVideoImportee` :

```
moteur effectif = simulation essai = true videoEnEssai = true
kit = ok publiable=false
```

Conséquences dans le code de master :

- `src/services/a-publier-zernio.ts:132` : `throw new ErreurStudio("VIDEO_ESSAI", "C'est une vidéo d'essai : elle ne part pas sur vos réseaux.")` ;
- `src/services/publications.ts:776` : même refus pour un envoi réel ;
- `src/services/publications.ts:517` : la fiche affiche `videoEssai: true` ;
- `src/services/publications.ts:294` : l'écriture automatique des textes est coupée.

La fonctionnalité promet « ajouter à À publier » une vidéo **prête à partir**. Elle apparaît bien dans la liste (test `la vidéo importée apparaît dans listerAPublier`), mais elle ne peut pas partir. Aucun test ne va jusqu'à l'envoi, donc rien ne le voit.

**À faire** : qu'une version d'origine importée ne soit pas un essai. Par exemple, `videoEnEssai` / `commandeEnEssai` rendent `false` quand `origineVideo === "importee"`, ou un moteur `import-externe` est inscrit (sans fabrication, `recalquer` absent). Ajouter un test nommé, par exemple « la vidéo importée n'est pas un essai et l'envoi ne la refuse pas pour VIDEO_ESSAI », qui appelle `videoEnEssai` et le chemin d'envoi en simulation.

À vérifier dans la même correction : la fiche `/videos/[id]` d'une vidéo importée. `trouverFormat("video-importee")` est `undefined` (la page le tolère) ; `estimerReexport` est appelé pour chaque ratio « manquant » (ici aucun, car `ratiosFormat` = `v.ratios`) ; `exemplesModification` propose des retouches qui supposent un moteur. Le plus sûr est un test qui rend les services de la page pour une vidéo importée.

## 4. 🟠 Promesses sans test nommé (mutations survivantes)

Mutations appliquées une à une dans le clone, puis `tests/import-video-externe.test.ts` relancé :

| Mutation                                       | Résultat           |
| ---------------------------------------------- | ------------------ |
| M1 : retirer le refus `NON_VALIDEE` (domaine)  | **tuée** (1 échec) |
| M2 : retirer le refus `TITRE` (titre vide)     | **SURVIT** (7/7)   |
| M3 : retirer le filtre des réseaux inconnus    | **SURVIT** (7/7)   |
| M4 : retirer le refus `RESEAUX` (aucun réseau) | **SURVIT** (7/7)   |
| M5 : ignorer le type MIME                      | tuée               |
| M6 : ratio toujours 16:9                       | tuée               |
| M7 : retirer le refus `TAILLE` (fichier vide)  | **SURVIT** (7/7)   |

Non couverts non plus :

- `importerVideoExterne` (le chemin réellement appelé par l'action) : session exigée, refus `NON_VALIDEE` **avant** de lire le fichier, refus `FICHIER_INCONNU` si le fichier a été envoyé sous un autre `entiteId` ou une autre destination que `video`, journal écrit. Seul le cœur `creerVideoImportee` est testé.
- `ratioDeLaTaille` : seul 1080×1920 donc 9:16 est exercé (pas de 16:9, 1:1, 4:5, ni de taille illisible donc 9:16).
- Titre tronqué à 120 caractères, dédoublonnage des réseaux.

**À faire** : un test nommé par promesse : « refuse un titre vide », « ignore un réseau inconnu et refuse s'il n'en reste aucun », « refuse un fichier vide », « importerVideoExterne refuse un fichier envoyé pour une autre vidéo », « sans case cochée, le fichier n'est même pas lu », « ratio déduit de la taille ».

## 5. 🟡 Remarques non bloquantes

- `ImporterVideo.tsx:53-56` : le fichier est **entièrement envoyé** (jusqu'à 4 Go acceptés par `/api/depots`) **avant** tout contrôle de format, de taille (1 Go) ou de durée. Un `.avi`, une vidéo de 2 Go ou une durée illisible (`dureeSec: 0` quand la lecture des métadonnées échoue) partent dans le stockage puis sont refusés, et le fichier reste orphelin. `controlerImportVideo` est pur : l'appeler côté client avant `envoyerFichier` coûte une ligne (le serveur reste décisif).
- La durée vient du navigateur, sans vérification côté serveur. Acceptable si c'est assumé, mais le commentaire « le serveur borne ensuite la durée annoncée » ne doit pas laisser croire à une vérification.
- `marqueId: "marque-axion"` est écrit en dur dans `creerVideoImportee`.
- `exigerSession` est appelée deux fois (action, puis service) : sans effet.

## Conclusion

Le diff est propre et bien délimité, sans régression de types ni de tests existants. Mais la promesse centrale (une vidéo importée « prête à partir » depuis « À publier ») est cassée par le repli du moteur sur la simulation, et quatre règles du domaine n'ont aucun test qui les prouve. **À CORRIGER.**
