VERDICT OK sha=576aa769 (R2) — diff = 1 fichier test (tests/image-video/variete/apparition.test.ts, +12/-5, empreinte recalée) ; vitest 12/12 vert sur la branche ET sur master seul (91dc1521) ; tsc 43 erreurs identiques branche/master (0 neuve) ; 8 mutations : 5 tuées, 3 équivalentes prouvées

# Relecture R2 indépendante, FIX-ROUGES-APPARITION-v21t (studio-axion-ia-public)

- Tête vérifiée : `576aa769ef10f4b4a36ed75fd7a8516bbf709347` (attendue 576aa769 : conforme, tête inchangée).
- Base comparée : `origin/master` = `91dc152160b5fdb479c1fe832e7cd6074302a1a2`.
- Lecture seule : aucune modification du code du Studio n'a été poussée ; chaque mutation a été remise (`git status` propre à la fin).

## 1. Le diff

`git diff --stat origin/master...origin/video/FIX-ROUGES-APPARITION-v21t` :

```
tests/image-video/variete/apparition.test.ts | 17 ++++++++++++-----
1 file changed, 12 insertions(+), 5 deletions(-)
```

- Petit et cohérent avec le nom de la branche : seule la constante `EMPREINTE_TOILE_REFERENCE` (09542bc8… → ff1dbf99…),
  son commentaire (historique justifiant le recalage) et le nom du test (« celui de master au 27/11 (ff1dbf99…) ») changent.
- Aucun fichier sous `.github/**`, `deploiement/**`, `outils/gardes/**`, `scripts/echecs-connus.json` ; aucun secret.
- Aucun code de production touché : le diff ne peut pas introduire de régression fonctionnelle.
- Le nouveau nom de test dit honnêtement sa promesse (référence = HTML de master au 27/11), plus « identique à avant
  le lot », qui n'était plus vérifiable. L'invariant de fond reste porté par le second test : APP-A + MAT-A rend le
  MÊME HTML que sans variété.

## 2. Tests et types

- Dépendances : `pnpm install --frozen-lockfile` (magasin local, le magasin partagé est en lecture seule) + `npm ci` dans `studio-rendu/`.
- `npx vitest run tests/image-video/variete/apparition.test.ts` sur la branche : **12 passed (12)**.
- Même fichier de test copié sur un arbre de travail `origin/master` seul : **12 passed (12)**, donc ff1dbf99… est bien
  l'empreinte de master (ce que dit le commentaire), et elle est reproductible (deux arbres, deux exécutions).
- `npx tsc --noEmit -p .` (avec `--max-old-space-size=8192`, sinon le processus manque de mémoire) : 43 erreurs sur la branche et 43 sur master, **liste
  identique** (`diff` vide), donc aucune erreur neuve. Les 43 sont préexistantes et liées à l'environnement (`remotion` absent des
  prototypes `docs/`, types `RouteContext`/`LayoutProps` générés par `next typegen`, quelques tests).
- Non vérifié : l'affirmation du commentaire selon laquelle 09542bc8… n'est pas retrouvée sur 55d99567 (il faudrait
  réinstaller les dépendances de cette version). Sans incidence sur le verdict : l'ancienne valeur échoue sur master.

## 3. Mutations (chacune lancée sur le fichier de test, puis remise)

| #   | Mutation                                                             | Fichier                                                      | Résultat                                                                                                         |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| M1  | borne `NOEUDS_MIN = 3` → `2`                                         | `src/moteurs/montage-image-video/variete/axes/apparition.ts` | **tuée** (1 rouge : « possibles … (≥ 3 nœuds) »)                                                                 |
| M2  | condition inversée `!vus.includes(n)` → `vus.includes(n)` (fantômes) | idem                                                         | **tuée** (2 rouges, APP-C)                                                                                       |
| M6  | rayon de la carte de référence `main ? 10 : 34` → `35`               | `studio-rendu/compositions/image-video/Noeud.tsx:114`        | **tuée** (les 2 tests d'empreinte rougissent : l'empreinte recalée détecte bien une dérive du HTML de référence) |
| M7  | garde inversée `absent && !eteinte` → `absent && eteinte`            | `Noeud.tsx:26`                                               | **tuée** (4 rouges : 2 empreintes, APP-C, APP-B)                                                                 |
| M8  | repli inversé `if (!toiles)` → `if (toiles)`                         | `apparition.ts` (axe)                                        | **tuée** (6 rouges : invariants APP-B/C/D, APP-C)                                                                |
| M3  | `borderRadius: 40` → `41` (ombre APP-D)                              | `Noeud.tsx:80`                                               | survit : cosmétique de l'ombre APP-D, hors référence ; aucun test n'en fait la promesse (pas un trou de ce diff) |
| M4  | garde `app?.code === "APP-C"` supprimée dans `eteinte`               | `Noeud.tsx:25`                                               | survit : **équivalente**, `fantome` n'est vrai que pour APP-C (`Toile.tsx:98`)                                   |
| M5  | garde `if (code === "APP-A") return etape;` supprimée                | `apparition.ts` (axe)                                        | survit : **équivalente**, `apparitionDe` rend `null` pour APP-A (`variete/apparition/apparition.ts:50`)          |

Les 5 mutations non équivalentes qui touchent le comportement promis sont toutes tuées, y compris sur le chemin de
référence que ce diff recale (M6, M7). Les 3 survivantes sont équivalentes ou hors promesse.

## Conclusion

OK. Le recalage est voulu et documenté. La valeur est reproductible et identique sur master. Le test reste
discriminant : toute dérive du HTML de référence le fait rougir (M6, M7).
