VERDICT A CORRIGER sha=6454f79c (AUDIT) : tests/segments-rendu/version-compositions.json:484,501 (+ commun-lot2/3/4) empreintes périmées → régénérer par `ECRIRE_EMPREINTES=1 npx vitest run tests/segments-rendu/version-compositions.test.ts` ; retirer l'empilement sur video/FIX-ECLATER-COMPOSITIONS-RESTANTES-v21s (non fusionnée) ; briques-v4.tsx:129 `poids = 900` → 800 et mesures Montserrat (briques-v4.tsx:130/132, commun-lot1.tsx:57, commun-lot4.tsx:486-487) à aligner sur Manrope ; journal/POLICES-P7-f-v20l.md absent

# Audit POLICES-P7-f-v20l (argent, sécurité, données) — tête 6454f79c630f07661b7657f840015d0747abb441

Tête vérifiée : `6454f79c` (pas de « TÊTE CHANGÉE »). Master au moment de l'audit : `65dcd08f` (26/11 18:33).
Audit en lecture seule, dans un clone jetable ; aucun fichier du Studio modifié ni poussé (mutations annulées par `git checkout -- .`).

⚠️ La fiche fournie à l'auditeur est **tronquée** (la consigne s'arrête à « NE PAS TOUCHER `studio-rendu/compositions/commune/polices.ts` (s »). La liste exacte des fichiers autorisés et le texte de la « seconde lecture du pilote » n'ont donc pas pu être lus : ce qui en dépend est marqué NON PROUVÉ.

## Argent, sécurité, données

- **Chemins payants** : aucun. Le diff ne touche aucun fichier d'argent ni de plafond (`depense-claude-video.ts`, `generation-claude.ts`, `credits.ts`, `budget-mensuel.ts`, `tarifs.ts`), n'ajoute aucun appel à Claude ni à un fournisseur, et aucun appel réseau. Rien à plafonner.
- **Données de personnes** : aucune suppression, aucune exposition. Pas de nouvelle donnée personnelle. Le prénom « Williams » de `PanneauFin.tsx` existait déjà.
- **Secrets** : aucun dans le diff.
- **Polices** : aucune police ajoutée ni téléchargée, aucun fichier de police supprimé. `lot2/polices/Montserrat-Black.ttf` et `lot4/polices/…` restent sur le disque, mais ne sont plus importés.
- **Gardes de test** : `controle-piece-neuve.test.ts` inverse deux attentes (Montserrat → Manrope). Le changement est annoncé comme « seconde lecture du pilote », mais la fiche est tronquée : **NON PROUVÉ**. La nouvelle attente est au moins aussi stricte : M2 et M3 la font rougir. `scripts/echecs-connus.json` est intact.

## Défauts bloquants

1. **Couloir VC rouge (échec NEUF).** `tests/segments-rendu/version-compositions.test.ts` « les empreintes du JSON correspondent aux fichiers actuels » passe sur master et échoue sur la branche. Il y a cinq empreintes périmées : `motion-v4/communs/briques-v4.tsx`, `lot1/commun-lot1.tsx`, `lot2/commun-lot2.tsx`, `lot3/commun-lot3.tsx` et `lot4/commun-lot4.tsx`.
   - Exemple : `briques-v4.tsx` est enregistré `c13d9516…`, alors que le fichier committé (fin de ligne normalisée) vaut `0211af71…`.
   - Ce sont exactement les cinq fichiers qui importent `commune/police-marque` : le JSON a été régénéré avant l'ajout de ces lignes.
   - Correctif : `ECRIRE_EMPREINTES=1 npx vitest run tests/segments-rendu/version-compositions.test.ts`, puis committer le JSON.
2. **Empilement interdit.** Le commit `e7913443` le dit lui-même : « Empilée sur video/FIX-ECLATER-COMPOSITIONS-RESTANTES-v21s ». Le commit `ed2590ed` de cette branche n'est pas dans `origin/master`.
   - Le diff contre master contient donc 25 JSON de cliquet `tests/charte/compositions-restantes/**`, le renommage de `compositions-restantes-origine-6d1ce305.json`, `polices-restantes/*.json` et +123 lignes dans `tests/charte/garde-charte.test.ts`. Tout cela relève de la fiche FIX-ECLATER, pas de P7-f.
   - Règle de la vague l : « aucun empilement ». Correctif : attendre la fusion de FIX-ECLATER, puis rebaser sur master, ou repartir de master avec les seuls fichiers P7-f.
3. **Graisse 900 restante et mesures qui ne suivent pas la police dessinée.**
   - `studio-rendu/compositions/interface-claire/motion-v4/communs/briques-v4.tsx:129` : `largeurTexte(…, poids = 900)` mesure au canvas avec `900 Npx "Axion Manrope"`. C'est une graisse hors de l'axe 200-800 ; la fiche impose 900 → 800. Le commentaire l. 128 dit encore « Montserrat 900 ».
   - `briques-v4.tsx:130/132` : repli `0.78 em` par lettre (ratio Montserrat Black).
   - `lot1/commun-lot1.tsx:57` : `largeurTexte = longueur × corps × (0.78 + interlettrage)`, utilisé par RangeePastilles, MotSaute et le groupage des sous-titres.
   - `lot4/commun-lot4.tsx:486-487` : `largeurEtiquette` « Montserrat Black ≈ 0,80 em ».
   - La méthode commune P7 exige que « les mesures de mise en page suivent la police dessinée » (tables Manrope de `src/briques/sous-titres/metriques.ts`). Si la garde lot-i interdit l'import depuis `src/`, il faut recopier les ratios Manrope ExtraBold avec un test d'égalité, ou écrire `HORS PERIMETRE` au journal. Laisser des mesures Montserrat sous une police Manrope n'est pas acceptable.
4. **Journal absent.** `journal/POLICES-P7-f-v20l.md` n'existe ni sur la branche ni dans l'historique. Il faut donc ajouter la ligne « DEFAUT VU », l'annonce RECOUVERT au canal avant fusion (fichiers `studio-rendu/**`) et la trace de la seconde lecture.

## Tests lancés (à froid, clone neuf, `pnpm install --frozen-lockfile`)

- **Vitest** : 66 fichiers, soit tous les tests qui citent motion-v4, `POLICE_V4`, `chargerMontserratBlack`, `chargerPolicesV4`, `police-marque`, `empreintes-rendus` et `version-compositions`, plus `tests/polices`, `tests/charte` et `tests/segments-rendu`.
  - Branche : 14 échecs sur 586. Master : 14 échecs sur 578.
  - Échecs hérités, les mêmes sur master : `tests/facecam-animee/*` (paquet `remotion` absent : rangee-pastilles, sous-titres-fenetre-double, son-v4, palette-v7-09b), `retouche-chat/v4-inchange` « mémo planScenes », `charte/jetons-charte`, `garde-charte` (src/moteurs, src/briques/motion, compositions : « plus » ImageComposee, MacroInterface, PlancheEtiquettes, PlancheTraits, petits-objets/polices.ts).
  - **Neuf** : `version-compositions` (défaut 1). `audit-d-production` « ROUGE — studio-rendu-* » a échoué une fois dans le lot complet sur la branche : bac à sable `/tmp`, probablement hors sujet, NON PROUVÉ.
  - **Réparé par la branche** : `controle-piece-neuve` « test d'égalité v4 » et `garde-charte` src/briques/habillage.
- `tests/polices/p7-v4.test.ts` (neuf) : 5 sur 5 verts.
- **tsc** `--noEmit -p .` : 153 erreurs sur la branche contre 154 sur master. Erreurs normalisées sans position : **0 neuve**.
- **ESLint** (fichiers .ts/.tsx touchés) : 2 erreurs, 17 avertissements. Les mêmes 2 erreurs existent sur master : `react-hooks/immutability` dans briques-v4.tsx:314 et MotDerriere.tsx:39. Rien de neuf.
- `node outils/gardes/regles-de-fer.mjs` : 0 défaut (la règle nom-fondateur n'est pas vérifiée : liste de mots non fournie).

## Mutations de l'auditeur

| #   | Mutation                                                                            | Attendu | Résultat                                                      |
| --- | ----------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------- |
| M1  | `PanneauFin.tsx` : une `fontWeight: 800` → `900`                                    | rouge   | ROUGE : p7-v4 (b)                                             |
| M2  | `lot4/commun-lot4.tsx` : `MONTSERRAT = "Axion Montserrat Black"`                    | rouge   | ROUGE : p7-v4 (a), (d) et controle-piece-neuve « égalité v4 » |
| M3  | `controle-piece-neuve.ts` : `POLICE_V4 = "Montserrat"`                              | rouge   | ROUGE : « constantes » et « égalité v4 »                      |
| M4  | `PanneauFin.tsx` : `const poidsTitre = 900` puis `fontWeight: poidsTitre`           | rouge   | **VERT : trou**                                               |
| M5  | `briques-v4.tsx` `styleMontserrat` : `fontSynthesis: "weight"` (faux gras interdit) | rouge   | **VERT : trou**                                               |

Les trois mutations demandées rougissent. M4 et M5 montrent que la garde (b) ne lit que les littéraux `fontWeight: 900`. Elle laisse passer une graisse 900 portée par une variable ou un paramètre, ce qui est précisément le cas réel de `briques-v4.tsx:129`. Elle ne refuse pas non plus `fontSynthesis` / `font-synthesis`. À durcir dans `tests/polices/p7-v4.test.ts` : interdire tout littéral `900` associé à poids, weight ou font, et tout `fontSynthesis`.

## Points vérifiés et conformes

- Chargeurs : briques-v4 et les lots 1 à 4 passent tous par `commune/police-marque.ts` (`chargerPoliceMarque` / `policeMarquePrete`). Plus aucun `new FontFace` ni import `.ttf`/`.woff2` sous motion-v4 hors lot6. Le lot 2 garde son `delayRender`, puisque le chargeur unique le fait lui-même.
- Familles écrites en clair = `FAMILLE_CSS` (`"Axion Manrope"`) et `PILE_CSS` de `src/briques/charte/axion-2026.ts` : vérifié par p7-v4 (e).
- Toutes les `fontWeight: 900` littérales sont passées à 800. Aucune graisse littérale hors de 500-800 n'a été trouvée.
- Aucune zone interdite touchée, hormis `briques-v4.tsx`, qui est l'exception écrite. Aucun fichier d'argent, de calendrier, de Zernio, de carrousel ni du mode sans voix.
- `src/briques/habillage/controle-piece-neuve.ts` : NON PROUVÉ qu'il figure dans la liste autorisée (fiche tronquée).
