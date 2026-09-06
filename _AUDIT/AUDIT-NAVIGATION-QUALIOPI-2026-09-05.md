# Audit NAVIGATION de la console Qualiopi — 2026-09-05

> ⏳ Rédigé **au fil de l'eau**. Si ce fichier s'arrête net, l'agent est mort :
> lire ce qui est écrit, ne pas lire l'absence comme « rien à signaler ».
> Dernière écriture : voir la section (7).

Question unique à laquelle ce document répond :

> **Quelqu'un qui doit accomplir une tâche peut-il ARRIVER jusqu'à l'écran qui
> la porte, et REVENIR ?**

---

## (0) Méthode et limites

### Ce que j'ai pu vérifier

- **Lecture statique du code seulement.** Aucun serveur, aucun navigateur,
  aucun rendu observé. Tout ce qui suit est dérivé du code source.
- Périmètre balayé :
  - `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/**` — **66 fichiers
    `page.tsx`** (compté par `find … -name page.tsx | wc -l`, recompté par
    `find … | sed | sort | wc -l` : même chiffre).
  - `src/app/[locale]/portail/**` — 9 `page.tsx` + 2 `route.ts`.
  - `src/app/[locale]/espace-formateur/**` — 7 `page.tsx` + 1 `route.ts`.
  - `src/lib/admin-nav.ts` (`buildAdminNav`), `…/[adminPrefix]/layout.tsx`,
    `src/components/admin/ui/AdminSidebarNav.tsx`,
    `…/[adminPrefix]/AdminCommandPalette.tsx`.

### Les TROIS sources de navigation admin — pas deux

Le piège annoncé dans mon mandat parlait de deux sources. Il y en a **trois**,
et la troisième est inoffensive :

| # | Source | Preuve | Portée |
|---|---|---|---|
| 1 | `buildAdminNav(adminPrefix)` | `src/lib/admin-nav.ts` | **36 entrées** `/qualiopi/*` |
| 2 | Liens **en dur** dans `AdminSidebarNav` | `src/components/admin/ui/AdminSidebarNav.tsx`, hors de la liste `items` | `accountHref` (racine console), `https://app.axion-crm-pro.com` (externe), `${accountHref}/console-editoriale`, `${accountHref}/agenda` — **aucun `/qualiopi/*`** |
| 3 | `AdminCommandPalette` | `AdminCommandPalette.tsx` — appelle `buildAdminNav(adminPrefix)` et rien d'autre | **strictement inclus dans (1)**, ne peut atteindre aucune route de plus |

⇒ **Pour le périmètre Qualiopi, la source 2 n'ajoute rien.** Une route Qualiopi
absente de `buildAdminNav()` doit donc être cherchée dans les liens **de page à
page**, ce que j'ai fait ci-dessous. C'est le vrai piège, et il m'a eu une fois
(§ « Faux positif que j'ai attrapé »).

### Ce que je n'ai PAS pu vérifier

- Le **rendu réel**. Tout ce qui dépend d'un état de base (une section
  conditionnelle rendue ou non, une liste vide ou non) est une **déduction de
  code**, jamais une observation.
- Les **droits effectifs** : je lis `gardePage(...)` / `peutEngager(...)`, je ne
  les exécute pas.
- Le **portail public hors Qualiopi** et les autres pôles de la console
  (`content-gen`, `contacts`, …) : hors mandat.

### Faux positif que j'ai attrapé — méthode, pas anecdote

J'ai d'abord conclu que `/qualiopi/facturation/comptabilite` était orphelin :
un `grep` de la chaîne littérale `facturation/comptabilite` sur tout `src/` ne
rend **aucun** résultat. C'est faux. Le lien existe dans
`…/qualiopi/facturation/page.tsx`, écrit `href={`${base}/comptabilite`}` — un
gabarit, invisible à une recherche sur le chemin complet.

**Conséquence de méthode, appliquée à tout ce qui suit** : un chemin ne se
cherche pas en entier. Il se cherche **segment par segment**, en cherchant aussi
la forme `${variable}/dernier-segment`. Tous les constats d'orphelinat de la
section (1) ont été repassés sous cette règle.

---

## (1) Écrans orphelins

### Méthode de comptage

1. Liste A = 66 routes `page.tsx` sous `qualiopi/`.
2. Liste B = 36 `href` `/qualiopi/*` extraits de `buildAdminNav()`.
3. `comm -23 A B` = **30 routes absentes de la nav**.
4. Sur ces 30, j'ai écarté :
   - les **routes dynamiques de détail** (`[id]`) atteintes depuis leur liste ;
   - les **`/new`** atteintes depuis leur liste ;
   - celles **liées de page à page** (recherche par segment, cf. faux positif).

Il reste **1 orphelin réel** et **1 orphelin conditionnel**. Ce n'est pas 12,
et ce n'est pas 0.

### 1.1 🟠 `sessions/[id]/kit` — orphelin CONDITIONNEL (défaut de CODE)

**Le seul lien du produit vers cette page est un lien qui disparaît.**

- Preuve du lien unique : la chaîne `}/kit` n'apparaît que deux fois dans tout
  `src/` —
  `…/qualiopi/sessions/[id]/page.tsx`, prop `hrefRelecture={`${sessionBase}/kit`}`,
  et `…/qualiopi/sessions/[id]/kit/page.tsx` (la page qui se pointe elle-même).
- Preuve de la disparition : dans `sessions/[id]/page.tsx`, le composant
  `PreparationKitSession` n'est monté que si
  `preparationKit !== null && preparationKit.aPreparer`.
- Preuve de la condition : `src/server/qualiopi/kit-session/preparation.ts`,
  `aPreparer: !terminee && etape !== "pret"`.
- Preuve que le lien est en plus conditionné **à l'intérieur** du composant :
  `src/components/admin/qualiopi/PreparationKitSession.tsx` ne rend
  `<a href={hrefRelecture}>Relire les N sorties</a>` que dans la branche
  `etape === "a_valider"`.

**Conséquence.** Une fois le kit validé (`etape === "pret"`), la page de
relecture des sorties de démonstration **n'est plus atteignable par aucun lien**
— ni par la nav, ni par la barre d'ancres (l'ancre `preparation-kit` est
déclarée `conditionnelle` dans `src/features/admin-qualiopi/session-hub/ancres.ts`
et écartée par `ancresVisibles`), ni depuis les « Sous-pages » du hub (le carré
`Sous-pages` liste Émargement, Évaluations, Financement et « Tout pour animer »
— **pas le kit**).

Or c'est précisément **après validation** qu'on veut la relire : la page dit
elle-même « c'est ce que le formateur aura entre les mains si l'outil tombe en
salle » (`sessions/[id]/kit/page.tsx`, en-tête du fichier). Le formateur qui
prépare sa salle la veille ne peut y arriver qu'en tapant l'URL.

Tag : **CODE**. Indépendant des données de seed — c'est une branche `if`.

### 1.2 🟡 `/qualiopi` (racine du pôle) — orphelin ASSUMÉ

`page.tsx` existe à la racine `qualiopi/`. `buildAdminNav()` ne le référence
pas, et `src/lib/admin-nav.test.ts` **exige** son absence :
`expect(hrefs.has(`${base}/qualiopi`)).toBe(false)` (test « les doublons
fusionnés … sont sortis de la nav »). Commentaire d'origine dans `admin-nav.ts` :
« Vue d'ensemble (/qualiopi) retirée le 2026-08-01 (audit UX, P0 n°3) ».

⇒ **Décision antérieure, gardée par un test. Rien à corriger.** Je le signale
seulement pour qu'une prochaine session ne le « redécouvre » pas.

### 1.3 ✅ Les cinq faux orphelins — vérifiés, ils ne le sont pas

| Route | Absente de `buildAdminNav()` | Comment on y arrive réellement |
|---|---|---|
| `/qualiopi/conformite` | oui, volontairement | **redirige 308** vers `mode-auditeur` (documenté en tête de `qualiopi/mode-auditeur/page.tsx`) |
| `/qualiopi/entrees` | oui, retirée le 2026-08-27 (test « une seule porte ») | lien rendu par `MatriceIndicateurs.tsx` (`<Link href={`${baseHref}${r.chemin}`}>`) depuis `REGISTRES_PAR_INDICATEUR[4]` — `src/server/qualiopi/conformite/registres-par-indicateur.ts` |
| `/qualiopi/facturation/comptabilite` | oui | `…/qualiopi/facturation/page.tsx`, `href={`${base}/comptabilite`}` |
| `/qualiopi/mode-auditeur/emargement` | oui | `mode-auditeur/page.tsx`, `href={`${self}/emargement`}` **et** `REGISTRES_PAR_INDICATEUR[12]` |
| `/qualiopi/mode-auditeur/signatures` | oui | `mode-auditeur/page.tsx`, `href={`${self}/signatures`}` **et** `sessions/[id]/page.tsx` (« Registre des signatures de cette session », avec `?session=<id>`) |

### 1.4 ✅ Les sous-pages de fiche — toutes liées

- `formations/[id]/page.tsx` lie ses **quatre** enfants :
  `${formationBase}/programme`, `/animer`, `/supports`, `/certification`.
- `sessions/[id]/page.tsx` lie **trois** de ses quatre enfants dans la section
  `id="sous-pages"` : `/emargement`, `/evaluations`, `/financement`. Le
  quatrième (`/kit`) est le cas 1.1.

---

## (2) Ancres mortes

### Méthode

Recherche de toute occurrence de `#` dans un contexte `href` sur les cinq
répertoires du périmètre, puis croisement avec les `id=` réellement écrits dans
le JSX de la page cible.

### Résultat : **0 ancre morte trouvée.** Le correctif `ced63a85b` tient.

Les trois seules familles d'ancres du périmètre :

| Ancre | Où elle est émise | Où elle atterrit | Verdict |
|---|---|---|---|
| `#<id>` de la barre | `src/features/admin-qualiopi/session-hub/AncresHubSession.tsx`, `href={`#${a.id}`}` | `sessions/[id]/page.tsx` | ✅ les **12** entrées de `ANCRES_HUB_SESSION` ont un `<section id="…">` correspondant : `infos`, `checklist`, `cycle-de-vie`, `dates`, `lieu`, `formateur`, `inter-entreprises`, `preparation-kit`, `sous-pages`, `stagiaires`, `documents`, `questionnaires` — j'ai relu les 12 `id="` du fichier, un par un |
| `#<id>` de la checklist | `src/features/admin-qualiopi/session-hub/ChecklistSession.tsx`, `href={`#${e.ancre.id}`}` | même page | ✅ les ancres émises par `src/server/qualiopi/parcours/session-parcours.ts` sont **5 valeurs distinctes** — `formateur`, `documents`, `questionnaires`, `stagiaires`, `sous-pages` — toutes présentes, et **toutes non conditionnelles** |
| `#documents` inter-pages | `sessions/[id]/financement/page.tsx`, `hrefDocuments={`…/qualiopi/sessions/${id}#documents`}` | `sessions/[id]/page.tsx` | ✅ `<section id="documents">` existe |

⚠️ **Ce qui protège**, et qu'il ne faut pas défaire : `ChecklistSession` n'est
monté que sur le hub de session (`sessions/[id]/page.tsx`, un seul point de
montage vérifié par `grep`). Le jour où on le monterait sur `/qualiopi/a-traiter`
— tentation naturelle, cette page agrège déjà les parcours — **les cinq ancres
deviendraient mortes d'un coup**, puisque `a-traiter` ne porte aucune de ces
sections. C'est un risque de régression, pas un défaut actuel.

---

## (3) Culs-de-sac

### 3.1 🔴 `sessions/[id]/emargement` — AUCUN retour, et c'est le point d'arrivée de deux chemins

**Preuve.** Dans
`src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/emargement/page.tsx`,
les **seuls** `href` du fichier sont :

- `retourHref` du composant `AccesRefuse` (branche « accès refusé », jamais vue
  par quelqu'un d'autorisé) ;
- `<AdminButton href={`/api/qualiopi/sessions/${id}/emargement`}>` — un
  **téléchargement**, pas une navigation.

Aucun `<Link>`. Aucune chaîne « Retour ». **On arrive, on ne repart pas** —
sinon par le bouton « précédent » du navigateur ou la barre latérale, qui ne
ramène qu'à la LISTE des sessions.

C'est l'écran le plus lourd de conséquences du lot : l'émargement est
l'indicateur 12 du RNQ, et c'est la sous-page qu'on ouvre le jour même de la
formation.

Tag : **CODE**.

### 3.2 🔴 La chaîne Évaluations → Émargement → néant

`sessions/[id]/evaluations/page.tsx` porte **un seul** lien de navigation, et il
est libellé :

> `← Retour à l'émargement` → `/…/qualiopi/sessions/${id}/emargement`

Ce n'est pas un retour : c'est un **saut latéral vers une page sœur** dont
l'utilisateur ne vient pas (il vient du hub, par la grille « Sous-pages »). Et
comme cette page sœur est le cul-de-sac 3.1, le parcours complet est :

```
hub de session → Évaluations → « Retour » → Émargement → (plus rien)
```

Deux clics pour s'enfermer, en croyant reculer.

Tag : **CODE**. Le libellé et la destination sont écrits en dur dans le JSX.

### 3.3 🟠 Trois retours qui sautent la fiche et atterrissent sur la liste

| Écran | Lien de retour (libellé → destination) | Où il DEVRAIT ramener |
|---|---|---|
| `sessions/[id]/financement/page.tsx` | `← Sessions` → `/qualiopi/sessions` | `/qualiopi/sessions/[id]` |
| `formations/[id]/certification/page.tsx` | `← Retour aux formations` → `/qualiopi/formations` | `/qualiopi/formations/[id]` |
| `formations/[id]/supports/page.tsx` | `← Formations` → `/qualiopi/formations` | `/qualiopi/formations/[id]` |

Les libellés ne mentent pas (ils annoncent bien la liste), donc ce n'est pas un
défaut de la catégorie (4). Mais **on arrive à ces trois écrans depuis la fiche
parente**, et le retour proposé remonte de deux crans : il faut re-chercher la
session ou la formation dans une liste pour reprendre son travail. C'est une
**incohérence de retour** au sens de la question 6.

Contre-exemples dans le MÊME dépôt, qui montrent que la bonne forme est connue :
`sessions/[id]/kit/page.tsx` → `← Retour à la session` vers `base` (la fiche) ;
`formations/[id]/programme/page.tsx` et `/animer` → `formationBase` (la fiche).
`programme` porte même les **deux** (fiche *et* liste), ce qui est la forme la
plus complète du dépôt.

Tag : **CODE**.

### 3.4 🟡 Portail stagiaire : les trois pages à jeton se terminent en « fermez cette page »

- `src/components/portail/PieceSignatureForm.tsx`, branche `if (signe)` :
  « Votre signature est enregistrée … **Vous pouvez fermer cette page.** »
  Aucun lien vers `/portail/mon-espace`.
- `src/components/portail/EnqueteEntrepriseForm.tsx`, état de succès
  (« Merci ! ») : **aucun `href` dans tout le fichier**.
- `src/components/portail/EmargementForm.tsx` : **aucun `href` dans tout le
  fichier** ; après signature, `router.refresh()` et rien d'autre.

⚠️ **Je ne classe PAS cela comme un défaut franc.** C'est défendable : ces pages
sont ouvertes depuis un e-mail, le destinataire n'a pas forcément de compte
portail, et l'exemplaire contresigné part désormais par courriel (lot A, commit
`f12917ced`). Mais le stagiaire QUI A un espace (`PortailAcces` généré depuis le
hub de session) n'a, à ce moment précis, **aucun pont** vers ses documents.
C'est un manque, pas une casse.

Tag : **CODE**, gravité basse, arbitrage produit.

---

## (4) Liens qui mentent

**Aucun lien menteur franc trouvé** dans le périmètre — pas de libellé qui
annonce une destination et en sert une autre, pas de `href` vers une route
inexistante.

Un seul cas limite, déjà compté en (3.2) et non recompté ici :
`← Retour à l'émargement` sur la page Évaluations. Le mot **« Retour »** est
faux au sens du parcours (on n'en vient pas), même si la destination annoncée
est bien celle servie. Je le classe en cul-de-sac, pas en mensonge, pour ne pas
gonfler deux compteurs avec un seul défaut.

### Ce que j'ai regardé sans rien trouver

- Les `href` du périmètre qui pointent vers `/api/…` sont tous des
  **téléchargements** explicitement libellés comme tels (`Ouvrir … au format
  PDF`, export émargement, supports). Aucun ne se présente comme une page.
- `src/app/[locale]/portail/acces-invalide/page.tsx` porte
  `href={"/portail/demander-acces" as never}` — **sans préfixe de locale**. Le
  `Link` importé est celui de `@/i18n/navigation` (next-intl), qui préfixe la
  locale lui-même ; le `as never` ne fait que taire le typage strict des
  `pathnames`. **Je n'ai pas pu l'exécuter** : je le déclare *probablement sain*
  et je le range en section (7), pas en défaut.

---

## (5) États vides muets

Rappel de la consigne : un état vide n'est un défaut que s'il **n'explique ni
pourquoi il est vide ni quel geste le remplirait**, et il ne compte que là où
l'écran est le point d'entrée d'une obligation.

### 5.1 🟠 `sessions/[id]/evaluations` — « Aucun stagiaire actif inscrit à cette session. »

`sessions/[id]/evaluations/page.tsx`. La phrase dit le CONSTAT, jamais le GESTE.
L'évaluation des acquis est l'indicateur 11 ; l'écran est le point d'entrée de
l'obligation. Le geste manquant est à un clic (section `#stagiaires` du hub) et
la page ne le nomme pas — et, cul-de-sac 3.2 oblige, son unique lien mène
ailleurs.

Tag : **CODE** (chaîne écrite en dur). ⚠️ **À reconfirmer à l'écran** : sur une
session réellement peuplée, cet état ne s'affiche jamais.

### 5.2 🟠 `sessions/[id]/emargement` — « Aucun stagiaire inscrit à cette session. »

Même forme, même page-clé (indicateur 12), et sur un écran qui, lui, n'offre
**aucune** sortie (3.1).

Tag : **CODE**.

### 5.3 🟡 `sessions/[id]/kit` — « Aucune sortie produite pour l'instant. »

`sessions/[id]/kit/page.tsx`. Celui-là est **à moitié sauvé** : juste au-dessus,
`PreparationKitSession` est rendu quand `prep !== null` et porte le bouton
« Produire les sorties ». Le geste existe donc à l'écran, il n'est simplement
pas nommé par la phrase. Ne devient franchement muet que si `prep === null`.

Tag : **CODE**, gravité basse.

### 5.4 Ce que je n'ai pas balayé

Je n'ai **pas** passé au crible les états vides des ~30 écrans de registre
(`veille`, `moyens`, `partenariats`, `incidents`, `reclamations`,
`revue-direction`, `appreciations`, `sous-traitants`…), qui sont pourtant les
points d'entrée directs des indicateurs 17 à 32. C'est le plus gros trou de cet
audit et il est déclaré en (7).

---

## (6) Cohérence des retours — synthèse

| Sous-page | Retour vers la fiche parente ? | Preuve |
|---|---|---|
| `sessions/[id]/kit` | ✅ `← Retour à la session` → `base` | `kit/page.tsx` |
| `sessions/[id]/financement` | ❌ → liste `/qualiopi/sessions` | `financement/page.tsx` |
| `sessions/[id]/evaluations` | ❌ → page sœur `emargement` | `evaluations/page.tsx` |
| `sessions/[id]/emargement` | ❌ **aucun retour** | `emargement/page.tsx` |
| `formations/[id]/programme` | ✅ `formationBase` **+** liste | `programme/page.tsx` |
| `formations/[id]/animer` | ✅ `formationBase` | `animer/page.tsx` |
| `formations/[id]/supports` | ❌ → liste `/qualiopi/formations` | `supports/page.tsx` |
| `formations/[id]/certification` | ❌ → liste `/qualiopi/formations` | `certification/page.tsx` |
| `facturation/comptabilite` | ✅ `← Retour au Hub facturation` | `comptabilite/page.tsx` |

**4 sous-pages sur 8 ne ramènent pas à leur parent**, dont une qui ne ramène
nulle part. La branche `formations/` est la mieux tenue (2 sur 4), la branche
`sessions/` la moins (1 sur 4).

### Les deux espaces publics sont, eux, correctement navigables

Constat positif, et il compte : **le portail stagiaire et l'espace formateur ont
chacun une coquille de navigation persistante**, ce que la console admin n'a pas
au niveau des sous-pages.

- `src/app/[locale]/portail/mon-espace/_coquille.tsx` → `CoquilleStagiaire`,
  4 onglets (`À faire`, `Mes formations`, `Mes documents`, `Mon compte`), montée
  par les **4** pages de `mon-espace/` (vérifié fichier par fichier).
- `src/app/[locale]/espace-formateur/_coquille.tsx` → `CoquilleFormateur`,
  3 onglets, montée par les **5** pages hors jeton (`page.tsx`, `seances/`,
  `seances/[id]`, `sessions/`, `sessions/[id]`).
- Les deux délèguent à `src/components/espace/EspaceShell.tsx` : barre latérale
  sur écran large, barre d'onglets en bas sur mobile, zéro JavaScript.

⚠️ J'ai failli déclarer le portail « sans aucune navigation » : un `grep href=`
sur `mon-espace/formations/page.tsx` et `mon-compte/page.tsx` rend **zéro
résultat**. C'est le même piège qu'en (1) — la navigation est dans la coquille,
pas dans la page. Deuxième fois que la même erreur a failli passer.

---

## (7) Ce qui reste à établir

1. **Les états vides des ~30 écrans de registre** (`veille`, `moyens`,
   `partenariats`, `incidents`, `reclamations`, `revue-direction`,
   `appreciations`, `sous-traitants`, `baremes-opco`, `rgpd`…). Non balayés.
   Ce sont les points d'entrée directs des indicateurs 17 à 32 : c'est là que
   l'auditrice atterrit depuis `MatriceIndicateurs`, et un registre vide et muet
   y coûte le plus cher. **Plus gros trou de cet audit.**
2. **Tout ce qui dépend du rendu.** 1.1 (kit), 5.1, 5.2, 5.3 sont dérivés de
   branches `if`. Je n'ai vu **aucun écran**. Le contre-témoin manque : je n'ai
   pas pu vérifier qu'un kit `pret` fait bien disparaître le lien, seulement que
   le code le prescrit.
3. **Les droits.** Un lien visible qui mène à un refus est le pire cas de la
   catégorie (4), et je ne peux pas le trancher sans exécuter `gardePage` /
   `peutEngager`. Exemple non tranché : `facturation/comptabilite` est gaté par
   `isFacturationHubEnabled()` → `notFound()`, et le lien qui y mène depuis
   `facturation/page.tsx` **n'est pas gaté par le même drapeau dans le code que
   j'ai lu**. Si le drapeau peut être faux pendant que le hub est servi, le lien
   « Comptabilité » mène à un 404. **Non établi** — je n'ai pas lu le corps de
   `isFacturationHubEnabled()` ni ce qui garde la page du hub.
4. **`href={"/portail/demander-acces" as never}`** (`acces-invalide/page.tsx`) :
   sain en théorie (Link next-intl préfixe la locale), non vérifié à l'exécution.
5. **Le sous-arbre `coaching/`** de la console et les écrans `remuneration/[id]`,
   `audits/[id]`, `facturation/[id]`, `clients/[id]/edit` : je les ai comptés
   comme « atteints depuis leur liste » **par convention**, sans lire chaque
   liste. Convention raisonnable, non prouvée une par une.
6. **Le code bouge pendant que je le lis.** Entre deux `grep` du même fichier,
   le lien « Registre des signatures de cette session » de
   `sessions/[id]/page.tsx` est passé de la ligne 964 à la ligne 1007. Tous les
   constats ci-dessus sont ancrés sur des **noms** de fichier, de composant, de
   fonction ou de chaîne affichée — jamais sur un numéro de ligne seul.

---

## (8) Classement par gravité

| # | Gravité | Défaut | Preuve | Tag |
|---|---|---|---|---|
| 1 | 🔴 | **`sessions/[id]/emargement` n'a aucun lien de retour.** On arrive sur l'écran de l'indicateur 12 le jour de la formation, on n'en repart pas. | `…/sessions/[id]/emargement/page.tsx` : ses deux seuls `href` sont `AccesRefuse.retourHref` et un téléchargement `/api/…` ; zéro `<Link>` | CODE |
| 2 | 🔴 | **« ← Retour à l'émargement » enferme.** Le seul lien de la page Évaluations est un saut latéral vers le cul-de-sac n°1. Deux clics pour se piéger. | `…/sessions/[id]/evaluations/page.tsx`, bloc « Lien retour vers l'émargement » | CODE |
| 3 | 🟠 | **La relecture du kit devient inatteignable une fois le kit validé** — c'est-à-dire au moment où le formateur veut la relire. | lien unique `hrefRelecture={`${sessionBase}/kit`}` monté sous `preparationKit.aPreparer` (`preparation.ts` : `!terminee && etape !== "pret"`) et rendu sous `etape === "a_valider"` (`PreparationKitSession.tsx`) | CODE |
| 4 | 🟠 | **4 sous-pages sur 8 ramènent à la liste, pas à la fiche** — il faut re-chercher son dossier pour reprendre le travail. | tableau §6 : `financement`, `evaluations`, `supports`, `certification` | CODE |
| 5 | 🟠 | **Deux états vides muets sur les deux écrans d'obligation** (« Aucun stagiaire … ») : le constat sans le geste. | `evaluations/page.tsx` et `emargement/page.tsx` | CODE (⚠️ invisible sur une base peuplée) |
| 6 | 🟡 | Le portail stagiaire termine ses trois parcours à jeton par « fermez cette page », sans pont vers `mon-espace` pour celui qui y a un accès. | `PieceSignatureForm.tsx` (branche `signe`), `EnqueteEntrepriseForm.tsx`, `EmargementForm.tsx` (zéro `href`) | CODE, arbitrage produit |
| 7 | 🟡 | « Aucune sortie produite pour l'instant. » ne nomme pas le geste — sauvé de justesse par le bouton juste au-dessus. | `sessions/[id]/kit/page.tsx` | CODE |

**Ce qui n'est PAS un défaut, et qu'il ne faut pas re-signaler** : `/qualiopi`
(retiré et gardé par test), `/qualiopi/conformite` (308), `/qualiopi/entrees`
(retiré de la nav mais lié depuis la matrice des indicateurs),
`/qualiopi/facturation/comptabilite` (lié depuis le hub facturation), les deux
sous-pages de `mode-auditeur` (liées deux fois chacune), et les 12 ancres du hub
de session (toutes vivantes).
