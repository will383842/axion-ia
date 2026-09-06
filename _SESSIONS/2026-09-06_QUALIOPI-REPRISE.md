# Qualiopi — reprise du 2026-09-06 · ce que la RELANCE a mesuré

> Ce fichier complète `2026-09-05_QUALIOPI-ETAT-VIVANT.md`, qui est **périmé sur
> trois points majeurs** (§5, §9 et son §0 « où on en est »). Il n'a pas été
> réécrit d'un bloc : on ne réécrit pas un journal, on l'annote.
>
> Écrit par la session `wt-app30-67`, réveillée par le filet de relance.

---

## 1. Les deux vérifications préalables du prompt de relance — faites, verdict

| Contrôle                          | Verdict **mesuré**                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Une autre session sur cet arbre ? | **Non.** `ListAgents` rend 5 pairs, tous `axion-ia-*` (checkout principal), tous `idle` depuis 16 h. Aucune session `wt-app30-*` sauf moi. |
| Travail non commité ?             | **Non.** `git status --porcelain` **vide**, branche synchrone avec `origin`. Le travail des cinq agents a bien été commité (`687cd5f1c`).  |

⚠️ **Le danger annoncé par le prompt n'existait plus** : il décrivait l'arbre tel
qu'il était à 10:20, avec 58 fichiers en l'air. Entre-temps la session du soir a
tout commité et poussé. **Le filet a donc démarré sur un terrain déjà rangé** —
c'est exactement ce que « garder l'arbre commité et poussé en permanence »
devait produire, et ça a marché.

---

## 2. L'état réel au réveil — chiffres relevés, pas recopiés

|                    |                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Branche            | `qualiopi/session-editable-et-conventions`, **29 commits d'avance, 0 de retard** sur `origin/main` |
| `origin/main`      | `15996bd6f`                                                                                        |
| **Prod sert**      | `15996bd6f` ✅ (`x-axion-build-sha`) — main est **atterri**                                        |
| **PR**             | **#1003 OUVERTE**, `mergeable: MERGEABLE`, `mergeStateStatus: BLOCKED`                             |
| **File de fusion** | **LIBRE** — aucun run `deploy-coolify` en cours                                                    |

### Le run de déploiement de `main` est marqué « failure », et ce n'est PAS un problème d'atterrissage

Run `33967996086` : `Build & push` ✅ **53 min 42 s** · `Trigger Coolify` ✅ 3 min 41 s
· `Warm edge cache` ✅ · `IndexNow` ✅ · **`Lighthouse CI post-deploy` ❌**.

Le rouge est **post-atterrissage**, sur la prod live, et il est **antérieur à
cette branche** — il appartient à `main`. Deux assertions desktop tombent :
`categories.performance` (minScore) et `first-contentful-paint`
(maxNumericValue). Les durées confirment au passage AGENTS.md : build 47-56 min.

🔑 **Ce rouge-là compte pour la suite** : c'est la seule gate de perf qui fasse
autorité (AGENTS.md), elle porte sur les pages **publiques**, et elle est déjà
en difficulté. Toute décision de budget prise plus bas doit donc **protéger le
public**, jamais l'assouplir.

---

## 3. 🔴 POURQUOI #1003 ÉTAIT BLOQUÉE — deux gates, deux causes sans rapport

### Gate A — le FORMAT, et la leçon est la troisième du même genre

`pnpm format:check` balaie `**/*.{ts,tsx,js,jsx,mjs,json,md,css}` — **toute**
l'arborescence. Huit fichiers dérivaient, **dont trois `.md`** : deux journaux de
session et l'ADR 0048.

Les cinq `.ts` avaient été relus ; ce sont les **documents** qui portaient
l'écart, parce qu'ils sont écrits par des agents et n'ont jamais traversé
`lint-staged`. C'est le même motif que `outbox-policy.spec.ts` rouge 24 h et que
les gardes `tests/unit/ci/` jamais lancées : **une garde qui balaie
l'arborescence ne se vérifie pas sur un sous-ensemble.**

✅ Corrigé (`fff4e9e48`). Contrôle : `prettier --check` sur le glob **complet**,
bannière lue — « All matched files use Prettier code style! », exit 0.

### Gate B — le cliquet anti-croissance du bundle

`SOMME de tous les page chunks hors /appel` : cliquet **703 kB**, mesure
**705,9 kB**. Dépassement **2,9 kB**.

Voir §4 : c'est le vrai sujet de cette reprise.

### ⛔ ET UN TROISIÈME FAIT, QUE PERSONNE N'AVAIT RELEVÉ

L'échec du poids du bundle a **sauté toute la suite Playwright** :

```
failure  Poids du bundle
skipped  Migrer et semer la base E2E
skipped  Prouver que le build de production a survécu
skipped  Playwright suite
```

**Un décompte d'octets a supprimé tout signal fonctionnel.** La suite E2E n'a
donc **jamais tourné** sur l'état final de cette branche — 30 commits, dont des
migrations et sept règles d'alertes. On connaît le poids du paquet et rien de ce
qu'il fait.

C'est un défaut d'ORDRE des étapes, pas de seuil : l'étape de budget est placée
**avant** la suite qui prouve que le produit marche.

---

## 4. Le bundle — ce que la mesure dit, et ce qu'elle contredit

### Les chiffres, tous mesurés en CI

| État                                     | Mesure        |
| ---------------------------------------- | ------------- |
| `main`                                   | **702,42 kB** |
| PR, avant la « réduction » (`664dd77d6`) | **705,86 kB** |
| PR, après la « réduction » (`687cd5f1c`) | **705,90 kB** |
| Cliquet                                  | **703 kB**    |

### 🔑 La réduction du soir n'a rien réduit — et c'est une leçon, pas un reproche

`687cd5f1c` a retiré du paquet client l'import de `LIBELLES_TYPE_DOCUMENT`, au
motif qu'importer une table de ~30 libellés pour en lire **deux** embarquait la
table entière. Le raisonnement est juste ; **la mesure ne l'a pas suivi** :
705,86 → 705,90 kB, soit **zéro gain**.

⚠️ **Nuance à ne pas écraser** : le même commit AJOUTAIT du code
(`queueMicrotask` + drapeau d'annulation dans `LiensEmargement.tsx`, +64/-25).
On ne peut donc pas conclure « le retrait de la table n'a rien valu » — seulement
**« le net est nul »**. Les deux effets ne sont pas séparables sans un troisième
build, et ils ne valaient pas ce build.

### Ce qui EST établi, et qui décide

**Les dix composants clients touchés par cette PR sont importés depuis des
routes `(admin)` — et seulement là.** Vérifié un par un :

```
DocumentsSection · EnrollmentsSection · SessionLieuForm   → (admin)/[adminPrefix]/qualiopi/sessions/[id]
GenererAttestationButton                                  → …/sessions/[id]/evaluations
LiensEmargement · SessionJoursEditor                      → …/sessions/[id]/emargement
SessionMontantForm                                        → …/sessions/[id]/financement
SessionForm                                               → …/sessions/new
TraineeForm                                               → …/stagiaires/new + …/stagiaires/[id]
LieuFieldset                                              → (aucune page directe)
```

**Aucune route publique.** Donc **100 % des 3,44 kB tombent dans la console
d'administration**, derrière l'authentification, sur des écrans qu'aucun visiteur
ne télécharge et qu'aucune mesure Web Vitals ne regarde.

### Le vrai défaut est la FORME du bucket, pas la valeur du seuil

Le cliquet est passé **700 → 702 → 703** en une seule journée, par des sessions
différentes. La session du soir a lu ça comme de l'indiscipline et a refusé un
quatrième recalage — refus honnête, et je ne le renverse pas à la légère.

Mais la cause n'est pas l'indiscipline : **c'est que le bucket somme les pages
publiques ET la console d'administration dans un seul nombre, alors qu'il existe
pour protéger le budget Web Vitals des pages publiques.** Trois sessions livrant
de l'admin le même jour font monter un compteur censé surveiller le public. Un
seuil qu'il faut relever à chaque fonctionnalité d'admin **finit forcément en
formalité** — le désaccord portait sur le geste, jamais sur la mécanique qui le
rend nécessaire.

Et le §2 ci-dessus donne l'argument dans l'autre sens : la gate Lighthouse
post-deploy, la seule qui fasse autorité, **est déjà rouge sur les pages
publiques**. Diluer le public dans l'admin est exactement ce qu'il ne faut pas
faire.

---

## 5. Corrections à porter au §5 et au §9 de l'état vivant du 05

L'état vivant décrit le terrain de **07:00**. Les 24 commits suivants l'ont
largement dépassé. Rectificatif, vérifié dans le code :

| Lot                        | Ce que l'état vivant dit          | **Réel au 2026-09-06**                                                                                                                                                                                                                      |
| -------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B — session éditable       | « socle fait, UI à câbler »       | ✅ **livré**, y compris F1 (`entreprise-client.ts`), F2 (consentements), F5 (`tarif-catalogue.ts`), F8, F9 (`liens-emargement-memoire.ts`) et le débordement du bloc Documents                                                              |
| C — distanciel             | « carte du terrain faite »        | ✅ **couche A livrée** : ADR 0048 + gabarit `qualiopi-rappel-j1` **câblé** (`notifications-service.ts:531` → `qualiopi-formation-crons-worker.ts:2075`). Le stagiaire reçoit enfin le lien. Couche B (relevé par API) délibérément différée |
| D — alertes                | « 1/12 fait »                     | ✅ **12/12** (`e7172d692`) : 13 codes, 7 règles, 3 bornes élargies. Les 3 codes émis hors catalogue sont **catalogués** (`catalogue.ts:1233`, `:1250`, `:1267+`)                                                                            |
| E — attestation/certificat | « carte du terrain faite »        | 🟡 **avancé** : soupape atteignable depuis l'écran (`5572ba533`), gels **recensés et débloqués** (`9b87122a4`). Facture / échéancier / TVA **restent**                                                                                      |
| F — formateur, commissions | « audit à REFAIRE (sortie vide) » | ✅ **audit écrit**, 35,8 Ko (`aef1d1350`). Correctifs partiels (`8dfbd3b22` : l'archive D6 avait disparu du code)                                                                                                                           |
| Navigation                 | absent du plan                    | ✅ audit + **5 sous-pages** réparées (`ba63f5bc0`, `27789969a`)                                                                                                                                                                             |

⛔ **Ce qui reste vraiment ouvert**, et c'est court :

1. la **suite E2E n'a jamais tourné** sur cette branche (cf. §3) ;
2. **facture / échéancier / TVA** (lot E) — dont l'arbitrage TVA **appartient à
   Will**, il est au §11 de l'état vivant et je n'y touche pas ;
3. la **recette PAR L'ÉCRAN** de la remise d'exemplaire : toujours jamais vécue
   en vrai, seulement prouvée par témoins ;
4. les correctifs du lot F au-delà de D6.

---

## 6. Ce que cette reprise a appris et qui n'était écrit nulle part

- 🔴 **Une gate de budget placée avant la suite fonctionnelle supprime le signal
  fonctionnel.** On a payé 37 min de CI pour apprendre un décompte d'octets et
  rien d'autre. L'ordre des étapes est une décision de conception, pas un détail
  de rédaction.
- 🔑 **Une optimisation plausible qui n'est pas mesurée n'est pas une
  optimisation.** « Importer une table pour deux chaînes l'embarque entière » est
  vrai en général et a rendu **zéro** ici.
- ⚠️ **`gh run view --log | grep` est un piège sur ce dépôt** : les messages de
  commit y font plusieurs milliers de mots et remontent sur presque tout motif.
  Passer par `--json jobs --jq '.steps[] | select(.conclusion=="failure")'` pour
  obtenir le NOM de l'étape, puis ne grepper que sa sortie.

---

## 7. Reprise du 2026-09-06 matin — ce que la mutation a corrigé dans mon propre raisonnement

> Session relancée après la fermeture inopinée de 00:51. L'arbre portait le split
> non commité et deux commits non poussés ; rien n'a été perdu.

### 7.1 Le témoin neuf rougit — vérifié avant d'être cru

`budget-public-et-admin-sont-separes.spec.ts` : 6 tests verts sur l'arbre sain.
Glob muté en `(admin)` nu → **2 tests rouges** (l'exclusion et l'échappement),
puis restauré. La garde discrimine.

Suite complète `tests/unit/ci/` : **37 fichiers, 184 tests, verts.** `typecheck`
vert (bannière `> tsc --noEmit` lue). `format:check` vert sur le glob complet.

### 7.2 🔴 Ce que le prompt de relance demandait ne suffisait PAS — et je l'ai découvert en mutant

Le pas 6 demandait « chaque bucket a matché ≥ 1 fichier, sinon exit 1 ». Écrit,
puis **éprouvé** en remettant `(admin)` nu dans la seule NÉGATION, avec la limite
publique desserrée pour isoler le cas muet.

**Le contrôle est resté VERT. La mesure aussi.**

Parce que `(admin)` ne correspond pas à _rien_ :

| Motif                                    | Fichiers |
| ---------------------------------------- | -------- |
| `chunks/app/**/(admin)/**/page-*.js`     | **0**    |
| `chunks/app/**/[(]admin[)]/**/page-*.js` | **311**  |
| `chunks/app/**/(admin)/**` ← l'EXCLUSION | **8**    |

picomatch lit les parenthèses comme un groupe, donc le motif désigne le
répertoire **littéralement** nommé `admin` — et il en existe un,
`chunks/app/api/admin/`, qui porte 8 chunks de route handlers. Aucun n'est un
`page-*.js`. L'exclusion satisfait donc « ≥ 1 correspondance » **en n'excluant
rien du tout**, et le bucket public ré-avale les 452 kB de la console en vert.

🔑 **Un compte non nul ne prouve pas qu'un motif désigne la bonne population.**
Le seul témoin qui discrimine est une **identité exacte**. D'où le second
contrôle, la **PARTITION** : `/appel` + public + admin couvrent tous les
`page-*.js` et n'en partagent aucun.

- arbre sain : `5 + 186 + 311 = 502` pour 502 chunks ✅
- sous mutation : `5 + 497 + 311 = 813` pour 502 chunks → **311 comptés deux
  fois**, rouge, avec les trois premiers chemins fautifs nommés ✅

### 7.3 Le moteur de globs du contrôle DOIT être celui de la mesure

Premier jet écrit avec `fs.globSync` de Node. Il rend **311 fichiers pour
`(admin)` nu** — le glob de Node traite `(` comme un caractère littéral. Un
contrôle bâti dessus aurait été **vert sur la faute exacte qu'il doit attraper**.

`scripts/ci/bundle-check.mjs` importe donc `tinyglobby` **par la résolution de
size-limit lui-même** (`size-limit/get-config.js` : `glob(patterns, { cwd })`).
Contrôle et mesure ne peuvent plus diverger : même moteur, même version, même
`cwd`.

### 7.4 Deux motifs morts, trouvés dès le premier passage

`gallery/**` (bucket `/galerie`) et `locations/**` (bucket `/implantations`) :
**0 fichier chacun, depuis le jour de leur écriture.** Ce sont des alias
`pathnames` de next-intl, réécrits au runtime — ils n'ont jamais de répertoire
propre dans l'App Router, donc jamais de répertoire de chunks. Ils étaient verts
parce que l'autre inclusion de leur bucket, elle, correspondait : size-limit ne
dit rien tant que l'union n'est pas vide.

C'est le trou de `/reserver` (juin → août), toujours ouvert, sur deux autres
motifs. Retirés ; raison consignée dans `package.json`
(`_size_limit_alias_note`). ⛔ **Ne pas les remettre à la réactivation du locale
EN** : le chemin de chunk vient de l'arborescence de fichiers, jamais du pathname
localisé.

### 7.5 Ce qui est commité

| Commit      | Contenu                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------- |
| `fff4e9e48` | Gate A (format) — 8 fichiers dont 3 `.md`                                                       |
| `d4aa0f2d8` | ce journal                                                                                      |
| `51acefe58` | split public 265 / admin 470, étape déplacée, `bundle-check.mjs`, garde statique, alias retirés |
| `6f3da0f02` | **ADR 0049** + point daté dans `AGENTS.md`                                                      |

### 7.6 File de fusion — engagement pris envers une session pair

`axion-ia-f1` a réservé la file le 06/09 : **#997 et #999 fusionnées en une seule
salve** (06:44:09Z → `b8d3134b1`, 06:44:37Z → `1dfab1872`), `cancel-in-progress` a
tué le premier build, **un seul survit** (`34017291398`). Cible d'atterrissage :
`x-axion-build-sha = 1dfab1872…` sur la prod. Budget annoncé **1 h 15**, pas 50
min (mesuré trois fois le 05/09).

⛔ **#1003 ne sera pas fusionnée avant son signal.** Pousser sur la branche de PR
ne déclenche que `ci.yml` ; `deploy-coolify` ne part que sur push `main`. Aucun
risque pour son build.

---

## 8. Run `34018394703` — la CI a tranché, et le déplacement a PAYÉ immédiatement

`b813bb175` · Gate C ✅ · Gate D ✅ · Gate A ❌ · Gate B ❌.

### 8.1 ✅ Ce que le déplacement de l'étape a produit — mesuré, pas espéré

| Étape Gate B                                 | Avant (run 33989952957) | Maintenant    |
| -------------------------------------------- | ----------------------- | ------------- |
| Migrer et semer la base E2E                  | `skipped`               | ✅            |
| Prouver que le build de production a survécu | `skipped`               | ✅            |
| **Playwright suite**                         | `skipped`               | **a TOURNÉ**  |
| Poids du bundle                              | `failure` (en tête)     | ✅ (en queue) |

**La suite E2E a tourné pour la première fois sur cette branche : 299 passés,
1 échec, 1 flaky, 12,7 min.** Et l'étape de budget a tourné **quand même**,
APRÈS l'échec Playwright — le `if: !cancelled()` a fait exactement ce qu'on lui
demandait. On connaît maintenant les deux choses au lieu d'aucune.

### 8.2 ✅ Le budget scindé est VERT en CI, aux mêmes comptes qu'en local

```
· 5 /appel · 186 public · 311 admin = 502 pour 502 chunks — partition exacte
  public  254,41 kB / 265 KB ✅        admin  451,44 kB / 470 KB ✅
```

Les **comptes de fichiers sont identiques** au local (502/5/341/311/186), seuls
les octets bougent : shell 134,94 kB en local → **136,17 kB** en CI. C'est le
« 500 octets d'écart » du prompt, mesuré ici à ~1,2 kB. **Le local ne certifie
pas cette gate ; il en donne l'ordre de grandeur.**

### 8.3 🔴 Le PREMIER défaut rendu visible par la remise en ordre

`01-presentiel.spec.ts:655` exigeait « Attestation de réalisation ». L'écran rend
« Attestation de **fin de formation** ».

**C'est l'écran qui a raison.** « Réalisation » est le vocabulaire du
**CERTIFICAT**, dû au **FINANCEUR** ; l'attestation est due au **STAGIAIRE**. Un
auditeur lisant deux lignes voisines ne pouvait pas les distinguer. Corrigé le
2026-09-05, aligné sur ce que la **pièce imprime déjà**, et verrouillé par DEUX
témoins unitaires (`docs-section-libelles-derivent.spec.ts`,
`libelles-vs-titres-pdf.spec.ts`).

🔑 **Le correctif est donc parti VERT en laissant derrière lui une assertion E2E
qui le contredisait** — parce que l'étape de budget faisait `skipped` la suite
qui l'aurait dit. Ce n'est pas une hypothèse sur le coût de l'ordre des étapes :
c'est le premier cas réel qu'il produit, trouvé le jour même de la correction.

L'attente est désormais **dérivée** de `LIBELLES_TYPE_DOCUMENT.attestation`. Une
chaîne recopiée ici survivrait au prochain arbitrage de vocabulaire sans que
personne ne la relie à sa source — ce qui vient exactement de se produire.
⚠️ Aucun autre fichier de `tests/e2e` n'importe de `@/` : l'alias a été **sondé**
(spec jetable, exécutée, verte) avant d'être écrit, pas supposé.

### 8.4 🔴 Gate A — un numéro de PR lu comme une couleur

`Anti-hex grep` rouge sur `LieuFieldset.tsx:76` : le commentaire citait
« l'alerte **#980** ». Le motif de `check-anti-hex.sh` accepte 3, 4, 6 ou 8
chiffres hexadécimaux — `#980` en est un de 3, comme `#abc`.

Là encore ce n'est **pas une régression** : l'étape n'avait jamais tourné.
Gate A échouait plus tôt, sur `format:check`, et sanctionnait tout le reste en
`skipped`. **Une gate placée avant les autres décide de ce qu'on apprend** — le
même énoncé que le §3, sur une autre gate, dans la même journée.

Corrigé en reformulant (« la PR 980 »), pas avec le marqueur `// hex-ok:` : ce
serait mentir au script sur la nature de la chaîne. Vérifié : seule occurrence du
motif dans `src/components` et `src/app`.

### 8.5 ⚠️ Non traité, et assumé

`sprint-a-user-journeys.spec.ts:21` — « Expected a Service JSON-LD schema on
Paris hub » — est **flaky** : passé au retry, il ne fait pas échouer le run. Il
est antérieur à cette branche. À instruire séparément, pas ici.

### 8.6 Ce qui part au run suivant

| Commit      | Contenu                                                   |
| ----------- | --------------------------------------------------------- |
| `6c7418bec` | `#980` → « la PR 980 » (Gate A, anti-hex)                 |
| `d57c579f3` | l'assertion E2E de l'attestation, **dérivée** de la table |

Contrôles locaux avant push : `typecheck` ✅ (bannière lue), `eslint` ✅ 0 erreur,
`format:check` ✅ glob complet, `check-anti-hex.sh` ✅, `playwright --list` ✅ sur
le fichier modifié.

---

## 9. Clôture de la journée — trois PR en production, et le même défaut trois fois

### 9.1 Ce qui a atterri

| PR        | Fusion    | Atterrissage | Contenu                                                                               |
| --------- | --------- | ------------ | ------------------------------------------------------------------------------------- |
| **#1003** | 09:41:23Z | 10:28:19Z    | split du budget, étape de budget déplacée, `bundle-check.mjs`, ADR 0049, 2 correctifs |
| **#1008** | 11:01:58Z | ~11:49Z      | le geste « Relancer la remise » que l'alerte prescrivait sans qu'il existe            |
| **#1010** | 12:55:25Z | en vol       | le libellé d'une alerte ouverte suit désormais la règle qui la produit                |

Durées de bout en bout mesurées : **51 min 39**, **46 min 56**, **47 min 38**. `AGENTS.md`
à ~50 min est juste ; le « 1 h 15 » qui circulait le matin venait d'une reprise non
mesurée.

✅ **Atterrissage vérifié jusqu'au schéma**, pas seulement à l'en-tête : les DEUX
conteneurs sur le même SHA, `[entrypoint] Migrations applied successfully`, et
`prisma migrate status` → « Database schema is up to date! » (224 migrations). C'est le
seul des trois contrôles qui pouvait démentir les autres.

✅ **La gate `lhci` post-deploy est VERTE** sur le run `34029062916` — elle échouait sur
`main` au réveil (run `33967996086`, `categories.performance` et
`first-contentful-paint`). ⚠️ Je ne l'attribue à rien : je n'ai pas mesuré la cause, et
cette gate bouge d'un run à l'autre (cf. `AGENTS.md`, « le TBT a bougé de +13 % à +36 %
sans qu'une ligne change »). C'est un fait, pas un résultat.

### 9.2 🔑 LE MÊME DÉFAUT, TROIS FOIS, SUR TROIS SURFACES SANS RAPPORT

C'est la leçon de la journée, et elle n'était écrite nulle part :

> **Une correction ferme le chemin nominal et laisse le stock derrière.**
> « Les prochains passeront-ils ? » et « ceux qui auraient dû passer passeront-ils ? »
> sont deux questions. On n'en pose qu'une.

1. **La remise d'exemplaire** (#997 → #1008). `transmettreExemplaireSigne` n'avait qu'un
   appelant : le crochet de complétion de signature. Une pièce signée AVANT la livraison
   n'y repasserait jamais — dont `AXI-DOC-2026-039`, la convention qui a motivé tout le
   correctif. Et l'alerte censée rattraper le cas **prescrivait un geste inexistant** :
   « Rouvrez la pièce et relancez la remise. »
2. **Le libellé des alertes** (#1010). `createMany({ skipDuplicates })` insère ou ne fait
   rien : une alerte ouverte garde pour toujours le titre du jour de sa création. Le titre
   corrigé le 05/09 n'a jamais atteint la prod.
3. **L'assertion E2E de l'attestation** (#1003). Le vocabulaire a été corrigé, ses deux
   témoins unitaires mis à jour, et l'assertion E2E laissée derrière — invisible parce que
   la suite était `skipped`.

### 9.3 🔑 ET UN SECOND MOTIF, AUSSI RÉCURRENT

> **Un témoin qui répond à une question VOISINE de celle qu'on pose.**

- « chaque motif trouve ≥ 1 fichier » reste **vert** sur `(admin)` nu, qui trouve 8 chunks
  de `api/admin/` et n'exclut aucun `page-*.js`. Le seul témoin qui discrimine est une
  **identité exacte** : la partition `5 + 186 + 311 = 502` ;
- `fs.globSync` rend **311** fichiers pour `(admin)` nu là où tinyglobby rend **0** : un
  contrôle bâti dessus aurait été vert sur la faute qu'il devait attraper ;
- « 0 `use client` ajouté » n'est pas « 0 octet ajouté » : #1004 a coûté 1,64 kB par un
  `next/link` (mesure d'`axion-ia-f1`, qui s'est corrigée elle-même) ;
- `mergeStateStatus` répond à « **peut**-elle fusionner ? », jamais à « **où** ? »
  (`axion-ia-40`). Une PR empilée reste pointée sur une branche morte en affichant `CLEAN`.

### 9.4 ⚠️ `cancel-in-progress` menace plus que le build d'un pair

Découvert en fin de journée : le run de déploiement reste `in_progress` **après**
l'atterrissage — `Lighthouse CI post-deploy` (~25 min) et `Warm edge cache` tournent
encore. Fusionner à ce moment-là les annule.

🔑 **« Le build est fini » n'est pas « le run est fini ».** Et ce qu'on perd alors est
précisément la seule gate de perf qui fasse autorité, sur la prod qui vient de changer.
#1010 a donc attendu la fin du run de #1008, alors qu'elle était verte depuis une heure.

### 9.5 Coordination — quatre sessions, zéro doublon, une disparition

- `axion-ia-f1` a tenu la file de fusion toute la matinée, puis **a disparu de
  `ListAgents`**. Sa réservation est morte avec elle. ⚠️ Une réservation de file ne survit
  pas à la session qui la porte : vérifier `ListAgents` avant de croire une file tenue.
- `axion-ia-6c` allait écrire une seconde fois le rattrapage de la remise ; arrêtée à
  temps. Elle a en échange **trouvé sur la prod** le défaut de #1010, que je n'aurais pas
  vu depuis le code.
- `axion-ia-40` a évité un rebase inutile de #1010 : après un squash, la PR empilée affiche
  les fichiers de sa base. **Comparer les empreintes** (`git hash-object`) plutôt que
  rebaser — les 4 fichiers étaient identiques.

### 9.6 ⛔ Reste Will

1. **facture / échéancier / TVA** — l'arbitrage TVA lui appartient, §11 de l'état vivant ;
2. la **recette PAR L'ÉCRAN** de la remise d'exemplaire : le bouton existe et est en prod,
   il n'a jamais été cliqué en vrai ;
3. le **lot F** au-delà de D6 ;
4. 🔴 **le cron d'émargement désarmé par une simple FABRICATION de jetons.** « Émettre les
   liens » crée des jetons sans rien envoyer, et la garde de `liens-emargement-j0` exclut
   toute session portant un jeton vivant : un clic désarme le cron pour toujours. C'est
   pourquoi une stagiaire n'a jamais reçu son lien. ⚠️ Le correctif évident (réémettre)
   **révoque les QR déjà imprimés**, c'est-à-dire le cas d'usage qui justifie « Émettre ».
   Chantier repris par `axion-ia-6c`. Le geste manuel, lui, **existe déjà** : le bouton
   « Envoyer les liens » fabrique un jeton neuf ET l'envoie.
