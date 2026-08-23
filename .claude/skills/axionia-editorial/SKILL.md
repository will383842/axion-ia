---
name: axionia-editorial
description: Pièges et conventions de la console éditoriale d'Axion-IA (modèles Ed*, amorçage, import LinkedIn, calendrier). À charger avant toute intervention sur `src/server/editorial/**`, `prisma/seeds/editorial/**`, les modèles `Ed*` du schéma Prisma, ou les routes `/[adminPrefix]/console-editoriale/**`.
---

# Console éditoriale — ce qui coûte cher si on ne le sait pas

Compagnon de `_PLANS/PLAN-CONSOLE-EDITORIALE-2026-08.md` (le QUOI) et de
`_PLANS/PROTOCOLE-BUILD-CONSOLE-EDITORIALE.md` (le COMMENT). Ce fichier ne
répète ni l'un ni l'autre : il consigne **ce qui a réellement fait perdre du
temps**, avec la parade.

---

## 1. Les deux règles qui commandent le reste

> **La base fait foi.** Après l'import, les `.md` du dossier LinkedIn sont une
> archive gelée. Toute règle métier — seuil, liste fermée, motif — vit dans
> `ed_regles_conformite` / `ed_regles_alerte`, jamais dans le code. Le code ne
> porte que l'évaluateur.

> **Le modèle porte tout dès le lot 0 ; l'interface n'en montre qu'une
> fraction.** Ajouter un écran plus tard ne coûte rien. Rétro-ajouter un arbre
> de dérivation coûte une réécriture.

---

## 2. Prisma — les trois pièges de ce dépôt

### `prisma migrate dev` échoue en non-interactif

```
Error: Prisma Migrate has detected that the environment is non-interactive
```

**Parade** — le couple équivalent, scriptable :

```bash
npx prisma migrate deploy                       # applique l'existant
npx prisma migrate diff \
  --from-schema-datamodel <schema-de-main> \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/<horodatage>_<nom>/migration.sql
npx prisma migrate deploy                       # applique la nouvelle
```

### 🔴 Ne JAMAIS diffuser depuis `--from-schema-datasource`

Le schéma committé et les migrations **ont dérivé** sur `main`, et cette
dérive est normale : les index HNSW pgvector, les colonnes `vector` et
`tsvector` sont créés en SQL brut et Prisma ne sait pas les modéliser. Un
diff pris depuis la base produit donc **73 lignes de DDL destructif qui ne
sont pas les vôtres** :

```sql
DROP INDEX "articles_embedding_hnsw_idx";
DROP INDEX "knowledge_embeddings_hnsw_cosine_idx";
ALTER TABLE "keywords" DROP COLUMN "locked_by", DROP COLUMN "locked_until";
```

Les embarquer, c'est détruire la recherche sémantique en production au nom
d'un lot éditorial.

**Parade** : diffuser **schéma contre schéma** (`git show HEAD:prisma/schema.prisma`
dans un fichier temporaire, puis `--from-schema-datamodel`). Puis **vérifier
que le SQL produit ne contient aucun `DROP`** avant de l'installer :

```bash
grep -c 'DROP' prisma/migrations/<le-nouveau>/migration.sql   # doit rendre 0
```

### `prisma format` reformate les modèles voisins

Contrôler `git diff` après chaque `format` et restaurer le bruit — un lot
éditorial n'a rien à faire dans `SiteRoute`.

---

## 3. TypeScript — `noUncheckedIndexedAccess` est actif

`tsconfig.json` porte `strict` **et** `noUncheckedIndexedAccess`. Tout accès
indexé rend `T | undefined`, y compris `mesLignes[0]` juste après un
`if (mesLignes.length === 0) return`.

| Contexte             | Convention du dépôt                                 |
| -------------------- | --------------------------------------------------- |
| Code de production   | Un vrai garde : `const x = t[i]; if (!x) continue;` |
| Fichiers `*.spec.ts` | L'assertion non nulle : `expect(result[0]!.champ)`  |

---

## 4. Dates — le décalage d'un jour, deux fois

`EdPublication.datePrevue` est une colonne **`@db.Date`** : pas d'heure, pas
de fuseau. Prisma la rend à **minuit UTC**.

| Geste              | ❌ Faux                 | ✅ Juste                        |
| ------------------ | ----------------------- | ------------------------------- |
| Écrire une date    | `new Date(a, m - 1, j)` | `new Date(Date.UTC(a, m-1, j))` |
| Regrouper par jour | `dayKeyInParis(d)`      | `dayKeyOfGridDate(d)`           |

`new Date(2026, 8, 12)` construit à minuit **local** : depuis UTC+2, la
publication du 12 redescend au 11, et le critère « septembre aux bonnes
dates » échoue d'un jour — sans que rien ne signale l'erreur.

---

## 5. Expressions régulières — `\s` traverse les lignes

Bug réel, trouvé par un test, qui vidait le premier commentaire des **61**
publications :

```js
// ❌ `\s*` est gourmand ET contient le saut de ligne : le marqueur déborde
//    sur la ligne suivante et avale le commentaire qu'il devait introduire.
/^#{3,}\s*(?:premier\s+commentaire)\s*:?[^\n]*$/im

// ✅ borné à sa propre ligne
/^#{3,}[ \t]*(?:premier[ \t]+commentaire)[ \t]*:?[^\n]*$/im
```

**Règle** : dans un motif ancré par `^…$` en mode `m`, l'espace _intra-ligne_
s'écrit `[ \t]`, jamais `\s`.

### Les motifs de conformité s'évaluent en `i`, jamais en `u`

Aucun drapeau n'est stocké en base — c'est l'évaluateur qui les pose. Le
drapeau `u` durcirait les classes accentuées et ferait échouer des motifs
valides. Et `\b` est inutilisable aux bords accentués (JavaScript ne compte
pas `é` comme caractère de mot) : on borne en anti-recherche,
`(?<![A-Za-zÀ-ÿ0-9])…(?![A-Za-zÀ-ÿ0-9])`.

### Un faux positif coûte plus cher qu'un oubli

La liste `geo` écarte volontairement **Vienne** (subjonctif de « venir »),
**Ain**, **Metz**, **Nice**. Un détecteur qui rougit sur du texte sain apprend
à l'utilisateur à passer outre la règle — et la règle ne garde plus rien.

---

## 6. L'interface d'administration — le kit n'est pas celui du site public

`@/components/admin/ui` est **cloisonné** : importable seulement depuis
`src/app/[locale]/(admin)/[adminPrefix]/**` et `src/components/admin/**`.

Deux erreurs de props qui ne se voient qu'au typecheck :

| Primitive       | Piège                                                                |
| --------------- | -------------------------------------------------------------------- |
| `AdminCard`     | **Aucune prop `title`.** Le titre est un `<h2 className="admin-h2">` |
| `AdminBadge`    | Le ton neutre s'appelle **`neutral`**, pas `default`                 |
| `AdminStatCard` | Là, le ton neutre s'appelle bien `default`. Les deux diffèrent       |

**`MonthGridCalendar`** existe déjà : grille mensuelle RSC, zéro JS client,
navigation par querystring. Ne pas en réécrire une.

---

## 7. Budget de performance — la mesure est la seule garde

Les gates de bundle sont en `continue-on-error` : **une PR qui alourdit une
route ne rougira pas**. Les deux écrans du lot 0 sont donc entièrement des
Server Components, filtres compris (des liens, pas d'état client).

Avant/après, à la main, sur chaque route touchée.

---

## 8. Ce harnais d'agent — deux pièges d'outillage

| Piège                                                                 | Parade                                                                                                                                                |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Les heredocs bash mangent les antislashs**, même entre `<<'EOF'`    | Pour insérer un `\` dans un fichier : `String.fromCharCode(92)`, ou un remplacement **littéral** (`split`/`join`) sans jamais passer par une `RegExp` |
| **Python est absent de la machine**                                   | Les retouches passent par un script `.mjs` écrit puis exécuté, ou l'outil d'édition                                                                   |
| **`pnpm build` meurt en OOM** avec le tas Node par défaut (4 Go)      | `NODE_OPTIONS=--max-old-space-size=8192`, et bâtir comme la CI, avec les URL stub (ADR 0026) — voir §11                                               |
| **`pnpm test` dure ~21 min** (814 fichiers, `fileParallelism: false`) | Cibler pendant le développement : `npx vitest run src/server/editorial`                                                                               |

---

## 9. Windows — le démarrage rapide avale les activations en attente

Après un `DISM ... /norestart` qui rend **3010**, un « Arrêter » puis rallumer
produit un démarrage **hybride** qui ne traite PAS l'opération en attente.
Seul un vrai `shutdown /r` l'applique.

Le témoin qui fait foi — jamais le message de DISM :

```powershell
Test-Path C:\Windows\System32\vmcompute.exe   # doit être True
wsl --status                                  # ne doit plus parler de virtualisation
```

---

## 10. Amorçage et import — les invariants à ne pas casser

- **`pnpm editorial:seed`** est idempotent ET non destructif : il crée ce qui
  manque, ne réécrit **jamais** une valeur existante. Un seuil corrigé depuis
  la console survit à un rejeu du seed.
- **`pnpm editorial:import`** est idempotent par `refImport`, non répétable
  (marqueur `SiteSetting` `editorial.import.linkedin-2026-q4`), et
  **transactionnel** : une seule ligne fautive et **rien** n'est écrit.
- Le marqueur s'écrit **dans** la transaction — sinon un import échoué
  laisserait un marqueur qui ment.
- L'écho de page est une **seconde publication** liée par `sourceId`, pas une
  copie : deux diffusions, deux jeux de métriques.
- Une destination de lien inconnue (`newsletter`, dont la page n'existe pas
  encore) laisse `lienUrl` à `null` **et le signale**. On n'invente pas une
  URL : la règle `utm` bloquera la validation, et c'est le comportement voulu.

### Comptes de référence, après amorçage sur base vierge

| Objet                |                                 Compte |
| -------------------- | -------------------------------------: |
| Marques              |                                      2 |
| Comptes              |                                     11 |
| Familles d'assets    |                                      9 |
| Specs de plateforme  |                                      9 |
| Règles de conformité |                                     12 |
| Règles d'alerte      |                                     11 |
| Piliers              | **0** — décision §14 #4 ouverte, lot 1 |

Après import de la fixture : **61 publications + 13 reprises = 74**, 31 assets.
Septembre : **15** sur le profil personnel, 19 toutes identités confondues
(les 4 échos tombent aux mêmes dates).

---

## 11. `pnpm build` en local — deux réglages, sinon il meurt

Sur une machine 16 Go, `pnpm build` échoue à ~3 min 30 :

```
FATAL ERROR: Ineffective mark-compacts near heap limit
Allocation failed - JavaScript heap out of memory
Next.js build worker exited with code: 134
```

Ce n'est **pas** une régression du lot : c'est le tas Node par défaut (4 Go)
face à un projet de 17 629 routes. La baseline `build` n'avait jamais été
relevée sur cette machine, donc rien ne l'avait révélé.

**Les deux réglages, ensemble :**

```powershell
$env:NODE_OPTIONS='--max-old-space-size=8192'
# …et les URL stub de la CI (ADR 0026) : le SSG ne tape plus la base
$env:DATABASE_URL='postgresql://stub:stub@stub.invalid:5432/stub'
$env:DIRECT_URL=$env:DATABASE_URL
$env:REDIS_URL='redis://stub.invalid:6379'
$env:SKIP_ENV_VALIDATION='true'
$env:BULLMQ_DISABLED='true'
pnpm build
```

⚠️ Le build occupe alors ~6 Go et ne laisse qu'~1 Go libre : **ne rien lancer
d'autre pendant** — ni `pnpm test`, ni `tsc`. Un worker tué par manque de
mémoire produit un rouge qui n'a rien à voir avec le code, et le protocole
prévient déjà que « deux instances concurrentes produisent de faux échecs ».

---

## 12. Les tests E2E — quatre pièges, tous coûteux

### La fixture de connexion était morte (corrigée le 21/08/2026)

`tests/e2e/fixtures/admin-auth.ts` ne pouvait **pas** connecter :

- `getByLabel(/mot de passe/i)` résolvait **2** éléments — le champ ET le
  bouton afficher/masquer (`aria-label="Afficher le mot de passe"`). Mode
  strict ⇒ Playwright refuse d'agir. **Cibler `#email` / `#password`.**
- La vérification d'arrivée exigeait `/fr/${ADMIN_PREFIX}` ; l'application
  atterrit sur `/${ADMIN_PREFIX}`, **sans** préfixe de langue.

Tant que c'était cassé, tout test appelant `loginAsAdmin` se **sautait en
silence**. Si vous voyez « N skipped » sur un fichier admin, **ce n'est pas
normal** : vérifiez la connexion avant de croire à la couverture.

### Le serveur de dev compile à la première requête

En local, Playwright lance `pnpm dev` (`pnpm start` seulement en CI). La
première navigation vers une route admin peut dépasser **30 s**, et quatre
workers qui se la disputent échouent **tous**. Parade, encodée dans le spec :

```ts
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  testInfo.setTimeout(120_000);
});
```

### `getByText` est ambigu dès qu'un écran s'explique

`getByText(/règles de conformité/i)` matchait la tuile **et** la phrase du
bloc « ce que ce lot ne fait pas encore » qui la cite. Utiliser
`{ exact: true }` — le rouge venait du test, pas de la page.

### 🔴 `next dev` corrompt `.next/dev/types/routes.d.ts` s'il est tué

`tsconfig.json` **inclut** `.next/dev/types/**/*.ts`. Un serveur de dev tué
en pleine écriture y laisse un fichier tronqué, et `pnpm typecheck` explose
en **centaines** de `TS1005` qui n'ont rien à voir avec votre code :

```bash
rm -rf .next/dev && pnpm typecheck   # et tout redevient vert
```

Accessoirement, `next dev` **réécrit `AGENTS.md`** (bloc
`nextjs-agent-rules`). Le fichier le dit lui-même : le commiter avec le
travail garde l'arbre propre.

### Un admin pour les tests

`prisma/seed.ts` crée `admin@axion-ia.com` / `AdminAxion2026!` (2FA
désactivé). Les fixtures lisent `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` :

```powershell
$env:ADMIN_SEED_EMAIL='admin@axion-ia.com'; $env:ADMIN_SEED_PASSWORD='AdminAxion2026!'
npx playwright test <spec> --project=chromium --workers=1
```

Et `npx playwright install chromium` : les navigateurs ne sont pas installés
d'office sur cette machine — sans eux, **tous** les tests rougissent avec un
message qui ne parle que de téléchargement.
