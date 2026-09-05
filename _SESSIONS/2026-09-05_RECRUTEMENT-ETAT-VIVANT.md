# Session recrutement (`axion-ia-b5` / `axion-ia-84`) — état vivant au 2026-09-05

Fichier de reprise. Il dit ce qui est **fait et sécurisé**, ce qui **reste**, et
les commandes exactes pour finir.

---

## 0. L'essentiel en dix lignes

- **Branche `garde/route-admin-sans-entree-de-menu`**, partie de `main` à
  `e1ee5c6c5`. Un commit, poussé. **Rien n'est en l'air dans l'arbre.**
- Les **trois travaux du prompt sont FAITS** : sonde rejouée, garde réciproque
  posée et vérifiée-rouge, ordre `VIVIER_STOCK_ENABLED` écrit à côté du drapeau.
- **Il reste : ouvrir la PR, attendre les gates, fusionner.** Rien d'autre.
- La **file de fusion est LIBRE** : la session apporteurs l'a rendue en fermant.
- ⚠️ **#991 A ATTERRI** — prod sert `f62368221` (mesuré). Le run 33943260861
  restait `in_progress` pour le seul Lighthouse post-déploiement, qui vient
  APRÈS l'atterrissage. Ne pas l'attendre.

---

## 1. Ce qui est fait, et prouvé

### 1.1 La sonde de schéma, rejouée sur `e1ee5c6c5` — tout est passé

Lecture seule contre la base de production. Lignes 1 à 4 non-zéro, ligne 5
(migrations EN ÉCHEC) à 0, témoins positifs non-zéro : base = 1, table = 1,
`_prisma_migrations` finies = **220**, témoin négatif = 0. La FK `offer_id` est
bien passée en `SET NULL`. **L'entrypoint n'a rien avalé.**

🔴 **Un écart, et il était dans la sonde.** Le témoin de non-destruction
annonçait 86 et rendait **89**. Ni destruction ni duplication : la cohorte
d'avant la migration vaut exactement **86** (`submitted_at <` le `finished_at`
de `20260904010000_candidature_sans_offre`), plus 3 soumissions réelles
postérieures, 89 ids distincts, 0 orpheline. Mais il comptait la table
**vivante** — le défaut que le § 4 de cette même sonde dénonce trois lignes plus
haut. Il porte désormais sur la **cohorte gelée**, plus un témoin d'ancrage (sans
lui, une sous-requête `NULL` rendrait 0, qui se lirait comme une destruction
totale) et une ligne INFO pour le total vivant.

**Pour la rejouer :**

```bash
tr -d '\r' < scripts/ops/verif-schema-prod.sql \
  | ssh -o BatchMode=yes root@178.105.55.15 \
      'docker exec -i u7zlql3bpb1xy5t4kg6jnvpm psql -U axionia -d axionia -X -P pager=off'
```

### 1.2 La garde réciproque — et les « 12 à arbitrer » qui n'existaient pas

`admin-nav:routes-check` ne gardait qu'un sens. La troisième passe exige que
chaque route admin tombe dans une famille : **A** entrée exacte (153), **B**
segment dynamique (68), **C** sous-écran d'une section au menu (69), **D** page
de simple redirection (17), **E** exception motivée (**1**, `/login`).

🔴 **L'audit du 2026-09-04 s'était trompé.** `/console-editoriale`, ses dix
écrans et `/agenda` sont **vivants et épinglés en pied de barre latérale**, à la
demande explicite de Will (2026-08-26 pour l'agenda). Leurs deux `<Link href>`
étaient écrits **en dur dans `AdminSidebarNav.tsx`, hors de `buildAdminNav()`** :
la navigation admin avait DEUX sources et la garde n'en lisait qu'une. Le
correctif est une constante, `ADMIN_LIENS_EPINGLES`. **Le résidu réel tombe de
12 à 1.**

**Vérifiée-rouge**, et le test qui compte est le second :

| Injection                                     | Attendu       | Obtenu                                  |
| --------------------------------------------- | ------------- | --------------------------------------- |
| un vrai écran sans entrée de menu             | ROUGE         | ✅ `1 route sans aucune entrée de menu` |
| **la même route**, corps = simple redirection | VERT, D +1    | ✅ vert, famille D 17 → 18              |
| `ADMIN_ROUTES_EPINGLEES` neutralisée          | ROUGE avec 12 | ✅ **exactement les 12 de l'audit**     |

Le tout figé dans `tests/unit/ci/route-admin-sans-entree-de-menu.spec.ts`
(5 tests, tous verts, ~110 s — chaque cas lance la vraie commande en
sous-processus).

⚠️ **Piège rencontré en écrivant ce test** : le dossier témoin s'appelait
`__temoin-…`. Next traite `_x` comme un dossier PRIVÉ, la garde l'ignore — le
test rendait donc vert en croyant prouver que la garde rougit. **Un témoin ne
prouve rien s'il est invisible à l'outil qu'il éprouve.**

### 1.3 `VIVIER_STOCK_ENABLED` — la décision est écrite à côté du drapeau

Dans `src/server/vivier/config.ts` au-dessus de `isVivierStockEnabled()`, et
dans l'**ADR 0047 § 4 bis**. Mesuré le 2026-09-05 sur les **deux** conteneurs :

| Drapeau                       | Valeur          | Effet                                             |
| ----------------------------- | --------------- | ------------------------------------------------- |
| `VIVIER_STOCK_ENABLED`        | **non définie** | 🛑 la campagne d'information REFUSE de s'exécuter |
| `CRM_SYNC_CANDIDATES_ENABLED` | `true`          | ouvert — sans effet tant que le premier est fermé |
| `CRM_SYNC_ENABLED`            | `true`          | ouvert — sans effet tant que le premier est fermé |

---

## 2. Ce qui reste — trois gestes

1. **Ouvrir la PR** (corps prêt, voir § 3).
2. **Attendre les 4 gates.** Lire `mergeStateStatus` ET fusionner dans le MÊME
   appel — jamais sur `UNKNOWN`.
3. **Fusionner**, après `gh run list --workflow=deploy-coolify.yml --limit 1`.

---

## 3. Vérifications déjà passées

| Contrôle                      | Résultat                                  |
| ----------------------------- | ----------------------------------------- |
| `pnpm typecheck`              | ✅ exit 0 (bannière `> tsc --noEmit` lue) |
| `pnpm lint`                   | ✅ exit 0, 73 avertissements préexistants |
| `pnpm admin-nav:routes-check` | ✅ les deux passes vertes                 |
| la nouvelle spec, isolée      | ✅ 5/5                                    |
| sonde de schéma en production | ✅ lecture seule, tous témoins            |

⚠️ **La suite complète n'a PAS rendu de verdict** : `pnpm exec vitest run` a été
**tué par saturation mémoire** de la machine, deux fois (c'est le mode d'échec
documenté au § 10 de `2026-09-04_RECRUTEMENT-pilotage.md`, pas un rouge). À
rejouer par lots bornés avant de fusionner :

```bash
pnpm exec vitest run --maxWorkers=1 --minWorkers=1 tests/unit/ci
pnpm exec vitest run --maxWorkers=1 --minWorkers=1 tests/unit/a11y tests/unit/e2e-harness
pnpm exec vitest run --maxWorkers=1 --minWorkers=1 src/lib/admin-nav.test.ts src/server/vivier
```

👉 Ou simplement laisser la CI trancher : elle joue la suite entière, et c'est
son verdict qui compte.

---

## 4. État des autres sessions, au moment de la fermeture

- **Session apporteurs (`axion-ia-ce`) — FERMÉE.** Elle a **rendu la file**.
  #987 : les 4 gates vertes, non fusionnée. #993 (trou de gate `branches:` sur
  `pull_request`) : A et D vertes. Pile #989/#990/#992 **non rebasée**, compteur
  d'entrées de nav à **166** (pas 167 : #992 porte une copie de l'entrée de
  #986). Branche de plus poussée : `feat/reponse-en-masse` (`23eb059d8`). Son
  état vivant : `_SESSIONS/2026-09-05_SESSION-4-CAPTURE-ETAT-VIVANT.md`.
- **Session Qualiopi (`49e2ba70`)** : #991 fusionnée et **atterrie**. Ses écrans
  à venir sous `/qualiopi/**` tombent en famille B ou C — aucun conflit avec ce
  lot.
- **Session Axion Partners (`axion-ia-ec`)** : dépôt `axion-apporteurs`, ne
  consomme pas cette file.

⚠️ **Aucun hunk ne croise le mien** : `ADMIN_LIENS_EPINGLES` est posée AVANT
`buildAdminNav()` (~ligne 345), les hunks de la pile apporteurs sont à 534 et
1601, et `src/lib/admin-nav.test.ts` n'est PAS touché par ce lot.

---

## 5. Deux pièges mesurés, à ne pas repayer

- **`prisma generate` est PAR ARBRE.** Le typecheck a rendu 3 erreurs dans
  `src/server/qualiopi/**` qui semblaient accuser une PR : c'était le client
  Prisma périmé de ce worktree. `pnpm prisma:generate` d'abord, toujours.
- **Un `git commit` peut échouer sur commitlint tout en rendant `exit 0`** si un
  `git log` le suit dans la même chaîne `;`. **Lire la ligne `[branche sha]`,
  jamais le code de sortie.**
