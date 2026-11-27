# Plan : une CI plus rapide qui bloque moins, sans PR fusionnable sans contrôle

Rédigé le 2026-11-27 (consigne de Williams). **Plan seulement** : `ci.yml` n'est pas modifié ici.
Fichier à transformer en 3 PR indépendantes (voir plus bas). Chaque PR s'ouvre en brouillon (règle CI-LOT1).

---

## 0. Ce qui commande tout le reste

1. **Le goulot est la file, pas la durée d'un run.** 24 jobs en cours, ~33 jobs en file, 21 PR qui attendent
   jusqu'à 50 min. Quand la file est pleine, une PR attend surtout que d'autres jobs libèrent une place. Le gain
   qui compte d'abord est donc le nombre de **minutes-machine par PR** (les places libérées pour les autres). La
   durée du chemin critique ne compte qu'ensuite.
   - Conséquence : ajouter des morceaux ou des tranches (plus de jobs, chacun avec son installation) raccourcit
     un run mais **allonge la file**. C'est écarté tant que la file est pleine.
   - À vérifier : le plafond de 40 jobs est celui du **compte** (axion-crm-pro, robots `claude-credit-api.yml`…),
     pas celui du dépôt. 24 jobs en cours avec 33 en file laisse penser que d'autres dépôts ou robots occupent
     le reste.
2. **Coût actuel d'une PR prête : ≈ 76 min-machine**, chemin critique ≈ 20 min (Gate B tranche 2 = 17 min).
   Répartition : Gate B 2 × 16-17 = 33 · couverture 10 + 12 + 11 = 33 (+ fusion ~2) · Gate A 7 · Gate D 1.
3. **Mesure faite pour ce plan** sur les 296 derniers commits de `main` (`git diff-tree` de chaque commit
   de premier parent) :
   - **0 sur 296** ne touche que `.pr/`, `_PLANS/`, `_SESSIONS/` ou `_SUIVI/` (chaque PR de code porte aussi
     son `.pr/<branche>.md`) ;
   - **5 sur 296 (1,7 %)** ne touchent que des `*.md` ;
   - **16 sur 296 (5,4 %)** touchent `prisma/`.
4. **Les 4 contextes exigés ne changent ni de nom ni de logique de verdict** dans aucune PR de ce plan :
   « Gate A · per-commit », « Gate A · couverture », « Gate B · per-PR », « Gate D · Prisma migrate deploy
   (DB fresh) ». Règle suivie partout : **un changement ne peut que rendre un contexte NON vert plus tôt, jamais
   le rendre vert sans ses contrôles.** Aucun `if:` de niveau job ne s'ajoute sur un verdict exigé.

---

## 1. Tableau des pistes

« min-m » = minutes-machine économisées par PR prête (moyenne). « Latence » = effet sur le chemin critique d'une
PR verte. Les chiffres marqués ≈ sont des estimations à confirmer par la mesure prévue dans la PR concernée.

| #   | Piste                                                                       | Gain min-m / PR                                                                     | Latence                                                     | Risque                                                                                                                                                                                                                                                                                           | Décision                                                                                                                                              |
| --- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Filtre « docs seules » (branche `ci/alleger-file-attente`)                  | **≈ 0** avec liste blanche stricte (0/296) ; ≈ 1 min avec `*.md` (5/296 × 66)       | 0                                                           | Élevé pour le gain : `docs/` est **lu par la suite** (`disque-vps-aucune-purge-dangereuse` parcourt `docs/` en entier ; `imprimes-internes`, `guide-demarrage`, `public-sans-certification-ni-opco`, `villes-lot3…` lisent des fichiers de `docs/`). Un faux « docs » = PR fusionnée sans tests. | **ÉCARTÉE.** Fermer la branche. Sa 2e partie (`needs: gate-a`) est remplacée par la piste 6 améliorée.                                                |
| 2   | Gate D seulement si `prisma/**` change                                      | ≤ 1                                                                                 | 0 (Gate D n'est pas sur le chemin critique)                 | Gate D ne fait pas que migrer : elle lance ~15 tests d'intégration sur du code de `src/` (devis, e-mails, partners-sync, vidéos, verrou-dossier…). Les sauter hors `prisma/` retire un vrai contrôle.                                                                                            | **ÉCARTÉE.** Gain nul, perte réelle.                                                                                                                  |
| 3a  | Gate B : un seul build, `.next` partagé entre tranches (artefact)           | ≈ 5 (−8 de build, +2 de job de build, +1 à 2 de transfert par tranche)              | **+4 à +5 min** (build puis tranches, en série)             | Moyen : `.next` pèse plusieurs Go (17 000 pages SSG) ; transfert non mesuré.                                                                                                                                                                                                                     | **ÉCARTÉE pour l'instant.** À revoir si on passe un jour à 3 tranches ou plus.                                                                        |
| 3b  | Gate B : cache du compilateur (`.next/cache/webpack` seulement)             | ≈ 4 à 8 (2 à 4 par tranche, **à mesurer**)                                          | ≈ −2 à −4                                                   | Faible : cache prévu par Next pour la CI. On exclut `fetch-cache` et `images` (aucune donnée servie depuis le cache). Le passage quotidien rebâtit à froid.                                                                                                                                      | **GARDÉE** (PR 2), après mesure de la part « compilation » du build.                                                                                  |
| 3c  | Gate B : « Libérer le disque » (109 s d'attente)                            | ≈ 2 à 3,6                                                                           | ≈ −1 à −1,8                                                 | Faible si l'attente reste **avant** `.next` et le build (ENOSPC de juin).                                                                                                                                                                                                                        | **GARDÉE** (PR 1) : déplacer l'attente après l'installation de Playwright. (PR 2) : la retirer si le `df` prouve la marge.                            |
| 4   | Gate A : caches ESLint, Prettier, tsc                                       | ≈ 4 à 5 (ESLint 182 → ~30 s, Prettier 134 → ~15 s, tsc 143 → ~70 s)                 | 0 aujourd'hui ; **rend la piste 6 bien plus efficace**      | Faible si la clé de cache contient le lockfile et les configs, si la stratégie est `content` (les dates changent à chaque checkout) et si le passage quotidien tourne **sans cache**.                                                                                                            | **GARDÉE** (PR 1). « Prettier sur les fichiers modifiés seulement » **écarté** : `--cache` donne le même gain sans angle mort quand la config change. |
| 5a  | Couverture : plus de morceaux (4-6)                                         | **négatif** (+1,5 à 2 min d'installation par morceau ajouté)                        | ≈ −2 à −4                                                   | Faible, mais charge la file.                                                                                                                                                                                                                                                                     | **ÉCARTÉE** tant que la file est pleine.                                                                                                              |
| 5b  | Couverture : tests « liés » seulement sur PR, suite complète au quotidien   | ≈ 25                                                                                | ≈ −8                                                        | **Élevé** : des centaines de gardes lisent des fichiers par chemin (`readFileSync` de `ci.yml`, de `schema.prisma`, de `docs/`…). Le graphe d'import de Vitest ne les voit pas : une PR peut casser une garde et passer. Le quotidien rattrape **après** la fusion.                              | **ÉCARTÉE.** On ne fusionne pas sur un échantillon.                                                                                                   |
| 5c  | Couverture : `pool: threads`                                                | ≈ 3                                                                                 | ≈ −1                                                        | Bloquant : Vitest 2.1 + Node 24 casse en `threads` (commentaire de `vitest.config.ts`, issue 6661).                                                                                                                                                                                              | **ÉCARTÉE** (à revoir avec Vitest 3).                                                                                                                 |
| 5d  | Couverture : environnement `node` au lieu de `jsdom` pour les tests serveur | ≈ 5 à 10 (**à mesurer**)                                                            | ≈ −2 à −3                                                   | Moyen et **surtout bruyant** : un test qui a besoin du DOM échoue en rouge. Seul risque silencieux : une branche `typeof window` testée côté serveur au lieu du client ; il est borné en ne visant que `src/server/**` et `tests/unit/ci/**`.                                                    | **GARDÉE** (PR 3). Aujourd'hui **tout** tourne sous jsdom : 1 994 fichiers dans `src/server`, dont 303 seulement annotés `node`.                      |
| 6   | Couverture et Gate B **après** Gate A verte (`needs`)                       | ≈ 66 × p (p = part des runs où Gate A rougit)                                       | **+7 min sur CHAQUE PR verte** (+3 après la piste 4)        | Faible pour la sûreté (un job sauté → verdict rouge).                                                                                                                                                                                                                                            | **AMÉLIORÉE → « coupe-circuit »** (PR 1) : même économie ou presque, **zéro latence** sur une PR verte.                                               |
| 7   | Caches : store pnpm / `node_modules` / navigateurs Playwright               | store : déjà là (`setup-node cache: pnpm`) · `node_modules` ≈ 3 · navigateurs ≈ 1   | ≈ −0,5                                                      | `node_modules` en cache : binaires natifs (argon2) et scripts `postinstall` figés → risque d'un vert faux pour ~30 s gagnées.                                                                                                                                                                    | Store : rien à faire. `node_modules` : **ÉCARTÉE**. Navigateurs Playwright : **GARDÉE** (PR 2), petite.                                               |
| 8   | Plafonner les robots `claude-credit-api.yml`                                | indirect : rend des places                                                          | indirect                                                    | `concurrency` sans file garde **un seul** run en attente et **annule** les autres : des consignes perdues en silence.                                                                                                                                                                            | **ÉCARTÉE dans le workflow.** Règle côté session pilote (voir § 4).                                                                                   |
| 9   | File de fusion (merge queue)                                                | **le plus gros gain possible SI** la protection exige « branche à jour » (`strict`) | fusions en série, mais plus de « mettre à jour + relancer » | Si `strict` est faux, la file **ajoute** un run complet par fusion : elle charge plus qu'elle ne soulage.                                                                                                                                                                                        | **CONDITIONNELLE** : d'abord lire `strict` (§ 5). Préparation dans la PR 3, activation = décision de Will.                                            |

**Gain immédiat attendu des PR 1 et 2** (PR verte) : ≈ 10 à 16 min-machine sur 76, et chemin critique ≈ 20 →
≈ 15 min. **PR où Gate A rougit** : ≈ 50 min-machine rendues à la file sur 66, verdict rendu en ≈ 3-4 min au lieu
de 17-20. Avec la PR 3 : ≈ 5 à 10 de plus.

---

## 2. Plan d'exécution : 3 PR indépendantes

Ordre conseillé : PR 1 (gain immédiat, aucune mesure préalable), puis PR 2 et PR 3 dans n'importe quel ordre.
Elles touchent des blocs différents de `ci.yml`. Si deux sont ouvertes en même temps, seul un conflit de texte
dans `ci.yml` est possible.

### PR 1 : `ci/coupe-circuit-et-gate-a-rapide`

**Fichiers** : `.github/workflows/ci.yml`, `tests/unit/ci/coupe-circuit-ne-rend-jamais-vert.spec.ts` (nouveau),
`tests/unit/ci/gate-a-caches-surs.spec.ts` (nouveau), `AGENTS.md` (section CI : 4 lignes),
`.pr/ci-coupe-circuit-et-gate-a-rapide.md`.

**1.a Coupe-circuit** (remplace la piste 6 et les `needs: gate-a` de l'ancienne branche). Nouveau job, après `gate-a` :

```yaml
# Gate A rouge sur une PR prête ⇒ on annule le run : couverture et Gate B
# s'arrêtent, leurs verdicts (always()) tournent quand même et rendent ROUGE.
# N'est JAMAIS exigé ; ne peut que rendre un contexte non vert plus tôt.
coupe-circuit:
  name: Coupe-circuit (Gate A rouge)
  needs: gate-a
  if: >-
    failure() && (
    (github.event_name == 'pull_request' && github.event.pull_request.draft == false) ||
    github.event_name == 'merge_group')
  runs-on: ubuntu-latest
  timeout-minutes: 3
  permissions:
    actions: write
  steps:
    - env:
        GH_TOKEN: ${{ github.token }}
      run: gh run cancel "${{ github.run_id }}" -R "${{ github.repository }}"
```

Pourquoi un job à part et pas une dernière étape de Gate A : annuler le run depuis Gate A ferait finir Gate A en
« cancelled » au lieu de « failure ». Le contexte serait toujours bloquant, mais il serait trompeur.
Pourquoi pas sur `schedule` : le passage quotidien doit rendre **tous** les défauts. Pourquoi pas en brouillon :
les jobs lourds n'y tournent pas, et annuler couperait Gate D sans rien économiser.

Ce que ça change à la doctrine « une PR cassée rend tous ses défauts en une passe » (commentaire du 2026-08-18 en
tête de `jobs:`) : sur une PR prête dont Gate A rougit, les tests et l'E2E ne sont plus rendus dans la même passe.
Ils le seront au push suivant. Écrire ce paragraphe daté sous le commentaire existant. C'est la contrepartie
assumée, la même que dans l'ancienne branche, mais sans les +7 min sur chaque PR verte.

**1.b Caches de Gate A** (dans `gate-a`, après `pnpm install`, avant `next typegen`) :

```yaml
# Passage quotidien : SANS cache (contrôle à froid complet, filet de sécurité).
- name: Caches lint / format / types
  if: github.event_name != 'schedule'
  uses: actions/cache@v4
  with:
    path: |
      node_modules/.cache/eslint
      node_modules/.cache/prettier
      tsconfig.tsbuildinfo
    key: gate-a-v1-${{ hashFiles('pnpm-lock.yaml', 'eslint.config.mjs', '.prettierrc.json', '.prettierignore', 'tsconfig.json', 'package.json') }}-${{ github.sha }}
    # Le préfixe garde le hachage des configs : jamais de cache d'une autre config.
    restore-keys: |
      gate-a-v1-${{ hashFiles('pnpm-lock.yaml', 'eslint.config.mjs', '.prettierrc.json', '.prettierignore', 'tsconfig.json', 'package.json') }}-
```

- ESLint : `run: pnpm lint --cache --cache-strategy content --cache-location node_modules/.cache/eslint/`
- Prettier : `run: pnpm format:check --cache --cache-strategy content --cache-location node_modules/.cache/prettier/.prettier-cache`
- tsc : inchangé (`tsconfig.json` porte déjà `"incremental": true` ; avec `--noEmit`, tsc écrit
  `tsconfig.tsbuildinfo` à la racine, déjà ignoré par `.gitignore` via `*.tsbuildinfo`). tsc vérifie lui-même
  que le fichier correspond à sa version et à ses options.
- `--cache-strategy content` est **obligatoire** : la stratégie par défaut (date de modification) ne vaut rien
  après un checkout, où toutes les dates sont neuves.
- Sûreté : la config ESLint n'a aucune règle typée ni de règle qui lit d'autres fichiers (vérifié :
  `eslint.config.mjs` n'importe que `eslint-config-next`). Le résultat d'un fichier ne dépend donc que de son
  contenu et de la config, et les deux sont dans la clé. Si une règle typée (`parserOptions.project`) est
  ajoutée un jour, le cache ESLint doit sortir : la garde ci-dessous le refuse.
- Le cache est écrit par chaque run vert, y compris le push sur `main` (Gate A y tourne), donc chaque PR lit
  celui de `main`.

**1.c Gate B : attente du disque déplacée.** Déplacer l'étape « Libérer le disque — ATTENDRE la fin » **après**
« Install Playwright browsers » et **avant** « Relocate .next to /mnt ». `apt-get clean` reste dans l'étape
d'attente : il n'y a plus de course sur le verrou apt, puisque Playwright a fini. L'attente reste bloquante et se
fait toujours avant `.next`, le build et le semis : la protection contre l'ENOSPC ne change pas. Mettre à jour
le commentaire « ORDRE DES ÉTAPES ».

**Gardes à écrire ou mettre à jour (`tests/unit/ci/`)** :

- `coupe-circuit-ne-rend-jamais-vert.spec.ts` (nouveau) :
  - le job a `needs: gate-a` et un `if` qui commence par `failure()` ;
  - aucune autre commande que `gh run cancel` ;
  - `permissions: actions: write` n'apparaît **que** sur ce job ;
  - son nom n'est pas un des 4 contextes exigés ;
  - aucun autre job ne le cite dans `needs` ;
  - les deux verdicts gardent `always()` en tête de leur `if` (déjà vérifié par `brouillon-sans-ci-lourde`, le
    recouper ici) et rougissent sur tout résultat ≠ `success`, y compris `cancelled`.
- `gate-a-caches-surs.spec.ts` (nouveau) :
  - la clé et les `restore-keys` contiennent `pnpm-lock.yaml`, `eslint.config.mjs` et `.prettierrc.json` ;
  - `--cache-strategy content` est présent pour ESLint et pour Prettier ;
  - l'étape de cache porte `github.event_name != 'schedule'` ;
  - `eslint.config.mjs` ne contient ni `parserOptions.project` ni `projectService`.
- `la-suite-vitest-tourne-une-fois.spec.ts` : rien à changer (aucun `needs` ajouté aux morceaux). Vérifier
  qu'elle reste verte.
- `gate-b-a-ses-services.spec.ts` et `harnais-e2e-mesure-vraiment.spec.ts` : relancer. L'attente du disque reste
  avant le build ; si une garde vérifie l'ordre des étapes, l'ajuster sans l'affaiblir.
- `tout-check-est-cable.spec.ts` : relancer (les commandes `pnpm lint` et `pnpm format:check` restent appelées).

### PR 2 : `ci/gate-b-cache-compilateur`

**Mesure d'abord** (dans la même PR, premier commit, en brouillon puis prête une fois) : lire dans le journal de
l'étape Build la ligne `Compiled successfully in …` et l'heure de fin. Cela donne la part compilation et la part
pré-rendu des 464 s. Le cache ne gagne **que** sur la compilation. Si elle pèse moins de 90 s, fermer la PR sans
regret.

**Fichiers** : `.github/workflows/ci.yml`, `tests/unit/ci/gate-b-cache-sur.spec.ts` (nouveau),
`.pr/ci-gate-b-cache-compilateur.md`.

**2.a Cache webpack** (dans `gate-b`, **après** « Relocate .next to /mnt », sinon le cache tombe dans le dossier
que le montage recouvre) :

```yaml
# Seul le cache du COMPILATEUR : jamais fetch-cache ni images (aucune donnée
# servie depuis un cache). Écrit par le passage quotidien sur main (lisible par
# toutes les PR), lu partout ailleurs ; le quotidien lui-même part à froid.
- name: Cache du compilateur Next (lecture)
  if: github.event_name != 'schedule'
  uses: actions/cache/restore@v4
  with:
    path: .next/cache/webpack
    key: next-webpack-v1-${{ hashFiles('pnpm-lock.yaml', 'next.config.ts', 'tsconfig.json') }}-${{ github.sha }}
    restore-keys: |
      next-webpack-v1-${{ hashFiles('pnpm-lock.yaml', 'next.config.ts', 'tsconfig.json') }}-
```

Écriture : une étape `actions/cache/save@v4` juste après « Build »,
`if: github.event_name == 'schedule' && matrix.tranche == 1`. Une seule écriture par jour évite de saturer les
10 Go de cache du dépôt avec une copie par branche de PR. Contrepartie : le cache a jusqu'à 24 h de retard sur
`main` ; webpack recompile ce qui a changé, c'est seulement un peu moins rapide.

Vérifier aussi que `.next/cache/webpack` n'est pas touché par « Prouver que le build a survécu » ni par
`bundle:check`. Les deux lisent `.next/static` et `BUILD_ID`.

**2.b Disque** : si le `df -h / /mnt` déjà journalisé montre, sur 3 runs, une marge de plus de 5 Go sur `/` au
pic (`.next` est sur `/mnt` depuis le 2026-06-21), retirer le lancement et l'attente du nettoyage. Sinon, garder
la PR 1 telle quelle. Décision écrite dans la PR, avec les trois relevés.

**2.c Navigateurs Playwright** : `actions/cache@v4` sur `~/.cache/ms-playwright`, avec la clé
`pw-${{ hashFiles('pnpm-lock.yaml') }}`. Garder `playwright install --with-deps chromium` : il saute le
téléchargement si le navigateur est là et installe quand même les paquets système.

**Garde** `gate-b-cache-sur.spec.ts` :

- le chemin mis en cache est exactement `.next/cache/webpack` (ni `.next/cache` entier, ni `fetch-cache`) ;
- la restauration est placée après l'étape de montage `/mnt` et avant « Build » ;
- la sauvegarde ne se fait que sur `schedule` ;
- la clé contient `pnpm-lock.yaml` et `next.config.ts`.

Relancer aussi `harnais-e2e-mesure-vraiment.spec.ts` : aucune étape nouvelle n'écrit dans `.next` hors du cache.

### PR 3 : `ci/vitest-serveur-en-node-et-file-de-fusion`

**Fichiers** : `vitest.config.ts`, les ~30 fichiers de test de `src/server/**` qui touchent `document`/`window`
(en-tête `// @vitest-environment jsdom`, liste exacte à sortir par grep dans la PR),
`.github/workflows/ci.yml` (Gate C hors `merge_group`), `tests/unit/ci/…` (voir plus bas),
`.pr/ci-vitest-serveur-en-node.md`.

**3.a Environnement node pour le serveur** : dans `vitest.config.ts`, ajouter
`environmentMatchGlobs: [["src/server/**", "node"], ["tests/unit/ci/**", "node"]]`. Le défaut `jsdom` reste pour
le reste. L'en-tête `@vitest-environment` d'un fichier garde la priorité sur ces globs : les ~30 fichiers serveur
qui utilisent le DOM reçoivent `// @vitest-environment jsdom`.

- Mesure obligatoire dans le corps de PR : durée de « Vitest (with coverage) — morceau » sur les 3 morceaux,
  avant et après, sur 2 runs chacun (règle d'AGENTS.md : un temps se lit sur plusieurs runs). Si le gain est
  inférieur à 10 %, fermer la PR.
- Risque silencieux à vérifier : grep `typeof window` dans `src/server/**`. Pour chaque hit testé, confirmer que
  le test vise la branche serveur.
- Les seuils de couverture ne bougent pas : on mesure le même code avec le même fournisseur v8.

**3.b Préparer la file de fusion** (sans l'activer) : Gate C ne tourne plus sur `merge_group`. Elle ne peut pas
rougir (`continue-on-error`), n'est pas exigée et dure ~30 min : dans une file, elle n'apporterait que de
l'attente. Nouvelle condition : `if: github.event_name != 'pull_request' && github.event_name != 'push' && github.event_name != 'merge_group'`.
Mettre à jour le commentaire de Gate C. Ajouter dans une garde existante (`une-pr-empilee-est-gardee.spec.ts` ou
une nouvelle `file-de-fusion-prete.spec.ts`) :

- `merge_group:` est bien un déclencheur ;
- les 4 jobs qui portent un contexte exigé tournent sur `merge_group` (Gate A et Gate D sans `if` ; les deux
  verdicts listent `merge_group`) ;
- le coupe-circuit couvre `merge_group`.

---

## 3. Vérifier les 4 verdicts exigés, cas par cas

Pour chaque PR du plan, le corps de PR doit contenir ce tableau **rempli avec des runs réels** (numéro de run). Il
se lit avec :

```bash
gh api "repos/will383842/axion-ia/commits/<SHA>/check-runs?per_page=100" \
  --jq '.check_runs[] | [.name, .status, .conclusion] | @tsv' | sort
```

Attendu après la PR 1 (les PR 2 et 3 ne changent aucune ligne) :

| Cas                                        | Gate A · per-commit     | Gate A · couverture                 | Gate B · per-PR           | Gate D               | Coupe-circuit        |
| ------------------------------------------ | ----------------------- | ----------------------------------- | ------------------------- | -------------------- | -------------------- |
| PR prête, code vert                        | success                 | success                             | success                   | success              | skipped              |
| PR prête, faute Prettier (test volontaire) | **failure**             | **failure** (`cancelled`)           | **failure** (`cancelled`) | cancelled ou success | success              |
| PR prête, test Vitest rouge, Gate A verte  | success                 | **failure**                         | success                   | success              | skipped              |
| PR « docs » (`.md` seul)                   | comme une PR de code    | comme une PR de code                | comme une PR de code      | comme une PR de code | comme une PR de code |
| PR en brouillon                            | success / failure       | **failure** (« verdict non rendu ») | **failure** (idem)        | success / failure    | skipped (brouillon)  |
| `ready_for_review` sur le même SHA         | relancé                 | relancé, verdict réel               | relancé, verdict réel     | relancé              | selon Gate A         |
| push sur `main`                            | success                 | absent (inchangé)                   | absent (inchangé)         | success              | absent               |
| passage quotidien (`schedule`)             | success, **sans cache** | success                             | absent (inchangé)         | success              | absent               |
| `merge_group` (si la file est activée)     | comme une PR prête      | comme une PR prête                  | comme une PR prête        | comme une PR prête   | comme une PR prête   |

Points à regarder dans les journaux :

- cas « faute Prettier » : le run est `cancelled` et les deux verdicts sont **rouges**, pas `skipped` ni
  `cancelled` sans conclusion. S'ils finissent `cancelled`, c'est encore bloquant (≠ success), mais il faut le
  noter et ajouter un `if: always()` explicite s'il manque. Mesurer le temps entre l'échec de Gate A et la fin
  des morceaux et tranches : il doit tenir en moins d'une minute.
- cas « PR prête, code vert », deuxième push : les journaux d'ESLint et de Prettier montrent des fichiers lus
  depuis le cache (Prettier affiche les fichiers « (cached) » ou une durée de quelques secondes) ; tsc doit
  tourner en moins de 90 s.
- cas « quotidien » : l'étape de cache est `skipped` et ESLint, Prettier et tsc retrouvent leur durée à froid.
- Les 15 gardes de `tests/unit/ci/` qui lisent `ci.yml` passent :
  `pnpm vitest run tests/unit/ci src/server/ops/__tests__/disque-vps-aucune-purge-dangereuse.spec.ts`.

---

## 4. Robots (`claude-credit-api.yml`) : pourquoi pas dans le workflow

Chaque robot occupe une place jusqu'à 150 min. Un groupe `concurrency` sans `cancel-in-progress` ne garde qu'**un**
run en attente par groupe et annule les autres : une consigne envoyée serait perdue sans message. Une étape qui
attend « qu'il y ait de la place » occuperait elle-même une place pendant qu'elle attend.

**Solution sûre, hors de ce plan de PR** : la session pilote compte les robots avant de lancer un
`gh workflow run`, et attend au lieu de lancer s'il y en a déjà N (proposé : N = 6, ce qui garde 34 places pour la
CI) :

```bash
gh run list -R will383842/axion-ia --workflow=claude-credit-api.yml --limit 50 --json status \
  --jq '[.[] | select(.status=="in_progress" or .status=="queued")] | length'
```

C'est une règle de session (une ligne dans `AGENTS.md`, à ajouter à la PR 1 si Will la valide), pas un changement
de workflow.

---

## 5. File de fusion : la question à trancher d'abord

Lire la protection de `main` :

```bash
gh api repos/will383842/axion-ia/branches/main/protection --jq '.required_status_checks.strict'
```

- **`true`** (le commentaire de `ci.yml` du 2026-08-23 parle de `strict: true`) : chaque fusion rend les ~20
  autres PR « pas à jour ». Chacune doit être mise à jour puis repasser ~76 min-machine. C'est probablement une
  grosse part des ~33 jobs en file. La file de fusion règle exactement ce cas : on retire « branche à jour »,
  et la file teste **une fois** le résultat de la fusion (par lots de 2 à 4). Sûreté égale ou meilleure, parce
  que c'est le commit fusionné qui est testé. **Recommandée**, après la PR 3 (Gate C hors file) et sur décision
  de Will. À adapter alors : `_FILE-FUSION/fusion.ps1` (`gh pr merge --auto` / mise en file au lieu de la fusion
  directe), et le protocole « une seule session tient la file » d'AGENTS.md, qui devient la file GitHub elle-même.
- **`false`** : la file ajouterait un run complet par fusion, sans rien retirer. **Ne pas l'activer.**

⛔ Écarté dans les deux cas : sur PR, rendre « Gate B · per-PR » vert sans la lancer, sous prétexte que « la file
la lancera ». Il suffit qu'un administrateur contourne la file, ou qu'on la désactive un jour, pour qu'une PR
soit fusionnable sans E2E. C'est le défaut de #989/#990/#992.

---

## 6. Ce que je n'ai pas pu mesurer ici

- La part de runs où Gate A rougit (p de la piste 6). Elle se lit avec
  `gh run list --workflow=ci.yml --event pull_request --limit 200 --json databaseId,conclusion` puis les jobs de
  chaque run. Le gain du coupe-circuit est ≈ 50 min-machine × p par PR.
- La taille de `.next` et la part compilation / pré-rendu du build : premier commit de la PR 2.
- La valeur réelle de `strict` : § 5.
- Le plafond de jobs simultanés est-il partagé avec les autres dépôts du compte ? À lire dans les réglages
  Actions du compte.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
