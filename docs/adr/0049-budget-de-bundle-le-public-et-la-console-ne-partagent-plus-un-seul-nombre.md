# ADR 0049 — Budget de bundle : le public et la console d'administration ne partagent plus un seul nombre

- **Statut** : **ACCEPTÉ** — tranché en session le 2026-09-06, sous mandat autopilot de Will
- **Date** : 2026-09-06
- **Auteur** : Claude, en débloquant la PR #1003 du chantier Qualiopi
- **Référence** : `package.json` (section `size-limit`), `scripts/ci/bundle-check.mjs`, `.github/workflows/ci.yml` (étape « Poids du bundle »), `tests/unit/ci/budget-public-et-admin-sont-separes.spec.ts`, `tests/unit/ci/size-limit-buckets.spec.ts`, `tests/unit/ci/poids-du-bundle-garde-vraiment.spec.ts`, `AGENTS.md` (« Performance budget »)

## Pourquoi cet ADR existe

`AGENTS.md` exige un ADR pour tout patch qui touche aux seuils de performance. Celui-ci
en change deux, en crée un troisième et déplace la gate dans le pipeline. Il documente
aussi une méthode qui a failli passer pour une preuve.

## 1. Le constat — un budget public occupé aux deux tiers par des écrans authentifiés

Un unique bucket `size-limit` sommait **tous** les `page-*.js` hors `/appel`, sous le nom
« cliquet anti-croissance », avec une limite de 703 KB. Sa raison d'être est le budget
Web Vitals d'`AGENTS.md`, qui porte sur les **15 pages stratégiques** — donc sur le
public.

Mesuré en séparant les deux populations, sur un seul et même build :

| Population                      | Chunks  | Poids brotli  |
| ------------------------------- | ------- | ------------- |
| pages publiques                 | 186     | **254,36 kB** |
| `/appel` (exception documentée) | 5       | 14,84 kB      |
| console d'administration        | 311     | **452,01 kB** |
| **total du bucket unique**      | **502** | **706,37 kB** |

**Les deux tiers d'un budget de performance publique étaient occupés par des écrans que
personne ne télécharge sans être authentifié, et qu'aucune mesure Lighthouse ne
regarde.** Le seuil unique était faux dans les deux sens à la fois :

- **trop lâche là où il comptait** — à 703 kB pour un public mesuré à 254 kB, le paquet
  public pouvait presque **tripler** sans que rien ne rougisse ; pendant ce temps la gate
  `lhci` post-deploy, la seule qui fasse autorité selon `AGENTS.md`, **échouait déjà** sur
  la prod (run `33967996086` : `categories.performance` et `first-contentful-paint`) ;
- **bloquant là où il ne comptait pas** — trois formulaires d'administration (+3,44 kB)
  fermaient une PR de 30 commits.

C'est aussi ce qui explique les recalages **700 → 702 → 703 en une seule journée**, par
trois sessions différentes : elles livraient toutes de l'admin. Un seuil qu'il faut
relever à chaque fonctionnalité d'administration finit en formalité. **Le défaut n'était
pas l'indiscipline des sessions, c'était la forme du bucket.**

## 2. La décision

Le bucket unique est scindé en deux, et la partition devient un invariant vérifié :

| Bucket                                | Mesure    | Cliquet    | Marge |
| ------------------------------------- | --------- | ---------- | ----- |
| `SOMME des page chunks PUBLICS`       | 254,36 kB | **265 KB** | 4,2 % |
| `SOMME des page chunks CONSOLE ADMIN` | 452,01 kB | **470 KB** | 4,0 % |

- le bucket public **exclut** `/appel` (déjà excepté par `AGENTS.md`) **et** le groupe de
  routes `(admin)` ;
- le bucket admin porte dans son NOM la mention « hors budget Web Vitals (écrans
  authentifiés) », pour qu'un lecteur pressé ne lise pas 470 KB comme une dette de
  performance publique et n'aille pas « réduire » des écrans que personne ne mesure ;
- les deux cliquets sont calés **au-dessus de la mesure**, doctrine `AGENTS.md` déjà
  appliquée au shell partagé le 2026-08-24 : on aligne le seuil sur la mesure, **puis**
  on bloque.

Le budget public devient donc **2,7 fois plus strict** qu'avant (703 → 265 KB pour la
même population). Ce n'est pas un assouplissement déguisé : c'est l'inverse.

## 3. La gate change de PLACE, jamais de force

L'étape « Poids du bundle » était placée **avant** les trois étapes qui prouvent que le
produit fonctionne. Sur le run `33989952957` :

```
failure  Poids du bundle
skipped  Migrer et semer la base E2E
skipped  Prouver que le build de production a survécu
skipped  Playwright suite
```

**Un dépassement de 2,9 kB a supprimé tout le signal fonctionnel** : 37 min de CI payées
pour apprendre un décompte d'octets, et rien sur 30 commits dont des migrations et sept
règles d'alertes.

L'étape est déplacée **après** la suite E2E, avec `if: ${{ !cancelled() }}` — obligatoire,
et exigé par `tests/unit/ci/gate-b-a-ses-services.spec.ts` de toute étape postérieure à
la suite. Sans lui on retomberait dans le défaut symétrique : on saurait que le produit
est cassé, plus jamais ce que pèse le paquet.

Elle **bloque toujours** : pas de `continue-on-error` (verrouillé par
`tests/unit/ci/poids-du-bundle-garde-vraiment.spec.ts`). Ce qui change est **quand** on
l'apprend, jamais **si** elle compte. Entre « le paquet a grossi de 2,9 kB » et « la
console ne s'ouvre plus », le second doit toujours être connu ; le premier ne doit jamais
empêcher de l'apprendre.

## 4. 🔴 Le piège de forme, et la garde qui a failli ne rien garder

Le groupe de routes de Next s'écrit `(admin)`, avec des parenthèses. Écrites nues dans un
motif `size-limit`, elles ne sont pas des caractères littéraux. Mesuré motif par motif sur
un même build :

```
chunks/app/**/(admin)/**/page-*.js        →   0 fichier
chunks/app/**/[(]admin[)]/**/page-*.js    → 311 fichiers  (452,01 kB)
chunks/app/**/(admin)/**                  →   8 fichiers  ← et c'est là que ça se joue
```

La forme retenue est donc **`[(]admin[)]`**, des deux côtés.

**Le cas dangereux n'est pas celui qu'on croit.** Sur une _inclusion_, `size-limit` le dit
et sort en 1 (« Size Limit can't find files at … ») : on l'apprend tout de suite. Sur une
_négation_, rien n'est exclu **et rien n'est dit** — le bucket public ré-avale la console
en silence et le budget public redevient la fiction qu'on vient de retirer.

Et la troisième ligne ci-dessus explique pourquoi un contrôle naïf ne suffit pas : les
parenthèses nues ne sont pas ignorées, picomatch les lit comme un groupe, donc le motif
désigne le répertoire littéralement nommé `admin` — `chunks/app/api/admin/`, qui porte
8 chunks de route handlers. **Une exclusion cassée trouve donc 8 fichiers, dont aucun
n'est un `page-*.js` : elle satisfait n'importe quel contrôle « au moins une
correspondance » tout en n'excluant rien du tout.** Le premier jet de la garde de mesure
a été éprouvé par mutation et est resté vert sur exactement cette faute.

## 5. Ce que le contrôle de mesure vérifie désormais

`pnpm bundle:check` ne lance plus `size-limit` nu mais `scripts/ci/bundle-check.mjs`, qui
mesure d'abord et laisse ensuite `size-limit` faire son travail :

1. **chaque motif de chaque bucket correspond à ≥ 1 fichier**, sinon `exit 1` en nommant
   le bucket, le motif et son sens (inclusion / EXCLUSION). C'est le trou que
   `tests/unit/ci/size-limit-buckets.spec.ts` déclare dans son en-tête ne pas savoir voir
   depuis juin — il ne peut vérifier que l'invariant sans build ;
2. **la partition des `page-*.js` est exacte et exhaustive** : `/appel` + public + admin
   couvrent tous les chunks de page, et aucun n'est compté deux fois. C'est le seul
   contrôle qui **discrimine** la faute des parenthèses nues (sous mutation :
   5 + 497 + 311 = 813 pour 502 chunks, 311 comptés deux fois) ;
3. le moteur de globs est **`tinyglobby` résolu depuis `size-limit` lui-même**. Le premier
   jet utilisait `fs.globSync` de Node, qui rend **311 fichiers** pour `(admin)` en
   parenthèses nues parce que le glob de Node traite `(` comme un littéral : un contrôle
   bâti dessus aurait été vert sur la faute exacte qu'il doit attraper. Contrôle et mesure
   ne peuvent plus diverger — même moteur, même version, même `cwd` ;
4. un **témoin positif** : le nombre de fichiers par motif et les trois parts de la
   partition sont imprimés, et un total nul est nommé « aucun build à mesurer » plutôt que
   confondu avec un motif mort.

Les deux contrôles ont été éprouvés par mutation, et rougissent tous les deux.

### Effet de bord : deux motifs morts depuis leur écriture

Le contrôle a immédiatement trouvé deux motifs incapables **par construction** de
correspondre : `gallery/**` (bucket `/galerie`) et `locations/**` (bucket
`/implantations`). Ce sont des alias `pathnames` de next-intl, réécrits au runtime : ils
n'ont jamais de répertoire propre dans l'App Router, donc jamais de répertoire de chunks.
Ils étaient verts depuis le jour de leur écriture, noyés dans un bucket dont l'autre
inclusion, elle, correspondait.

Ils sont **retirés**, avec la raison consignée dans `package.json`
(`_size_limit_alias_note`). **Ne pas les remettre à la réactivation du locale EN** : le
chemin de chunk vient de l'arborescence de fichiers, jamais du pathname localisé.

`tests/unit/ci/size-limit-buckets.spec.ts` ne pouvait pas les voir non plus : son
inventaire des segments connus lit les `pathnames` de `routing.ts`, donc `gallery` et
`locations` y figurent — comme routes, ce qu'elles sont ; comme répertoires de chunks, ce
qu'elles ne seront jamais.

## 6. Conséquences

- Une PR qui livre de l'administration ne fait plus rougir un budget public. Une PR qui
  alourdit le public rougit à **4 % de marge**, plus à 177 %.
- Deux cliquets à tenir au lieu d'un — et ils se recalent, comme avant, **sur une mesure**,
  jamais sur un souhait.
- La suite E2E redevient joignable même quand le budget dépasse.
- Le budget **par route** (≤ 75 KB gz, `AGENTS.md`) reste **non mesuré** : `size-limit`
  somme, il ne sait pas exprimer un budget par route sur un glob. Rien ici ne le corrige,
  et cet ADR ne prétend pas le contraire.

## 7. Ce qui a été rejeté

- **Relever le cliquet unique à 706 KB.** Quatrième recalage en une journée. Traite le
  symptôme, laisse le public dilué dans l'admin, et rend le geste obligatoire à chaque
  écran d'administration livré.
- **Retirer la gate le temps de fusionner.** `AGENTS.md` interdit explicitement de
  repasser des gates bloquantes en non bloquantes, et la mémoire du dépôt tient le compte
  des gates devenues muettes.
- **Un budget par route calculé à la main.** Utile, mais c'est un autre chantier ; le
  mélanger à celui-ci aurait rendu les deux illisibles.

## 8. Comment revenir en arrière

Fusionner les deux buckets en un seul, remettre la limite à 706 KB, retirer l'entrée
`PARTITION.parts` correspondante de `scripts/ci/bundle-check.mjs`, et supprimer
`tests/unit/ci/budget-public-et-admin-sont-separes.spec.ts`. Le faire **sans** supprimer
ce dernier laisserait la CI rouge — c'est voulu : la garde est le verrou de cet ADR.
