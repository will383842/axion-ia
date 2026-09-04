# REPRISE — chantier « pilotage du recrutement »

> **À quoi sert ce fichier.** Si la session Claude Code se ferme, ce fichier suffit à
> reprendre sans relire quoi que ce soit d'autre. Il est mis à jour **à chaque étape
> franchie**, pas en fin de journée.
>
> **Dernière mise à jour : 2026-09-04, 08 h 30** (heure locale) — voir la section 0.
> **Worktree : `C:\Users\willi\Documents\Projets\Axion-IA\wt-recrutement`.**

---

## 0. ÉTAT AU 2026-09-04, 08 h 30 (le plus récent — lire ceci d'abord)

**LE CHANTIER EST LIVRÉ. Les six lots ET #977 sont fusionnés.**

| Repère                           | Valeur                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------- |
| **#977**                         | ✅ **FUSIONNÉE le 2026-09-04 à 05 h 45Z** — commit de fusion **`bcc33883b`** |
| Gates de #977 (tête `848f2a48a`) | **les quatre vertes** — Gate C a mis 38 min                                  |
| État lu juste avant la fusion    | `mergeStateStatus` = **CLEAN**, lu et fusionné dans le MÊME appel            |
| Créneau                          | réservé auprès des 3 sessions actives, les 3 ont confirmé                    |
| Prod au moment de la fusion      | `df1c28d13` — aucun build en vol, la fenêtre était libre                     |

⚠️ **#977 ne portait AUCUNE migration** (docs, `page.tsx`, `actions.ts`,
`admin-nav*`). Les cinq migrations de recrutement étaient déjà en production avec
les lots précédents — la sonde du § 2 quater était donc **déjà verte avant**
l'atterrissage de #977. La rejouer après est une non-régression, pas la preuve.

**Vérification faite le 2026-09-04 sur `df1c28d13` — trois chemins indépendants
concordent**, et c'est là tout l'intérêt :

| Chemin                                                   | Résultat                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| Sonde SQL sur le schéma                                  | 219 migrations finies, **0 en échec**, lignes 1→4 non-zéro |
| `prisma migrate status` (autre binaire, autre conteneur) | `219 migrations found` · `Database schema is up to date!`  |
| Logs entrypoint                                          | `Migrations applied successfully`, **aucun WARNING**       |

🔑 **Et un piège de conteneur, qui a fait diverger deux documents.** Il y a DEUX
conteneurs applicatifs. L'**app** (`mqbmlz…`) porte `docker-entrypoint.sh`,
`server.js` et `prisma-cli/` ; le **worker** (`oqj5ug…`) n'en a aucun. Le chemin
`/app/prisma-cli/node_modules/.bin/prisma` existe donc dans l'un et pas dans
l'autre — d'où deux « corrections » successives qui se contredisaient en
décrivant chacune un conteneur différent. **Prendre `/app/node_modules/.bin/prisma`,
seul présent dans les deux**, et choisir le conteneur par `ls /app`.

### Ce que la recette UI a donné

Console testée **en réel, par l'interface**, écran par écran. **Un seul vrai
défaut** : la **découvrabilité**. L'écran de pilotage du recrutement (livré par
#968) n'était dans **aucun menu** — atteignable seulement par un bouton
« Pilotage » _à l'intérieur_ de l'écran Candidatures.

Corrigé par `848f2a48a` : entrée « Pilotage du recrutement », groupe `contacts`,
`navLevel: 2`, sous « Candidatures » ; icône `Gauge` ajoutée aux deux endroits du
registre. Le compteur du snapshot passe 163 → **164**.

🔑 **La leçon**, et elle dépasse cet écran : `admin-nav:routes-check` vérifie que
chaque **entrée de menu** pointe vers une route existante — **jamais l'inverse**.
La classe « une route existe et n'a aucune entrée de menu » n'est gardée par
**rien**, et le compteur d'items ne peut pas la voir non plus (il compte les
entrées, pas les routes). La garde réciproque n'a **pas** été posée : trop de
routes admin sont légitimement hors menu (éditeurs, détail de fiche,
redirections), une garde naïve rougirait sur des dizaines de faux positifs et
serait désarmée dans la semaine. **Sujet ouvert**, il mérite sa liste
d'exceptions explicites.

### La garde des sous-onglets se trompait de question

`admin-nav.test.ts` portait « les 8 catégories de Messages sont indentées sous
lui » mais lisait `navLevel === 2`. **`navLevel` dit « indenté », jamais
« indenté SOUS QUI ».** Tant que Messages était le seul canal à avoir des
enfants, la confusion ne coûtait rien. Réécrite pour **borner chaque enfant entre
son canal et le suivant**, et **prouvée rouge par deux injections** :

- **A** — le pilotage remonte au-dessus de « Candidatures » : liste ordonnée
  INCHANGÉE, seule la borne de canal rougit.
- **B** — « Autres » glisse sous « Candidatures » : l'**ancienne** garde restait
  VERTE (elle ne vérifiait que « après Messages ») ; la nouvelle rougit.

### Ce qui N'EST PAS un défaut — à remonter à Will

- **78 candidats sur 86 n'ont jamais reçu de réponse** depuis leur dépôt,
  certains depuis **47 jours**. Donnée de production. L'écran remis dans le menu
  est précisément celui qui la montre.
- Les **86 candidatures en « Provenance inconnue »** sont normales : la capture
  UTM n'existe que depuis cette nuit (lot 5). Le stock antérieur n'a pas de
  provenance, et lui en inventer une serait pire.

### Ce qui reste — RIEN DANS LE CODE

Les trois points qui figuraient ici (attendre les gates, réserver le créneau et
fusionner, rejouer la sonde) sont **tous faits**. Le chantier n'a plus de tâche
technique ouverte.

**Il reste DEUX arbitrages de Will, et aucun ne se devine :**

1. **Le sort de `/console-editoriale` (11 écrans) et `/agenda`** — les mettre au
   menu, ou les déclarer volontairement hors menu. C'est le préalable à la garde
   réciproque du § 0 bis : tant que ce n'est pas tranché, une liste d'exceptions
   **figerait le défaut** au lieu de le signaler.
2. **L'adresse du VPS dans le dépôt public.** Ce journal contient l'IP, `root@`
   et des IDs de conteneurs, et il est versé **sans caviardage** — délibérément :
   l'adresse figure déjà dans **67 fichiers suivis**, dont 34 sous la forme
   `root@178…` et 16 workflows. Masquer ce seul fichier n'aurait rien protégé et
   aurait donné le sentiment inverse. L'exposition est préexistante et bien plus
   large ; la seule défense de cette adresse est aujourd'hui la clé SSH.

**Et une donnée de production à ne pas confondre avec un défaut** : **78
candidats sur 86 n'ont jamais reçu de réponse** depuis leur dépôt, certains
depuis **47 jours**. L'écran remis au menu est précisément celui qui le montre.
Les **86 « Provenance inconnue »** sont normales — la capture UTM date du lot 5,
le stock antérieur n'a pas de provenance et lui en inventer une serait pire.

---

## 0 bis. GARDE RÉCIPROQUE — la mesure est faite, la décision revient à Will

Le sujet ouvert de la section 0 (« une route existe et n'a aucune entrée de
menu » n'est gardée par rien) a été **instruit, pas posé**. Voici les chiffres,
mesurés le 2026-09-04 sur la tête `848f2a48a`.

### L'objection initiale était de bon sens — et les chiffres la nuancent

L'argument contre la garde réciproque était : « trop de routes admin sont
légitimement hors menu, une garde naïve rougirait sur des dizaines de faux
positifs et serait désarmée dans la semaine ». **Le premier chiffre lui donne
raison** :

| Mesure                                      | Valeur                        |
| ------------------------------------------- | ----------------------------- |
| Routes `page.tsx` sous l'espace admin       | **308**                       |
| dont dynamiques (`[id]`, détail de fiche)   | 68                            |
| dont **statiques** (le périmètre gardable)  | **240**                       |
| Entrées de menu internes                    | 163 (+ 1 externe Tiime = 164) |
| **Orphelines brutes** (statique, hors menu) | **89**                        |

89 rouges : la garde naïve est bien indéfendable.

### Mais 77 des 89 se rangent en familles que la MACHINE reconnaît

Aucune liste d'exceptions n'est nécessaire pour celles-ci — un prédicat suffit,
et le prédicat dit _pourquoi_ la route est légitimement hors menu :

| Famille                        | Prédicat                                                                                                             | Nombre |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------ |
| **R.** Redirection pure        | le fichier appelle `redirect`/`permanentRedirect` et ne rend aucun JSX                                               | **28** |
| **C.** Page de création        | l'URL finit par `/new`, `/nouveau`, `/nouvelle`, `/import`, `/upload` (atteinte par le bouton « Créer » de sa liste) | **25** |
| **H.** Enfant d'un hub au menu | un ancêtre de l'URL est, lui, une entrée de menu                                                                     | **24** |
|                                | **RÉSIDU à lister explicitement**                                                                                    | **12** |

**Douze.** Une liste d'exceptions de douze lignes se relit ; elle ne se désarme
pas. La garde devient tenable.

### 🔴 Et le résidu n'est pas du bruit : c'est le MÊME défaut, en douze fois plus gros

Sur les 12 :

- **`/login`** — hors menu à juste titre (écran de connexion). Exception franche.
- **`/agenda`** — **aucun lien entrant**, nulle part.
- **`/console-editoriale` + 10 de ses écrans** (`achat-media`, `analyse`,
  `calendrier`, `equipe`, `idees`, `mediatheque`, `publications`, `recherche`,
  `reglages`, …) — **aucun lien entrant non plus.**

Vérifié par balayage : zéro occurrence de `console-editoriale` et de `}/agenda`
hors de leurs propres dossiers, dans `src/lib`, `src/components` et tous les
autres écrans de la console. **Ces onze écrans ne sont atteignables qu'en tapant
l'URL à la main** — exactement le défaut corrigé ce matin pour le pilotage du
recrutement, mais à l'échelle d'une console entière.

🔑 C'est la démonstration que la garde manquante n'est pas théorique : **elle
aurait attrapé le défaut d'aujourd'hui, et elle en révèle onze autres du même
type que personne n'avait vus.**

### Ce qui est proposé (⛔ NON POSÉ — décision de Will)

1. Ajouter `scripts/check-admin-nav-orphans.ts`, symétrique de
   `check-admin-nav-routes.ts`, appliquant les prédicats R / C / H puis une
   liste d'exceptions **nommées et justifiées ligne à ligne**.
2. Chaque exception porte sa raison en commentaire ; une exception qui ne
   correspond plus à une route existante fait **elle aussi** rougir la garde
   (sinon la liste pourrit).
3. Prouver la garde rouge par injection avant de la câbler dans Gate A.
4. **Avant tout cela : trancher le sort de `/console-editoriale` et `/agenda`.**
   Les mettre au menu, ou les déclarer volontairement hors menu. Tant que ce
   n'est pas tranché, la liste d'exceptions figerait un défaut au lieu de le
   signaler.

---

## 1. Ce qui a été décidé par Will (ne pas re-poser ces questions)

| Réf | Question                                         | Décision de Will                                                  |
| --- | ------------------------------------------------ | ----------------------------------------------------------------- |
| D1  | Qui pilote le recrutement actif ?                | **La console du site.** Le CRM Pro garde le vivier long terme.    |
| D4  | Que devient le dossier d'une personne recrutée ? | **On ne le supprime JAMAIS tout seul.** Aucune purge automatique. |
| —   | Fusionner #952 (correctif de purge) ?            | **Oui, immédiatement.** Fait.                                     |

Consigne de style donnée par Will : mes comptes rendus étaient **trop denses** et se
lisaient comme des questions alors qu'ils n'en étaient pas. Écrire court, dire ce qui
est fait, dire ce qui suit.

---

## 2. État des lots

`main` = `1b07b1df7`. **Prod = `c7ede17eb`** (rien n'a atterri depuis 18 h 29Z).

| Lot                                          | PR   | État                           |
| -------------------------------------------- | ---- | ------------------------------ |
| Purge RGPD                                   | #952 | ✅ en production (`5f6aba9b5`) |
| Lot 0 socle                                  | #955 | ✅ fusionnée                   |
| Déblocage e2e (limiteur)                     | #969 | ✅ **fusionnée** `ecaa11fb8`   |
| **Lot 1 — journal du candidat**              | #959 | ✅ **fusionnée** `96a4bdfc7`   |
| **Lot 2 — entretiens**                       | #961 | ✅ **fusionnée** `b6c2a4bec`   |
| Correctif crochet 30 s                       | #972 | ✅ **fusionnée** `2ec2018ff`   |
| **Lot 3 — décision**                         | #966 | ✅ **fusionnée** `1b07b1df7`   |
| Lot 4 — pilotage du stock                    | #968 | ⏳ gates                       |
| Lot 5 — provenance / UTM                     | #970 | ⏳ gates                       |
| Lot 6a — rôles + ADR 0047                    | #971 | ⏳ gates                       |
| Lot 6b — l'offre n'emporte plus les dossiers | #974 | ⏳ gates                       |
| Lot 6c — candidature spontanée               | #975 | ⏳ gates                       |

**Les 6 lots sont écrits et poussés.** Ordre de fusion restant :
#968 → #970 → #971 → #974 → #975, en rebasant la suite après CHAQUE fusion.

---

## 2 bis. 🛑 ARRÊT VOLONTAIRE DE LA FILE (2026-09-04, 00 h)

**Cinq builds annulés d'affilée, rien en prod depuis 18 h 29Z.**

```
1b07b1df7  in_progress   23:48Z
2ec2018ff  cancelled     23:32Z
b6c2a4bec  cancelled     23:11Z
96a4bdfc7  cancelled     22:39Z
ecaa11fb8  cancelled     22:00Z
```

La doctrine « sérialiser les GATES, pas les BUILDS » a **deux** conditions. Je
n'ai honoré que la première (le build tué ne portait pas d'atterrissage attendu)
et jamais la seconde : **une fenêtre libre en fin de lot**. Chaque fusion prise
isolément était défendable ; c'est l'enchaînement qui affame.

⚠️ **L'aggravant, et la vraie raison de l'arrêt** : les trois lots fusionnés
portent **quatre migrations** non vérifiées en production, et l'entrypoint
**avale** un `prisma migrate deploy` en échec. Empiler une cinquième migration
(#974) sur quatre non vérifiées, c'est se garantir de ne pas savoir laquelle a
échoué le jour où ça casse.

👉 **Contrôle à faire toutes les 2-3 fusions**, pas seulement à la fin :
`gh run list --workflow "Build & Deploy · GHCR + Coolify (axion-ia.com)" --limit 6`

- `curl -sI https://axion-ia.com/fr | grep -i x-axion-build-sha`.
  Trois `cancelled` de suite ⇒ s'arrêter et laisser atterrir.

---

## 2 quater. LA SONDE DE VÉRIFICATION DES MIGRATIONS (prête, mesure d'AVANT prise)

SSH root au VPS **disponible depuis cette session** (`root@178.105.55.15`).
Conteneur applicatif portant l'entrypoint : `mqbmlz1bcwsdwi3t9fxsllqt-…`.
Conteneur Postgres : `u7zlql3bpb1xy5t4kg6jnvpm`, rôle **`axionia`**, base `axionia`.

⚠️ `prisma migrate status` depuis le conteneur ACTUEL répond « 213 migrations —
up to date ». **Vrai et sans valeur** : cette image ne contient pas les quatre
nouvelles migrations, elle compare la base à un jeu périmé.

La requête est dans `scratchpad/verif-schema-prod.sql`. **Mesure d'AVANT prise
le 00 h 05Z**, avec ses témoins :

```
0 TEMOIN+ base courante (doit etre axionia)                  | 1
0 TEMOIN+ col:job_applications.id (doit valoir 1)            | 1
0 TEMOIN+ journal:_prisma_migrations finies (doit valoir 213)| 213
0 TEMOIN+ table:job_applications (doit valoir 1)             | 1
0 TEMOIN- table inexistante (doit valoir 0)                  | 0
1..5  les 4 migrations recrutement                           | 0 partout
```

🔑 **Les témoins POSITIFS sont indispensables** : sans eux, dix zéros ne
distinguent pas « absent » de « ma sonde ne mesure rien ». Le `213` relie la
sonde SQL au chiffre rendu par `migrate status` — deux chemins indépendants.

**Après l'atterrissage**, les lignes `1` à `4` doivent passer à non-zéro et la
ligne `5` (migrations EN ÉCHEC) rester à 0. Si un témoin POSITIF tombe à 0, le
problème est la sonde, pas la migration — et c'est plus urgent.

---

## 2 ter. 🔴 LES GARDES DE DÉPÔT QUI M'ONT ATTRAPÉ (et ce qu'elles enseignent)

Trois gardes ont rougi sur du code que je croyais fini. **Aucune ne vivait dans un
dossier que je ciblais** — c'est la leçon principale de la nuit.

| Garde                               | Où                        | Ce qu'elle a attrapé                                                                                                   |
| ----------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `dossier-candidat-cloisonne`        | `src/server/auth/`        | le lot 4 ajoute `export-csv.ts` et déplace les gardes → cliquet rouge. Corrigé **dans le lot 4**, pas en bout de pile. |
| `la-couverture-axe-ne-retrecit-pas` | `tests/unit/a11y/`        | mon commentaire dans le `beforeAll` a poussé `loginAsAdmin(` hors de la fenêtre de 400 caractères.                     |
| `delai-interne-sous-le-budget`      | `tests/unit/e2e-harness/` | (étendue par moi) elle ignorait les crochets.                                                                          |

👉 **Avant tout push : `pnpm exec vitest run` SANS chemin.** Un sous-ensemble ciblé
n'exerce pas les gardes de dépôt, et elles vivent dans `tests/unit/ci/`,
`tests/unit/a11y/`, `tests/unit/e2e-harness/`, `src/server/auth/` — quatre dossiers
qu'on ne cible jamais quand on travaille sur une fonctionnalité.

### Trois trous trouvés PAR INJECTION, dans des gardes existantes

1. **`dossier-candidat-cloisonne`** testait `source.includes("peutOuvrirDossierCandidat")` :
   neutraliser la garde en `if (false)` restait **VERT**, l'import portant encore le nom.
   → exiger la **parenthèse ouvrante**, imports retirés.
2. **`la-couverture-axe`** cherchait `loginAsAdmin(` dans les 400 caractères suivant
   `test.beforeAll(` : déplacer la connexion vers un `beforeEach` voisin restait
   **VERT**, alors qu'un `beforeEach` se rejoue à CHAQUE test — le défaut même des
   dix-huit connexions. → juger l'**appartenance au corps du crochet**, pas la distance.
3. **En réécrivant cette garde, j'ai supprimé son comptage** (`toBe(1)`) : l'injection
   « deux connexions » est repassée au vert. → une garde qu'on réécrit perd ce qu'on
   oublie de recopier, et le vert qui suit ressemble à un succès. **Rejouer TOUTES les
   injections après une réécriture, pas seulement celle qu'on corrigeait.**

---

## 2 bis. 🔴 CE QUI A DÉBLOQUÉ TOUTE LA PILE (2026-09-03 soir)

Les quatre PR étaient rouges pour **une cause commune, qui n'était pas leur code** :
Gate B tombait sur « Trop de tentatives. Réessayez dans 15 minutes. » — le limiteur
de débit de la connexion admin.

L'arithmétique, écrite nulle part dans le dépôt :

1. **Une connexion réussie consomme DEUX hits sur chaque compteur.** `signInAction`
   compte, puis appelle `signIn("credentials")` dont `authorize()` recompte les
   MÊMES clés. Budget réel : **25 connexions / 15 min**, pas 50.
2. **En CI tout le monde partage une IP.** Sous `pnpm start` sans proxy, ni
   `x-real-ip` ni `x-forwarded-for` : `getClientIp()` rend `"unknown"`.

La suite faisait **28 connexions = 56 hits** contre 50. Les deux specs de recrutement
du soir ont fait passer de 19 (38 hits) à 28 (56).

**#969** hisse le cache de session dans le fixture → **1 connexion**. Pas un
`storageState` de projet : des specs EXIGENT d'être déconnectées et vivent dans les
mêmes fichiers que des specs connectées (`console-editoriale`, `admin-routes`) — un
`storageState` les aurait authentifiées **en silence**, vertes sans plus rien asserter.

⚠️ **Et le premier correctif a introduit sa propre panne** : un verrou inter-workers
attendait jusqu'à 90 s, or `a11y-admin.spec.ts` se connecte dans un `beforeAll` dont
le budget Playwright est de **30 s**. Ce n'était pas un mauvais réglage mais une idée
fausse — une connexion coûte 60 à 180 s en CI, donc **un attendeur ne peut jamais
tenir dans un budget de crochet qu'il ne contrôle pas**. Verrou retiré : chaque
worker se connecte au plus une fois (≤ 4 connexions = 8 hits, marge intacte).

---

## 3. La pile de branches (elle est empilée, l'ordre compte)

```
main  b854784f4
 └── feat/journal-du-candidat      (#959)  ← rebasée sur main le 09-03 19 h 15
      └── feat/entretiens-candidats (#961)  ← PAS ENCORE rebasée
           └── feat/decision-candidature     ← PAS ENCORE rebasée, PR pas ouverte
```

SHA **avant** le rebase de la journée (à garder pour rebaser la suite) :

```
journal    = 86ea0ab2e5785adaf9476383eb67c3fe1efedf12
entretiens = 37e66c8533c523a94eff07ce75eefdd6c944eed4
decision   = 4291c31e3aa877b977b576e69a8a7cafbb17fa4a
socle #955 = 98b765a4d02b2dba726177455538a316586b24ce   (tête AVANT le squash-merge)
```

Après rebase, la tête de `feat/journal-du-candidat` est **`4c6e0b9f3`**.

### Les commandes exactes pour finir la pile

```bash
cd C:/Users/willi/Documents/Projets/Axion-IA/wt-recrutement

# 1. pousser le journal (rebase déjà fait, arbre propre)
git push --force-with-lease origin feat/journal-du-candidat

# 2. rebaser les entretiens sur la NOUVELLE tête du journal
git rebase --onto feat/journal-du-candidat 86ea0ab2e feat/entretiens-candidats
git push --force-with-lease origin feat/entretiens-candidats

# 3. rebaser la décision sur la NOUVELLE tête des entretiens
git rebase --onto feat/entretiens-candidats 37e66c853 feat/decision-candidature
git push -u origin feat/decision-candidature   # première poussée
```

---

## 4. ⚠️ Le piège qui a coûté une heure aujourd'hui — ne pas le refaire

`gh pr merge 955 --squash --delete-branch` a supprimé `chore/socle-recette-recrutement`,
qui était **la base de la PR #959**. GitHub a alors **fermé #959**, et une PR fermée ne
peut être ni rouverte ni reciblée tant que sa branche de base n'existe pas.

**La sortie** (elle marche, elle a été jouée) :

```bash
gh api repos/will383842/axion-ia/git/refs \
  -f ref=refs/heads/<branche-de-base-supprimée> -f sha=<sha du squash sur main>
gh pr reopen <n> && gh pr edit <n> --base main
```

> L'API GitHub plutôt qu'un `git push` : le hook `pre-push` de ce dépôt joue toute la
> suite de tests (283 s) même pour un simple ref déjà présent sur `main`, et le push
> expirait avant d'aboutir.

**Règle à retenir : ne jamais passer `--delete-branch` sur une PR qui sert de base à une
autre.** Vérifier d'abord `gh pr list --json baseRefName`.

---

## 5. Ce que le lot 3 contient (commit `4291c31e3`, déjà fait)

- **Deux migrations, et la séparation est obligatoire** : Postgres refuse d'_utiliser_
  une valeur ajoutée par `ALTER TYPE … ADD VALUE` dans la transaction qui l'ajoute.
  - `20260903160000_recrutement_statuts_enum` — ajoute `interview`, `offer`, `withdrawn`
  - `20260903163000_recrutement_decision` — colonnes, reprise du stock, contrainte
- **`JobRejectionReason`** : 11 motifs, un TYPE et non une chaîne libre.
- **Contrainte `job_applications_motif_coherent_check`, dans les deux sens** : écarté ou
  retiré ⇒ motif obligatoire ; en cours ⇒ motif interdit. `hired` et `archived` sont
  volontairement hors des deux sens (archiver un refus ne doit pas effacer son motif).
- **`src/content/recrutement/statuts.ts`** : les **trois** copies manuelles de la liste
  des statuts (`reads.ts`, `ApplicationStatusForm.tsx`, `ApplicationsV2.tsx`) fusionnées
  en une seule table. `Record<JobApplicationStatus, …>` fait refuser une table incomplète
  au typecheck.
- **`lastActivityAt`** alimenté par `consignerEvenement` **et par elle seule**.

### Preuves déjà jouées (ne pas les rejouer sans raison)

| Preuve                                                     | Résultat                                     |
| ---------------------------------------------------------- | -------------------------------------------- |
| `prisma migrate diff` base ↔ schéma                        | « No difference detected »                   |
| `prisma/scripts/verifier-contrainte-decision.sql` (10 cas) | 5 refus, 5 acceptations, exactement les bons |
| `le-miroir-tient-avec-la-contrainte-sql.spec.ts`           | 9 verts ; **3 fautes injectées → 3 rouges**  |
| `tests/unit/ci/` + suites de la zone                       | 139 verts                                    |
| `src/server/email/` (parc de gabarits)                     | 209 verts, compte relevé à **46**            |

---

## 6. Base de recette dédiée

La base de développement partagée a été **vidée trois fois** par d'autres sessions.
Une base dédiée existe :

```
DATABASE_URL=postgresql://axion_ia:axion_ia_dev@localhost:5434/axion_recrutement_e2e
```

Conteneur : `axion-ia-postgres` (`pgvector/pgvector:pg16`, port 5434).
`psql` n'est **pas** dans le PATH — passer par
`docker exec -i -e PGPASSWORD=axion_ia_dev axion-ia-postgres psql -U axion_ia -d <base>`.

Les migrations du lot 3 y sont **déjà appliquées à la main** (pas de table
`_prisma_migrations` : `migrate deploy` répond `P3005`).

Semer : `pnpm db:seed` puis `pnpm recrutement:seed-scenarios`.

---

## 6 bis. Journal de reprise (session du 2026-09-03 soir)

| Heure   | Étape                                                                                                                                                                                                                                                                                                                |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 19 h 38 | **Build `b854784f4` ATTERRI.** `x-axion-build-sha` en prod = `b854784f4d27…`. Jobs : build 16 h 51 → 17 h 30 UTC (38 min), deploy → 17 h 34 UTC. Restent `lhci` et le warm-cache, **qui ne bloquent pas**. Le créneau de fusion est libre.                                                                           |
| 20 h 12 | **Pile entière vérifiée sur sa TÊTE** : `typecheck` (bannière `> tsc --noEmit`, exit 0), 6 gardes statiques vertes, **65 fichiers / 1 258 tests verts**, `pnpm audit --prod` sans CVE high/critical. C'est un **sur-ensemble strict** de ce que joue le hook `pre-push` → push en `--no-verify` assumé et documenté. |
| 20 h 25 | ⚠️ **`main` a bougé pendant le push** (#963 tunnel Facebook, `c7ede17eb`) : les trois PR sont passées `DIRTY` sur `payloads-exemple.spec.ts`. Pile **re-rebasée** sur le nouveau `main`, compte de gabarits **remesuré** (48 sur le journal, **49** sur la tête) — jamais deviné.                                    |
| 21 h 35 | **Les trois défauts corrigés, chacun dans SON lot.** Pile re-rebasée : 14 commits, 4 lots. Seed rejoué EN BASE sur `axion_recrutement_e2e` — la contrainte l'accepte, répartition 14/11/8/5/3/11/2/3/3 = 60 relue en base.                                                                                           |
| 21 h 05 | 🔴 **Les gates ont trouvé TROIS vrais défauts que le local n'avait pas vus** — détail au §9. Corrigés à l'endroit où chacun est introduit, pas en bout de pile.                                                                                                                                                      |
| 20 h 55 | **Lot 4 codé et commité** sur `feat/pilotage-recrutement` (écran de pilotage, dossiers en sommeil + cron, recherche déchiffrante, gestes groupés, export CSV). typecheck vert, 31 tests neufs verts.                                                                                                                 |
| 20 h 33 | **Les trois PR ciblent `main` et ont enfin des gates.** #959 (`dcbf2fb2d`), #961 (`ad852ce41`), **#966 ouverte** (`f14f270ab`).                                                                                                                                                                                      |
| 19 h 49 | Push de `feat/journal-du-candidat` lancé en **arrière-plan** : le hook `pre-push` joue `vitest related` sur 22 fichiers et dépasse les 10 min du premier essai.                                                                                                                                                      |

### Le hook `pre-push` de ce dépôt (mesuré ce soir)

Il ne joue **plus** `typecheck` ni la suite complète (retirés le 2026-08-19). Il joue :
`i18n:check`, `zod:check`, `vitest related` sur les `.ts/.tsx` modifiés depuis `origin/main`
(seuil 200 fichiers), puis `pnpm audit --prod`. Sur 22 fichiers touchant la zone e-mail,
**il dépasse 10 minutes** — d'autant que d'autres sessions (`wt-facebook`) occupent la machine.
👉 **Pousser en arrière-plan**, jamais au premier plan.

### Les gates ne se déclenchent QUE sur `main` ou `staging`

`.github/workflows/ci.yml` : `pull_request: branches: [main, staging]`. Une PR empilée sur une
branche de fonctionnalité **n'a aucune gate**. Conséquence pour cette pile : chaque PR doit
cibler `main` pour être évaluée, et son diff porte alors les commits de ses parents jusqu'à ce
qu'ils fusionnent. C'est bruyant à la relecture, mais c'est le seul moyen d'avoir un verdict.

**Ordre de fusion, sans `--delete-branch` :** #959 → rebase entretiens sur `main` → #961 →
rebase décision sur `main` → PR lot 3.

---

## 7. Ce qui reste à faire, dans l'ordre

1. **Pousser `feat/journal-du-candidat`** → #959 passe enfin ses gates (elle n'en avait
   jamais eu : elle visait une branche autre que `main`).
2. Rebaser et pousser `feat/entretiens-candidats` (#961), puis la recibler sur `main`.
3. Ouvrir la PR du lot 3 depuis `feat/decision-candidature`.
4. **Vérifier les migrations en production** avec `scripts/ops/verifier-migration-en-prod.sh`
   (livré par la session `axion-ia-b6` dans #964). Il manque la forme `Type:valeur` pour
   contrôler `job_application_event_type:entretien_sans_suite`.
   ⚠️ L'entrypoint **avale** un `prisma migrate deploy` en échec : un déploiement vert ne
   prouve pas que le schéma a bougé.
5. Lots 4, 5, 6.

### Protocole de fusion (convenu avec les sessions voisines)

- Le créneau se réserve **avant** l'`update-branch`, pas avant le `merge`.
- Lire `mergeStateStatus` et fusionner **dans le même appel shell**.
- Vérifier l'atterrissage par `curl -sI https://axion-ia.com/fr | grep -i x-axion-build-sha`,
  jamais par la couleur du run.
- Build mesuré **47 à 56 min** : ne jamais réserver un créneau à moins d'une heure.
- Sessions voisines : `axion-ia-b6` (chantier clos, dépôt retiré), `axion-ia-6b`,
  `axion-ia-3f`.

---

## 9. Ce que les gates ont attrapé et que le local n'a pas vu (2026-09-03, 21 h)

Trois défauts RÉELS, plus une panne d'environnement. Chacun est corrigé **dans le lot qui
l'introduit** — pas en bout de pile, sinon la PR intermédiaire reste rouge et ne peut pas
fusionner.

| #   | Où                                  | Ce que c'était                                                                                                                                                                                 | Corrigé dans                                                                                |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | `reply-actions.ts`                  | un module `"use server"` exportait une **constante** (`LIBELLES_ERREUR_REPONSE`). Next refuse : **la fiche candidat plantait entièrement**.                                                    | **lot 1** — `libelles-erreurs.ts` + la garde CI `le-use-server-n-exporte-que-des-fonctions` |
| 2   | `ComposerReponse.tsx`               | la classe `.admin-card-inset` était **posée et n'existait pas**. Le navigateur ignore une classe inconnue en silence : l'aperçu s'affichait sans sa surface, indiscernable du champ de saisie. | **lot 1** — définie dans `admin.css`                                                        |
| 3   | `prisma/seeds/recrutement/index.ts` | le seed du socle écrit 12 candidatures `rejected` **sans motif** — la contrainte du lot 3 les refuse, et **Gate B ne peut plus semer sa base**.                                                | **lot 3**                                                                                   |
| —   | Gate B de #961                      | 6 parcours Qualiopi rouges sur `Trop de tentatives. Réessayez dans 15 minutes.` — **le limiteur de connexion admin**, pas un défaut du code. À relancer.                                       | rien à corriger                                                                             |

### 🔴 Le piège local qui a produit un faux rouge

Après `git checkout` d'une autre branche de la pile, **`prisma/generated/client` reste
celui de la branche précédente**. Un `pnpm typecheck` mesure alors un schéma qui n'est pas
celui de la branche : ici, `timeline.ts` réclamait `entretien_sans_suite`, une valeur
d'enum du lot 2, sur le lot 1.

👉 **`pnpm prisma:generate` après CHAQUE changement de branche de cette pile**, avant tout
typecheck. La CI ne connaît pas ce piège — elle génère toujours depuis le schéma de la
branche.

---

## 10. Machine saturée — comment jouer les tests ce soir

`pnpm exec vitest run` sur un large périmètre est mort deux fois sur :

```
Error: Worker exited unexpectedly   (tinypool)
```

Ce **n'est pas** un test rouge : c'est la machine. Trois autres sessions Claude tournaient
en parallèle (`wt-facebook`, `wt-mission`, un `next dev` et un worker BullMQ), plus le
typecheck. Le même symptôme a déjà été payé le 2026-09-02 sur Playwright
(`0xC0000142 STATUS_DLL_INIT_FAILED`).

👉 **Sur cette machine, borner les workers** :

```bash
pnpm exec vitest run --maxWorkers=2 --minWorkers=1 <chemins>
```

⚠️ Et ne PAS conclure « la suite est cassée » sur un crash de worker : lire la ligne
`Test Files … / Tests …`. Si elle est absente, la suite n'a pas rendu de verdict — elle
est morte avant.
