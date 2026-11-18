# ADR 0076 — Couche « Méthode » : une collection interne, jamais publiable, jamais lue par un visiteur

- **Statut** : **proposé** — livrée derrière des interrupteurs éteints, à valider par le fondateur
- **Date** : 2026-11-18
- **Référence** : `prisma/schema.prisma` (`KnowledgeEntry`, `KnowledgeCollection`) ; `src/lib/knowledge/search-fts.ts` ; `src/lib/contenu/interdits-publication.ts` ; mode d'emploi : `docs/knowledge/COUCHE-METHODE.md`

## 1. Contexte

L'équipe tient des fiches de vente internes (méthodes, scripts, objections, postures), écrites
dans le dépôt de marque, privé. Elles aideront un jour les outils qui rédigent pour un client.
Ce dépôt-ci est **public** : le contenu des fiches, leurs titres et leurs montants
d'entraînement n'y entrent jamais. Cet ADR décrit seulement les règles.

## 2. Décision

### 2.1 Modèle : on réutilise, aucune migration

`KnowledgeEntry` + `KnowledgeTranslation` (locale `fr`) + `KnowledgeCollection` /
`KnowledgeCollectionItem` + `KnowledgeTag` / `KnowledgeTagOnEntry`. Les énumérations
nécessaires existent déjà. **Aucune migration, aucune suppression de données.**

Une table à part coûterait une migration pour un cloisonnement que les verrous ci-dessous
donnent déjà. Le critère « jamais dans `knowledge_entries` » est donc remplacé par :
**jamais publiable, jamais lue par un lecteur public**, prouvé par test.

### 2.2 Cloisonnement

| Champ                   | Valeur                             | Pourquoi                                                |
| ----------------------- | ---------------------------------- | ------------------------------------------------------- |
| `audience`              | `team`                             | jamais `public`                                         |
| `confidentiality`       | `internal`                         | la recherche publique exige `public`                    |
| `status`                | `approved`, **jamais** `published` | la recherche publique exige `published` / `deprecated`  |
| `publishedAt`           | nul                                | aucune page, aucun sitemap                              |
| `sourceFactoryId`       | `methode-import`                   | l'import ne touche jamais une entrée d'une autre source |
| collection `visibility` | `team`, `publishedAt` nul          |                                                         |

Les lecteurs publics de `knowledge_entries` exigent tous le statut publié et/ou l'audience
publique et/ou la confidentialité publique ; l'envoi au service d'embarquement exige la
confidentialité publique. Le texte de la couche ne part donc chez aucun prestataire.
Un test (`jamais-publiee.spec.ts`) le prouve sur une base factice.

**Garde de publication** : `executeTransition` (`src/server/actions/knowledge/_transition.ts`)
refuse `published` **et** `scheduled` (la programmation) pour toute entrée
`sourceFactoryId = methode-import`, quel que soit le rôle. Une fiche Méthode ne peut pas être
publiée depuis la console.

### 2.3 Sources acceptées (liste blanche, codée dans l'import)

Depuis une copie **locale** du dossier source, seulement `livres/*.md` et
`livres/important-a-savoir/*.md`. Tout le reste est ignoré et **compté** : les fiches non
validées, le dossier du secteur santé (à rouvrir par une fiche à part), les résumés bruts,
les contrôles, les notices, les doublons non nettoyés. La collection du secteur santé
n'est pas créée.

### 2.4 Import : un geste humain, jamais une routine

- `--source <chemin local>` obligatoire ; sans lui, refus, aucun client de base construit ;
- écrit seulement avec `--ecrire`, refusé si `CI` est posé ou si l'entrée standard n'est pas
  un terminal ; essai à blanc par défaut ;
- une fiche qui porte un courriel, un téléphone ou un nom listé dans un fichier local
  (`--noms-sensibles`) est refusée ; le journal n'écrit que des comptes, des slugs et des
  motifs, **jamais le texte** ;
- aucun workflow, worker, cron ni script de `package.json` ne l'appelle (test) ;
- idempotent sur le slug `methode/<fichier>/<section>` ; jamais de suppression.

### 2.5 Refus par défaut : la sécurité, c'est l'approbation à la main

**Décision du pilote, 18/11/2026 (elle l'emporte sur ce qui suit).** Un filtre qui cherche les
mauvaises formes une par une (montants, promesses, parts, coordonnées) ne sera jamais
complet : chaque relecture en trouvait de nouvelles. Le principe est donc inversé.

- **Liste blanche.** Une section n'est servie que si la **première ligne de son texte**, dans
  le corpus, est exactement `sortie: validee` : la marque que le fondateur pose **à la main,
  section par section**, sous le titre de la section. Sans cette marque : jamais servie, quel
  que soit son texte, même saine, même noyau.
- **Aucune tolérance.** Une autre casse, une espace de plus ou de moins, un accent, un retrait,
  une mise en forme (citation, liste, gras, commentaire), un caractère invisible ou
  d'alphabet voisin, ou la marque ailleurs que sur la première ligne (dans le corps, en fin de
  texte), ne comptent pas. La marque n'est lue que dans le texte de la section : jamais dans
  le titre, jamais dans une étiquette.
- **L'import ne pose jamais la marque et ne la déduit de rien.** Il recopie le corpus tel quel :
  une section saine sans marque reste non approuvée, et un corpus réimporté sans la marque la
  retire. Aucune fonction du code ne l'écrit (un test le garde : le littéral n'existe que dans
  `decoupage.ts`, et seulement pour comparer).
- **Deux lectures de la même règle** : le filtre de sortie (`estApprouvee`, exact, appliqué au
  noyau et aux extraits) et la requête des extraits (`LIKE`, premier filet qui borne la
  lecture). La ligne de marque est retirée du texte rendu.
- **Le filtre ci-dessous n'est que le SECOND FILET**, appliqué aux seules sections
  approuvées : il ne rend aucune section sûre, il rattrape une erreur de relecture. **La
  sécurité repose sur l'approbation à la main.** Mieux vaut refuser une section saine.

La marque doit être sur **la ligne qui suit immédiatement la ligne de titre**, telle
qu'écrite dans le fichier du corpus (titre `N. …`, bloc fixe, `Cas N — …`, marqueur de page
des affiches, titre Markdown `##`). Une ligne de mise en page, un numéro de page ou un
commentaire entre le titre et la marque l'invalide. Seuls `#` et `##` ouvrent une section
Markdown (un `###` fait partie de la section du dessus et la rend non approuvable) ; un titre
`#` est le titre du dossier, jamais une section approuvée ; les blocs de code et les
commentaires HTML ne portent aucun titre ; une section dont le corps contient un titre
indenté, un sous-titre, un soulignement setext ou un commentaire HTML n'est pas approuvable ;
un fichier qui mêle titres `##` et sections numérotées est ambigu : rien n'y est approuvé.
La marque est lue sur la **première ligne brute** de la section dans le corpus : si le
découpage la ferait apparaître en tête (retrait, tabulation, BOM, espace insécable, ligne
« # » supprimée, encadré « essentiel » sans terminateur), la section n'est pas approuvée et
son texte stocké est neutralisé. Aucun titre n'est reconnu dans un bloc de code Markdown.
Avec `--ecrire`, une entrée de l'import absente des sections retenues (refusée, renommée,
disparue) n'est jamais supprimée mais perd sa ligne de marque : le corpus fait foi.

Limites assumées : dans le format PDF, une ligne « N. Titre » suivie de la marque écrite dans
le corps d'une autre section est indiscernable d'un vrai titre (elle crée une section
approuvée : c'est la main du fondateur qui l'a écrite). La console permet à un administrateur
d'éditer le texte d'une fiche de l'import : y poser la marque est un geste humain, de même
nature que la poser dans le corpus ; un réimport écrase le texte depuis le corpus.

Formes connues qui peuvent encore passer le second filet dans une section approuvée (la
relecture du fondateur les arrête, c'est le principe) : « 5000e », « CHF » devant le nombre,
entité HTML pour l'euro, « cinq cents balles », « 90 pour 100 », numéro court 3615, adresses
postales, URL de profil nominatif, nombre nu sans unité, « l'année » seule, « méthode
infaillible », périodicités sans nombre (« abonnement mensuel », « tarif journalier »,
« chaque mois »), « prix HT » seul, « la plupart », « demi-tarif », « on s'y engage »,
« à tous les coups », « sans faille », « deux fois mieux », adresse de messagerie écrite en
toutes lettres, téléphone en lettres, « le prix d'un smic », « à l'heure », « à la journée »,
« chaque trimestre », « prix TTC » seul, « rendement assuré », « multiplié par », « 3✕ », courriel
en entité HTML, « brut 3000 » (brut avant le nombre), « il rend la mise », « majoritaire »,
« at mon_site.fr ». Si `--ecrire` échoue en cours de route, le nettoyage des entrées absentes
n'a pas lieu : relancer l'import.

### 2.6 Second filet : filtre de sortie

`filtrerPourSortie` (`src/server/methode/filtre-sortie.ts`) est appliqué au noyau **et** aux
extraits. Il refuse toute fiche : étiquetée `chiffres-exercice`, `doctrine:a-revoir` ou
`secteur:sante` ; contenant un montant (euros, dollars, multiplicateurs k, M, mille, million,
HT/TTC, milliards, avec ou sans devise), un courriel (y compris masqué : « [at] »,
« arobase », « @ » entouré d'espaces) ou un téléphone (y compris indicatif entre
parenthèses) ; contenant toute forme de « garanti* » ou « rembours* » (première personne
comprise) ou tout pourcentage, après normalisation ; ou touchée par `detecterInterditsSurface`
(promesse ou garantie de gain, témoignage ou statistique Axion-IA, citation de témoin,
ancrage local).

Double verrou, **les mêmes motifs à l'import** (mêmes fonctions, importées de `decoupage.ts` et
`filtre-sortie.ts`) : un montant pose `chiffres-exercice` ; une promesse, un pourcentage ou un
motif de `detecterInterditsSurface` pose `doctrine:a-revoir` ; un courriel ou un téléphone fait
**refuser** la section (elle n'est pas écrite). Dans tous les cas la fiche n'est jamais servie.

Refus à la racine ajoutés le 18/11 (second filet) : radicaux « doubl / tripl / quadrupl /
décupl » ; un nombre collé à `x` ou `×` (dans les deux sens) ; « engag… » avec « résultat » ;
« moitié, tiers, quart, majorité » seuls ; « hors » avec taxe ou TVA, « HTVA » ; « at » suivi
d'un domaine avec point ; « rend » ou « restitue » avec argent ; « pas de résultat » ; « brut »
ou « net » après un nombre ; « par heure, jour, mois, trimestre, an », « de l'heure ».

On préfère refuser une fiche saine que laisser passer une fiche douteuse. Conséquence
acceptée : si le noyau porte un montant, il n'est **pas** servi ; il faut réécrire sa section
« essentiel » sans chiffres. Le noyau est reconnu par la forme de son slug
(`methode/<fichier numéroté 00>/essentiel`), jamais par un titre écrit en dur.

### 2.7 Rien n'est ouvert ni allumé

Trois variables, toutes éteintes par défaut, déclarées dans `src/env.ts` et seulement
commentées dans `.env.example` :

- `METHODE_ACTIVE` : `z.enum(["true", "false"]).optional()`, seule la valeur exacte
  `"true"` allume `obtenirContexteMethode` ;
- `METHODE_STUDIO_OUVERT` : même forme, réservée à la porte du Studio (lot suivant) ;
- `METHODE_STUDIO_SECRET` : secret de cette porte (32 caractères minimum), réservé au même lot.

Aucun outil MCP, aucune route publique, aucune lecture par le chatbot, aucun générateur de
contenu n'appelle la couche (test : aucun import hors de `src/server/methode/` et de
l'import).

## 3. Suite prévue (hors de cet ADR)

La porte du Studio sera une route sœur, lecture seule, fermée par défaut, avec son propre
secret : jamais par la recherche publique (publique et mise en cache), jamais par MCP (le
secret MCP ouvre aussi la boîte de réception et l'agenda, et ajouter un outil change
l'empreinte épinglée du manifeste).

## 4. Gestes du fondateur

0. **Relire chaque section et poser la marque `sortie: validee` à la main**, sur la première
   ligne, sous son titre, dans le corpus source. Sans marque, une section n'est jamais servie.
1. Fournir une copie locale propre du dossier source, et une liste locale de noms sensibles.
2. Lancer l'essai à blanc, lire le journal, puis `--ecrire` sur la base voulue.
3. Poser `METHODE_ACTIVE=true` le moment venu.
4. Supprimer les deux anciennes branches de cette couche, déjà publiques, une fois cette PR fusionnée.
