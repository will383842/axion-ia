# PROTOCOLE D'EXÉCUTION — construction de la console éditoriale

_Compagnon de `PLAN-CONSOLE-EDITORIALE-2026-08.md`. Écrit le 20 août 2026._

**Ce document dit COMMENT on construit. Le plan dit QUOI.** Un lot livré sans respecter ce protocole n'est pas livré.

---

# 1. LE PRINCIPE QUI COMMANDE TOUT

> **Une garde ne vaut que si elle rougit sur l'objet qui casse.**

Ce dépôt en a déjà fait l'expérience : une gate de conformité mesurait un fichier de configuration pendant que le conteneur en production tournait avec une autre valeur. Elle était verte, et elle ne gardait rien.

Corollaires, tous vérifiés dans ce dépôt :

| Leçon                                                                                      | Conséquence pratique                                                                 |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **Un témoin négatif ne vaut rien** tant qu'on n'a pas vérifié qu'il _devrait_ être positif | Avant de célébrer un test vert, casse volontairement le code et vérifie qu'il rougit |
| **La détection mécanique produit des faux positifs**                                       | Un détecteur qui signale 53 défauts sur 61 se trompe. **Lire avant de rapporter**    |
| **« Ça marche » n'est pas un rapport**                                                     | On donne la commande lancée et sa sortie                                             |
| **La CI évalue le commit de fusion**, pas la branche                                       | Deux PR vertes séparément peuvent casser une fois fusionnées                         |
| **Deux instances de tests concurrentes produisent de faux échecs**                         | Jamais deux suites en parallèle sur la même base                                     |

---

# 2. LA HIÉRARCHIE D'AGENTS

Un seul agent qui code tout produit du code cohérent et **non vérifié** — il ne peut pas être son propre contradicteur. La séparation des rôles est la garde.

```
                    ARCHITECTE  (1)
                   décide, découpe, arbitre
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   IMPLÉMENTEURS     VÉRIFICATEURS      ADVERSAIRE
      (2 à 4)           (2 à 3)            (1)
   codent un lot     testent, mesurent   cherche à casser
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
                     INTÉGRATEUR (1)
                  fusionne, mesure, décide
```

| Rôle             | Mission                                                                             | Ce qu'il n'a PAS le droit de faire |
| ---------------- | ----------------------------------------------------------------------------------- | ---------------------------------- |
| **Architecte**   | Découpe le lot en tâches indépendantes, arbitre les conflits de modèle              | Coder                              |
| **Implémenteur** | Une tâche, un fichier ou un écran. Tests inclus                                     | Valider son propre travail         |
| **Vérificateur** | Rejoue les critères d'acceptation **sans lire le code de l'implémenteur**           | Corriger — il signale              |
| **Adversaire**   | Cherche activement à faire échouer : entrées limites, concurrence, données absentes | Être conciliant                    |
| **Intégrateur**  | Fusionne, mesure le poids, rejoue la suite complète, décide livré / rejeté          | Livrer sans mesure                 |

**Règle absolue** : **l'implémenteur d'une tâche ne peut jamais en être le vérificateur.** Un agent qui vérifie son propre travail confirme ses propres hypothèses.

---

# 3. LES SIX PASSES DE VÉRIFICATION, PAR LOT

Aucune n'est facultative. Un lot qui échoue à une passe **revient à l'implémenteur**, il n'avance pas.

### Passe 1 — Mécanique

`pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`
**Attendu** : zéro erreur nouvelle. ⚠️ _Relever d'abord l'état de référence sur `main` — une erreur préexistante n'est pas la tienne, et l'attribuer fait perdre une heure._

### Passe 2 — Critères d'acceptation

Chaque case du §7 du plan est rejouée, **une par une**, par un vérificateur qui n'a pas écrit le code. Chaque case cochée s'accompagne de la commande ou du geste effectué.

### Passe 3 — Interface, par le navigateur

Tests Playwright sur les parcours du lot. Le dépôt a déjà Playwright.
**Obligatoire pour chaque écran** :

- le parcours nominal
- **l'état vide** — il explique quoi faire, il n'affiche pas « aucun résultat »
- **l'état d'erreur** — le serveur répond 500, l'écran ne blanchit pas
- **l'état de chargement** — squelette aux bonnes dimensions, **aucun décalage de mise en page**
- **la navigation entièrement au clavier**, sans souris

### Passe 4 — Adversariale

L'agent adversaire tente, systématiquement :

- une publication sans compte, sans date, avec une date passée
- un texte contenant chaque interdit de conformité, **un par un**
- une URL sans UTM, une URL avec un seul UTM
- un asset dont la durée dépasse la spec de deux secondes
- un épisode dont l'autorisation est `envoyee` et non `signee`
- deux utilisateurs modifiant la même publication en même temps
- un import rejoué deux fois
- un arbre de dérivation profond de cinq niveaux
- un rôle `montage` tentant chaque action interdite du §4

**Chaque tentative doit être refusée avec un message qui cite la règle.** Un refus silencieux est un échec.

### Passe 5 — Croisée

Un second vérificateur **rejoue la passe 2 sans lire le rapport du premier**, et les deux rapports sont comparés. Une divergence est un signal : l'un des deux s'est trompé, ou le critère est ambigu.

### Passe 6 — Bout en bout, sur le lot cumulé

Pas seulement le lot courant : **tous les lots depuis le début**. Un import + un calendrier + une validation + une programmation + un relevé, à la suite, sur une base vierge.
Plus : `pnpm build` puis **mesure du First Load par route**, consignée dans la PR avec l'écart au lot précédent.

---

# 4. CE QUE « PRODUCTION READY » VEUT DIRE, EXACTEMENT

Un lot n'est livré que si les **onze** points sont vrais. Pas dix.

- [ ] Les six passes sont vertes, chacune avec sa preuve
- [ ] Aucune erreur de typage ni de lint **nouvelle** par rapport à `main`
- [ ] La suite complète passe — **et l'état de référence de `main` a été relevé avant**
- [ ] Les critères d'acceptation du lot sont cochés par quelqu'un qui n'a pas codé
- [ ] Le poids de chaque route touchée est **mesuré et consigné**
- [ ] Toute mutation est journalisée dans `EdJournal`
- [ ] Toute règle métier vit **en base**, pas dans le code — un test le vérifie
- [ ] Les états vide, erreur et chargement existent sur chaque écran
- [ ] La migration Prisma s'applique sur une **base vierge** et sur une **base existante**
- [ ] Le rollback est décrit : que faire si le lot casse en production
- [ ] Le skill `axionia-editorial` est à jour des pièges rencontrés

---

# 5. LES TESTS — CE QUI EST OBLIGATOIRE

| Objet                          | Type                                                    | Pourquoi                                             |
| ------------------------------ | ------------------------------------------------------- | ---------------------------------------------------- |
| **Chaque règle de conformité** | unitaire, **deux cas** : passe et refuse                | Une règle sans cas négatif ne garde rien             |
| **Chaque règle d'alerte**      | unitaire, au seuil et **juste sous le seuil**           | C'est la limite qui casse, pas le centre             |
| **L'import**                   | intégration : vierge, rejoué, avec ligne fautive        | Le rejeu est le cas réel                             |
| **Les transitions de statut**  | unitaire, dont **toutes les transitions interdites**    | Trois statuts = beaucoup de combinaisons             |
| **La matrice de permissions**  | intégration, **un test par cellule refusée**            | Une permission non testée est une permission absente |
| **L'arbre de dérivation**      | unitaire, profondeur 3, et **cycle refusé**             | Un cycle bloque l'application entière                |
| **Chaque écran**               | Playwright : nominal, vide, erreur, chargement, clavier | Voir passe 3                                         |
| **Le parcours complet**        | Playwright, sur base vierge                             | Voir passe 6                                         |

> 🔑 **Le test qui compte est celui du cas refusé.** Un test qui ne vérifie que le succès ne prouve rien : il passerait aussi si la garde était supprimée.

---

# 6. LES PIÈGES DE CE DÉPÔT — connus, documentés, coûteux

| Piège                                                  | Ce qui se passe                                               | Parade                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| **`pre-commit` lance un typecheck complet**            | Une erreur ailleurs bloque ton commit                         | Relever l'état de `main` avant de commencer                         |
| **Client Prisma périmé**                               | Erreurs de type incompréhensibles sur des modèles non touchés | `npx prisma generate` **et commiter dans la même commande chaînée** |
| **`commitlint` refuse une majuscule en tête de sujet** | Commit rejeté                                                 | Sujet en minuscule                                                  |
| **CRLF sous Windows**                                  | Un test statique cherchant `\n` échoue en local, passe en CI  | Normaliser avant toute comparaison de motif                         |
| **`pre-push` dure ~35 minutes**                        | Une tâche de fond est tuée et produit un faux rouge           | Moniteur persistant, jamais une tâche de fond                       |
| **Gates de budget en `continue-on-error`**             | Une PR qui alourdit le bundle ne rougit pas                   | Mesurer à la main, toujours                                         |
| **Tests concurrents sur la même base**                 | Faux échecs par couplage d'ordre                              | Une seule suite à la fois                                           |
| **`git stash` est global au dépôt**                    | `lint-staged` peut effacer la remise d'une autre session      | Ne jamais éditer un fichier pendant qu'un hook tourne               |

**Chaque nouveau piège rencontré s'ajoute ici et dans le skill.** C'est ce qui évite de le repayer.

---

# 7. LA BOUCLE, LOT PAR LOT

1. **L'architecte** relit le plan, découpe le lot en tâches **indépendantes** — pas de tâche qui attend une autre
2. **Les implémenteurs** codent en parallèle, chacun avec ses tests
3. **L'intégrateur** rassemble et lance la **passe 1**
4. **Les vérificateurs** lancent les **passes 2 et 3**, sans lire le code
5. **L'adversaire** lance la **passe 4** et cherche à casser
6. **Un second vérificateur** lance la **passe 5**, à l'aveugle du premier
7. **L'intégrateur** lance la **passe 6**, mesure, et **décide** : livré ou renvoyé
8. Si livré : PR, revue humaine, fusion. **Le skill est mis à jour.**
9. **Rapport de lot** : ce qui a été fait, ce qui a été vérifié et comment, ce qui reste ouvert, ce qui a surpris

> ⚠️ **On ne passe pas au lot suivant tant que le précédent n'a pas ses onze points.** Un lot « presque fini » qu'on laisse derrière soi devient une dette qu'on ne revoit jamais.

---

# 8. CE QUI DOIT REMONTER À L'HUMAIN, TOUJOURS

L'autopilote s'arrête et demande dans cinq cas :

1. **Une décision du §14 du plan** est nécessaire pour avancer
2. **Le modèle de données doit changer** après le lot 0 — une migration destructrice ne se décide pas seule
3. **Un critère d'acceptation est ambigu** — on ne l'interprète pas, on le fait préciser
4. **Une passe échoue trois fois** sur la même cause — s'acharner coûte plus cher que demander
5. **Une règle de conformité ou de droit** est en jeu : autorisation, RGPD, formulation interdite

Dans tous les autres cas, l'autopilote décide, agit, et **rend compte avec ses preuves**.
