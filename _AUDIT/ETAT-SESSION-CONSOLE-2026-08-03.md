# État de session — revue complète de la console admin (2026-08-03)

> Document de reprise. Écrit pour qu'une autre session — ou moi-même après une
> fermeture inopinée — puisse reprendre sans rien redécouvrir.
> Dernière mise à jour : 2026-08-03, après ouverture de la PR #533.

---

## 1. Où en est le travail

| Élément | État |
|---|---|
| **PR #527** `fix/console-lot2` | ✅ **fusionnée** (squash `241e2cca`, 33 commits), **déployée et vérifiée en production** (conteneurs sur `241e2cca`, gate Lighthouse passé) |
| **PR #533** `fix/console-lot3` | ⏳ **ouverte**, 3 commits, gates en cours |
| Revue du **code** | ✅ terminée — ~250 constats de 6 audits, tous traités |
| Revue **à l'écran** | ✅ **terminée — 205 routes statiques sur 205** (2026-08-04) |
| Routes **dynamiques** (57) | ✅ couvertes par analyse statique — le balayage écran ne peut pas les ouvrir sans donnée réelle |
| Vérifications de bout en bout | ✅ deux passes complètes — voir §8 |
| Kill switch content-gen | 🔴 **armé**, à raison — voir §5 |

### Branche de travail

`fix/console-lot3`, worktree `axionia-wt-ui2026`.
⚠️ `origin/main` **bouge pendant la session** (d'autres conversations fusionnent).
Avant tout push : `git fetch && git diff --stat origin/main..HEAD` et vérifier
que le nombre de suppressions correspond à SON propre travail. Le 08-03, le diff
annonçait **2448 suppressions** sur des fichiers jamais touchés — un push aurait
effacé le travail des PR #531 et #532. Rebaser au moindre doute.

---

## 2. Ce qui a été corrigé (résumé)

### Défauts qui faisaient perdre ou corrompre des données

- **8 listes** annonçaient « page 1/12 » sans offrir la page 2.
- **Éditer un modèle « Page ville »** lui changeait son type en silence
  (`landing_ville` hors `CONTENT_TYPES` → le `<select>` retombait sur
  `blog_article`).
- **Cliquer un audit dans le planning → 404** (la route n'accepte que
  `formation` et `coaching`).
- **Une facture `en_retard` disparaissait de l'entonnoir** — 4ᵉ occurrence du bug
  que `statuts-facture.ts` documente déjà.
- **« Montant TTC (centimes) »** pré-rempli à 120000 : saisir le montant de la
  facture enregistrait cent fois moins. Passé en euros + conversion.
- **9 boutons de modération d'un avis** avalaient leurs erreurs.
- **`admin-badge-success/-danger/-muted` et `bg-cream` n'existent pas** → badges
  sans fond, blocs sans encadrement.

### Chiffres qui mentaient

Paliers de population faux · 6 compteurs affichant un plafond `take` comme total ·
« 13 régions » pour 19 · « ~0.0 $ » pour 3 centimes · « Durée estimée » toujours
égale à 30 · un barème compté à la fois actif et archivé.

### Langue

43 emojis (plafond du cliquet 44 → **1**, volontaire) · **~360 accords de
pluriel** au total · 11 textes coupés sans `title` · 4 en-têtes de colonne vides ·
JSON déversés en `<pre>` · enums bruts sur une quinzaine d'écrans.

### Trouvé UNIQUEMENT en production (PR #533)

- **171 des 262 pages admin portaient le titre du site marketing.** Le layout
  admin ne déclarait que `robots` ; sans `title`, la résolution remontait au
  `default` de `[locale]/layout.tsx`. **Invisible en lisant le code d'une page.**
- **4 correctifs PARTIELS de la PR #527** : `/infra` (« monitors » restait dans
  les libellés de coût), `/qualiopi/remuneration` (boutons corrigés, état vide
  non), `/newsletter` (en-tête traduit, filtre non), `/settings` (« Settings
  centralisés », « ROI simulator », 2 rôles bruts).

> 🔴 **Leçon** : un diff qui a l'air fini ne l'est pas. Seule la relecture à
> l'écran a montré ces quatre-là.

---

## 3. Ce qui a été délibérément NON corrigé

- **`engine/prompts.ts`** — invites envoyées au modèle : une réécriture change le
  comportement de génération, pas un affichage.
- **« Catégorie(s) d'actions certifiées »** — mention légale de la marque
  Qualiopi, la forme entre parenthèses fait foi.
- **`${nbInternes} (dirigeant(s) et salarié(s))`** — ce « (s) » décrit une
  CATÉGORIE, pas un décompte : l'accorder donnerait « 1 (dirigeant et salarié) ».
  Rendu invariant à la main.
- **Le méga-menu public dans le DOM de chaque page admin** — arbitrage **assumé
  et documenté** dans `[locale]/layout.tsx` : appeler `headers()` rendrait toutes
  les pages publiques dynamiques et casserait leur BF-cache et leurs scores
  Lighthouse. Ne pas « corriger ».

---

## 4. Méthode : ce qui marche et ce qui ment

### Le navigateur

🔴 **La géométrie n'est PAS accessible sur les pages de la console.**
`getBoundingClientRect()` renvoie 0 et `innerText` s'arrête à « Chargement de la
page admin » (494 caractères sur 11 305). Cause : la console est rendue DANS le
layout public, dont le `<main>` est masqué en CSS.
→ **Débordements et chevauchements ne sont pas mesurables en JS.**
→ Sur les pages PUBLIQUES, `getComputedStyle` fonctionne normalement.

✅ **Le seul canal fiable pour lire une page admin** :

```js
const c = document.body.cloneNode(true);
c.querySelectorAll("script,style,noscript,svg").forEach(n => n.remove());
const t = (c.textContent ?? "").replace(/\s+/g, " ");
```

🔴 `innerText` produit des **faux négatifs** sur tout ce qui est masqué en CSS.
J'ai écarté à tort un constat sur cette base avant de me corriger.

✅ **La capture d'écran est la vérité de terrain.** Elle ne composite pas les
images `loading="lazy"` — ne pas en conclure qu'elles manquent.

### Les tests

🔴 **Un test peut figer la faute.** Rencontré **trois fois** le 08-03 :
`toContain("4 heure(s)")`, `toContain("3 incident(s)")`, `"🟢 En ligne"`.
Un test qui fige une faute transforme sa correction en régression.

🔴 **Ne PAS « citer » un repli qui alimente une donnée PERSISTÉE.** La convention
`« valeur »` pour signaler l'inconnu est un choix d'AFFICHAGE. Appliquée à
`coachingInterventionLabel`, elle écrivait des guillemets dans l'intitulé figé
des documents AFEST.

### Les outils

- `npx prisma generate` **fonctionne** (note contraire périmée). Un `tsc` rouge
  sur un fichier non touché = client Prisma périmé après la fusion d'une autre
  PR — vérifier avec `git stash` que l'erreur préexiste.
- **Prettier en local** : `npx prettier --check --end-of-line auto "src/**/*.{ts,tsx}"`.
  Sans `--end-of-line auto`, le CRLF Windows flague TOUT et la vraie faute se noie.
- **Backticks dans un `node -e "…"` bash** = substitution de commande : des mots
  de commentaire sont mangés en silence. Écrire les scripts dans un `.cjs`.
- `gh pr merge --delete-branch` **échoue en local** (worktree sur `main`) mais
  **fusionne quand même** côté GitHub — vérifier `gh pr view N --json state`.
- Le moniteur de gates a donné **deux faux « VERT »** sur des timeouts TLS.
  Toujours revérifier avec `gh pr checks` avant de fusionner.

---

## 5. 🔴 Kill switch content-gen — instruit, NON désarmé

**Motif enregistré** : « Quota OpenAI toujours epuise », posé le 22/07, dernière
écriture 24/07 21h12 — une heure après le dernier d'une vague de **241 échecs**
`429 insufficient_quota`.

**Sondé en direct depuis le conteneur web de production le 08-03** :

- OpenAI → `credit_balance_exhausted`, « You have no credits remaining ».
  ⚠️ `/v1/models` répond **200** : la clé est valide, seul le crédit manque.
  Ne pas conclure sur le seul code 200.
- Anthropic → répond normalement.

**Pourquoi Anthropic ne sauve pas la mise** : `provider-router.ts` mappe
`text: [openaiProvider]` **en dur**, avec une décision écrite du 2026-07-09 :
« ⚠️ NE PAS remettre `anthropicProvider` ici sans accord explicite de Will »
(un fallback silencieux avait drainé 754 appels = 51,75 $).

🔴 **`provider_config` en base affiche `text → anthropic` : c'est TROMPEUR.**
La table porte le modèle et le plafond, PAS le routage.

**Ce qui dépend réellement d'OpenAI** : `text` = ~25 appelants (tous les
générateurs, juge qualité, fact-check, moteur Qualiopi, Observatoire).
`image` et `rerank` = **0 appelant** (les illustrations passent par Unsplash).
Les embeddings de dedup sont best-effort et désactivés par défaut.

**Tarifs** : gpt-4o 2,50 / 10,00 $ par million de jetons ; claude-sonnet-4-6
3,00 / 15,00 $ — soit +20 % en entrée, +50 % en sortie.

**Décision Will (08-03)** : « je rechargerai OpenAI plus tard ». Le switch reste
armé. Au rechargement : **désarmer depuis la console** (l'action écrit le journal
d'activité ; un `UPDATE` SQL le contournerait), puis surveiller la première vague.

---

## 6. Reste à faire

1. **Fusionner la PR #533** quand les 4 gates passent (ne pas utiliser
   `--auto` : il fusionne immédiatement dans ce dépôt).
2. **Reprendre la revue à l'écran** — ~150 vues. Le balayage a trouvé quelque
   chose sur presque chaque groupe abordé.
3. **Recharger OpenAI** → désarmer le kill switch → surveiller.
4. Décisions ouvertes déjà signalées une fois (donnée de test en production sur
   `/qualiopi/emails`, laquelle des trois colonnes de statut fait foi sur
   `/qualiopi/formations`).

---

## 7. Accès utiles

- Console : `https://axion-ia.com/fr/admin-xfz5hk0j7hrk`
- Production : `ssh axion-prod` · PG `u7zlql3bpb1xy5t4kg6jnvpm` (user/db `axionia`)
- Conteneur web : `mqbmlz1bcwsdwi3t9fxsllqt-*` · worker : `oqj5ugdxvdsc4lyp4acr6wqd-*`
- Build ≈ 25 min, déploiement ≈ 2 à 35 min, Gate C ≈ 35 min.
  **Fusionner EN LOT** : chaque fusion relance un build complet.

---

## 8. Fin de la revue (2026-08-04)

### Le balayage à l'écran est terminé

**205 routes statiques sur 205.** Méthode : depuis un onglet authentifié,
`fetch(route, {credentials:"same-origin"})` puis extraction du texte de la
charge RSC. Les pages admin étant lentes en concurrence, le balayage tourne
**détaché** dans la page (`window.__go`) et on relève le résultat ensuite — un
`await` direct dépasse le délai de 45 s du canal CDP.

🔴 **Le balayage ne couvre PAS les 57 routes dynamiques** (`[id]`, `[slug]`) :
il faut une donnée réelle pour les ouvrir. Elles ont été couvertes par analyse
statique du code — et c'est là qu'ont été trouvés les statuts rendus bruts
(planning, offre d'emploi, conversations du chatbot).

### Le défaut le plus grave n'était pas un défaut d'affichage

`/content-gen/settings/search-intent-distribution` affichait
« Somme actuelle : NaN % ». La cause : l'alias `commercial` ↔
`commercial_investigation` était **documenté mais jamais appliqué**.
La configuration de production stocke `commercial_investigation` ; l'orchestrateur
lit `intentDist.commercial`. **La part commerciale du mix d'intentions valait
donc zéro à la génération** — le « NaN » n'était que la face visible du trou.

Corollaire réparé au passage : `readContentGenConfig` renvoyait la ligne
stockée sous un transtypage non vérifié, donc **les valeurs par défaut ne
servaient QUE si la ligne était absente**, jamais si elle était mal formée.
47 appels partagent cette lecture.

> 🔴 **Leçon** : un « NaN » à l'écran n'est pas forcément un bug d'affichage.
> Remonter jusqu'à la donnée.

### Deux vérifications de bout en bout

| Contrôle | Résultat |
|---|---|
| `typecheck` | ✅ |
| `lint` | ✅ 0 erreur (36 avertissements préexistants) |
| `prettier --end-of-line auto` sur les fichiers modifiés | ✅ |
| `i18n` · `anti-siren` · `anti-hex` · `use-client` · `zod` · `contrast` · `radius` | ✅ |
| `admin-nav:routes-check` · `content-gen:isolation-check` | ✅ |
| Liens internes littéraux | ✅ aucun cassé (2 faux positifs vérifiés) |
| Noms accessibles des champs | ✅ aucun manquant (44 faux positifs écartés) |
| `catch {}` silencieux | ✅ aucun |
| Cliquet anti-emoji | ✅ tient |
| Suite de tests | 20 931 ✅ · **2 ❌** — voir ci-dessous |

🔴 **Les 2 échecs sont un artefact LOCAL, pas une régression.**
`src/app/api/calendly/client-event/__tests__/route.test.ts` ne bouchonne pas
`enrichCalendlyEvent` : sur ma machine le cas passant met 9,8 s (chemin réseau)
et entraîne le second. Fichier et route **identiques à `origin/main`**, aucune
de leurs dépendances dans le diff, et **les quatre gates de la PR passent** —
la CI exécute ce test.

### Ce qui a été relevé sans être corrigé

**Les tables de libellés sont massivement dupliquées** : `published: "Publié"`
dans 11 fichiers, `draft: "Brouillon"` dans 10, `en_cours: "En cours"` dans 10.
Chaque copie est aujourd'hui JUSTE — le risque est la dérive, pas une faute
présente. Les seules consolidées sont celles qui avaient DÉJÀ divergé et causé
un défaut (statut de facture, statut d'offre, statut de conversation, intention
de recherche). Consolider les quarante autres est un chantier distinct, avec un
vrai risque de régression pour un gain théorique.

`image-bank:isolation-check` et `qualiopi:isolation-check` sont rouges — ils ne
sont **pas** dans la CI (seul `content-gen:isolation-check` l'est). Rouges
chroniques, sans lien avec ce travail.
